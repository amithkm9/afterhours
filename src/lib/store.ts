import { env } from 'cloudflare:workers';

export const DEMO_OWNER = 'demo-v1';

function database(): D1Database {
  if (!env.DB) throw new Error('Persistent storage is unavailable. Apply the local database migration before starting.');
  return env.DB;
}

export async function listRecords<T>(kind: string, owner: string, includeDemo = true): Promise<T[]> {
  const result = await database().prepare('SELECT value FROM records WHERE kind = ? AND (owner = ? OR owner = ?) ORDER BY CASE WHEN owner = ? THEN 0 ELSE 1 END, created_at ASC')
    .bind(kind, owner, includeDemo ? DEMO_OWNER : owner, owner).all<{ value: string }>();
  const seen = new Set<string>();
  return result.results.flatMap(row => {
    const value = JSON.parse(row.value) as T & { id: string };
    if (seen.has(value.id)) return [];
    seen.add(value.id);
    return [value];
  });
}

export async function getRecord<T>(kind: string, id: string, owner: string, includeDemo = true): Promise<T | null> {
  const result = await database().prepare('SELECT value FROM records WHERE kind = ? AND id IN (?, ?) AND (owner = ? OR owner = ?) ORDER BY CASE WHEN owner = ? THEN 0 ELSE 1 END LIMIT 1')
    .bind(kind, `${owner}:${kind}:${id}`, `${DEMO_OWNER}:${kind}:${id}`, owner, includeDemo ? DEMO_OWNER : owner, owner).first<{ value: string }>();
  return result ? JSON.parse(result.value) as T : null;
}

export async function saveRecord<T extends { id: string }>(kind: string, value: T, owner: string): Promise<void> {
  const now = new Date().toISOString();
  await database().prepare('INSERT INTO records (id, kind, owner, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at')
    .bind(`${owner}:${kind}:${value.id}`, kind, owner, JSON.stringify(value), now, now).run();
}

/** Create an entity and its first job together; concurrent duplicate submissions cannot reset active work. */
export async function createEntityJob<T extends { id: string; status: string }, J extends { id: string; status: string }>(kind: 'person' | 'date', entity: T, job: J, owner: string): Promise<boolean> {
  const db = database();
  const now = new Date().toISOString();
  const entityId = `${owner}:${kind}:${entity.id}`;
  const result = await db.batch([
    db.prepare("INSERT INTO records (id, kind, owner, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at WHERE json_extract(records.value, '$.status') = 'failed'")
      .bind(entityId, kind, owner, JSON.stringify(entity), now, now),
    db.prepare("INSERT INTO records (id, kind, owner, value, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM records WHERE id = ? AND json_extract(value, '$.status') = 'pending') ON CONFLICT(id) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at WHERE json_extract(records.value, '$.status') IN ('complete', 'failed')")
      .bind(`${owner}:job:${job.id}`, 'job', owner, JSON.stringify(job), now, now, entityId),
  ]);
  return result[0].meta.changes > 0;
}

/** A completed profile revision stays idempotent; failures may be retried explicitly. */
export async function enqueueAnalysisJob<J extends { id: string }>(job: J, owner: string): Promise<J> {
  const now = new Date().toISOString();
  await database().prepare("INSERT INTO records (id, kind, owner, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at WHERE json_extract(records.value, '$.status') = 'failed'")
    .bind(`${owner}:job:${job.id}`, 'job', owner, JSON.stringify(job), now, now).run();
  const stored = await getRecord<J>('job', job.id, owner, false);
  if (!stored) throw new Error('The analysis job could not be saved.');
  return stored;
}

/** Replace the read-only demonstration as one transaction, leaving visitor records intact. */
export async function replaceDemo(people: { id: string }[], dates: { id: string }[], markerId: string): Promise<void> {
  const db = database();
  const now = new Date().toISOString();
  const statements = [db.prepare("DELETE FROM records WHERE owner = ? AND kind IN ('person', 'date')").bind(DEMO_OWNER)];
  for (const [kind, values] of [['person', people], ['date', dates]] as const) {
    for (const value of values) statements.push(db.prepare('INSERT INTO records (id, kind, owner, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(`${DEMO_OWNER}:${kind}:${value.id}`, kind, DEMO_OWNER, JSON.stringify(value), now, now));
  }
  statements.push(db.prepare('INSERT OR REPLACE INTO records (id, kind, owner, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(`${DEMO_OWNER}:meta:${markerId}`, 'meta', DEMO_OWNER, JSON.stringify({ id: markerId, createdAt: now }), now, now));
  await db.batch(statements);
}

export async function leaseJob(id: string, owner: string): Promise<boolean> {
  const now = Date.now();
  const result = await database().prepare("UPDATE records SET value=json_set(value, '$.leaseUntil', ?) WHERE id=? AND json_extract(value, '$.status') IN ('pending', 'running') AND COALESCE(json_extract(value, '$.nextAttemptAt'), 0) <= ? AND (json_extract(value, '$.leaseUntil') IS NULL OR json_extract(value, '$.leaseUntil') < ?)")
    .bind(now + 70_000, `${owner}:job:${id}`, now, now).run();
  return result.meta.changes > 0;
}

/** One public-endpoint request per deployment every 45 seconds, shared across sessions. */
export async function reserveAnonymousModel(now = Date.now()): Promise<boolean> {
  const stamp = new Date(now).toISOString();
  const result = await database().prepare("INSERT INTO records (id, kind, owner, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at WHERE COALESCE(json_extract(records.value, '$.nextAt'), 0) <= ?")
    .bind('system:rate-limit:anonymous-model', 'rate-limit', 'system', JSON.stringify({ nextAt: now + 45_000 }), stamp, stamp, now).run();
  return result.meta.changes > 0;
}

async function encryptionKey(): Promise<CryptoKey> {
  const secret = env.APP_SECRET;
  if (!secret) throw new Error('Secure credential storage is not configured.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encrypt(value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), new TextEncoder().encode(JSON.stringify(value))));
  return btoa(String.fromCharCode(...iv, ...encrypted));
}

export async function decrypt<T>(value: string): Promise<T> {
  const bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0));
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await encryptionKey(), bytes.slice(12));
  return JSON.parse(new TextDecoder().decode(clear)) as T;
}
