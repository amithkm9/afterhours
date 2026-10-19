import { env } from 'cloudflare:workers';
import seed from '../../data/seed.json';
import { analyzePerson, assessDate, createDateSession, dateMatchesProfiles, generateDateTurn, normalizeProfileUrls, pollImport, rankPeople, schedulePairs, startImport } from './engine';
import { modelEnabled, modelName } from './providers';
import type { DateSession, ImportJob, Person, ProviderConfig } from './types';
import { EngineError, verifyProfileIdentity } from './validation';
import { createEntityJob, decrypt, DEMO_OWNER, encrypt, enqueueAnalysisJob, getRecord, leaseJob, listRankingRecords, listRecords, replaceDemo, reserveAnonymousModel, saveRecord } from './store';

export interface Job {
  id: string; kind: 'import' | 'analysis' | 'date'; status: 'pending' | 'running' | 'complete' | 'failed';
  personId?: string; dateId?: string; payload?: ImportJob; attempts: number; nextAttemptAt: number;
  leaseUntil?: number; error?: string; createdAt: string; updatedAt: string;
}

export async function configFor(owner: string): Promise<ProviderConfig> {
  const settings = await getRecord<{ id: string; encrypted: string }>('settings', 'providers', owner, false);
  const own = settings ? await decrypt<ProviderConfig>(settings.encrypted) : {};
  return { apifyToken: env.APIFY_TOKEN, groqApiKey: env.GROQ_API_KEY, groqModel: env.GROQ_MODEL, ...own, anonymousModel: env.MODEL_PROVIDER !== 'rules', maxCostUsd: 0.02 };
}

export async function updateSettings(owner: string, input: Record<string, unknown>) {
  const current = await configFor(owner);
  for (const name of ['apifyToken', 'groqApiKey', 'groqModel'] as const) {
    if (input[name] !== undefined) {
      if (typeof input[name] !== 'string' || input[name].length > 500) throw new EngineError('INVALID_SETTINGS', 'Provider settings must be short text values.');
      current[name] = input[name].trim() || undefined;
    }
  }
  await saveRecord('settings', { id: 'providers', encrypted: await encrypt(current) }, owner);
  return { saved: true };
}

export async function ensureDemo() {
  const markerId = `seed-${seed.updatedAt || 'empty'}`;
  const marker = await getRecord<{ id: string }>('meta', markerId, DEMO_OWNER, false);
  if (marker) return;
  const data = seed as unknown as { people: Person[]; dates: DateSession[] };
  if (!data.people.length) return;
  await replaceDemo(data.people, data.dates, markerId);
}

export async function stateFor(owner: string) {
  await ensureDemo();
  const [people, dates, jobs, config] = await Promise.all([
    listRecords<Person>('person', owner), listRecords<DateSession>('date', owner),
    listRecords<Job>('job', owner, false), configFor(owner),
  ]);
  return {
    people, dates, jobs,
    providerStatus: {
      apify: { configured: Boolean(config.apifyToken), label: config.apifyToken ? 'Apify connected' : 'Public web · Apify optional' },
      model: { configured: modelEnabled(config), label: config.groqApiKey ? 'Groq connected' : config.anonymousModel ? 'Free model · one reply every 45 seconds' : 'Rules-based preview' },
      groq: { configured: Boolean(config.groqApiKey) },
      storage: { configured: Boolean(env.DB), label: 'Persistent database' },
    },
    stats: { people: people.length, ready: people.filter(p => p.status === 'ready').length,
      verified: people.filter(p => p.identityStatus === 'verified').length,
      dates: dates.length, completedDates: dates.filter(d => d.status === 'complete').length },
  };
}

function newJob(kind: Job['kind'], values: Partial<Job>): Job {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), kind, status: 'pending', attempts: 0, nextAttemptAt: 0, createdAt: now, updatedAt: now, ...values };
}

async function operationId(prefix: string, input: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(input)));
  return `${prefix}-${Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function analysisJob(person: Person): Promise<Job> {
  const revision = person.analysis?.createdAt ?? person.sources.map(source => [source.id, source.retrievedAt]);
  return newJob('analysis', { id: await operationId('analysis', { personId: person.id, revision }), personId: person.id });
}

export async function importPerson(owner: string, body: Record<string, unknown>) {
  const urls = normalizeProfileUrls({ linkedinUrl: String(body.linkedinUrl || ''), instagramUrl: String(body.instagramUrl || '') });
  const state = await stateFor(owner);
  const existing = state.people.find(p => p.linkedinUrl === urls.linkedinUrl && p.instagramUrl === urls.instagramUrl);
  if (existing && existing.status !== 'failed') return { person: existing, reused: true };
  const ownPeople = await listRecords<Person>('person', owner, false);
  if (ownPeople.length >= 35 && !existing) throw new EngineError('RUN_LIMIT', 'This session already has 35 people. Open the saved cohort or continue with existing profiles.', false, 429);
  const now = new Date().toISOString();
  const person: Person = { id: existing?.id || await operationId('person', urls), name: new URL(urls.linkedinUrl).pathname.split('/')[2].replace(/[-_]/g, ' '), ...urls,
    status: 'pending', sources: [], identityStatus: 'unverified', createdAt: now, updatedAt: now };
  const job = newJob('import', { id: `import-${person.id}`, personId: person.id });
  const created = await createEntityJob('person', person, job, owner);
  return { person: (await getRecord<Person>('person', person.id, owner, false))!, job: (await getRecord<Job>('job', job.id, owner, false))!, ...(!created ? { reused: true } : {}) };
}

export async function analyze(owner: string, personId: string) {
  const person = await getRecord<Person>('person', personId, owner);
  if (!person) throw new EngineError('NOT_FOUND', 'Profile not found.', false, 404);
  if (['pending', 'importing'].includes(person.status) || person.sources.length !== 2) throw new EngineError('PROFILE_NOT_READY', 'Wait for both public profile sources before analyzing this person.');
  const existing = (await listRecords<Job>('job', owner, false)).find(job => job.personId === personId && job.kind === 'analysis' && ['pending', 'running'].includes(job.status));
  if (existing) return { job: existing };
  const job = await enqueueAnalysisJob(await analysisJob(person), owner);
  return { job };
}

export async function startDate(owner: string, aId: string, bId: string) {
  const [a, b, config, dates] = await Promise.all([getRecord<Person>('person', aId, owner), getRecord<Person>('person', bId, owner), configFor(owner), listRecords<DateSession>('date', owner)]);
  if (!a || !b || a.status !== 'ready' || b.status !== 'ready') throw new EngineError('PROFILE_NOT_READY', 'Choose two profiles with completed analyses.');
  if (a.id === b.id) throw new EngineError('SAME_PERSON', 'Choose two different agents.');
  const matching = dates.filter(date => [date.personAId, date.personBId].includes(aId) && [date.personAId, date.personBId].includes(bId) && date.mode === (modelEnabled(config) ? 'llm' : 'rules') && dateMatchesProfiles(date, a, b));
  const prior = matching.find(date => date.status !== 'failed');
  if (prior) return { date: prior, reused: true };
  const failed = matching.find(date => date.status === 'failed');
  const ownDates = await listRecords<DateSession>('date', owner, false);
  if (ownDates.length >= 75 && !failed) throw new EngineError('RUN_LIMIT', 'This session has reached its date limit.', false, 429);
  const mode = modelEnabled(config) ? 'llm' : 'rules';
  const date = failed ? { ...failed, status: 'pending' as const, error: undefined } : createDateSession(aId, bId, mode);
  if (!failed) date.id = await operationId('date', { mode, profiles: [a, b].map(person => ({ id: person.id, revision: person.analysis!.createdAt })).sort((left, right) => left.id.localeCompare(right.id)) });
  date.profileSnapshots ??= structuredClone({ [a.id]: a, [b.id]: b });
  date.generation = 'live';
  if (modelEnabled(config)) date.model = modelName(config);
  const job = newJob('date', { id: `date-job-${date.id}`, dateId: date.id });
  const created = await createEntityJob('date', date, job, owner);
  return { date: (await getRecord<DateSession>('date', date.id, owner, false))!, job: (await getRecord<Job>('job', job.id, owner, false))!, ...(!created ? { reused: true } : {}) };
}

export async function scheduleCohort(owner: string) {
  const people = await listRecords<Person>('person', owner);
  const pairs = schedulePairs(people);
  const dates = [];
  for (const pair of pairs) dates.push(await startDate(owner, pair.personAId, pair.personBId));
  return { scheduled: dates.length, dates };
}

export async function rankings(owner: string, personId: string) {
  const { people, dates } = await listRankingRecords(owner);
  const person = people.find(p => p.id === personId);
  if (!person) throw new EngineError('NOT_FOUND', 'Profile not found.', false, 404);
  return { rankings: rankPeople(person, people, dates) };
}

export async function processNext(owner: string, dateId?: string): Promise<{ processed: boolean; waiting?: boolean; job?: Job; date?: DateSession; person?: Person }> {
  const jobs = await listRecords<Job>('job', owner, false);
  const candidates = jobs.filter(j => ['pending', 'running'].includes(j.status) && j.nextAttemptAt <= Date.now() && (!dateId || j.dateId === dateId));
  let job: Job | undefined;
  for (const candidate of candidates) {
    if (await leaseJob(candidate.id, owner)) {
      job = await getRecord<Job>('job', candidate.id, owner, false) || undefined;
      if (job) break;
    }
  }
  if (!job) return { processed: false };
  job = { ...job, status: 'running', leaseUntil: Date.now() + 70_000, updatedAt: new Date().toISOString() };
  let person: Person | null = null;
  let date: DateSession | null = null;
  try {
    const config = await configFor(owner);
    if (job.attempts && job.error) config.retryContext = job.error.slice(0, 300);
    if (job.kind !== 'import' && config.anonymousModel && !config.groqApiKey && !await reserveAnonymousModel()) {
      job.status = 'pending'; job.leaseUntil = 0; job.nextAttemptAt = Date.now() + 5000;
      await saveRecord('job', job, owner);
      return { processed: false, waiting: true, job };
    }
    if (job.kind === 'import') {
      person = await getRecord<Person>('person', job.personId!, owner, false);
      if (!person) throw new EngineError('NOT_FOUND', 'Import profile no longer exists.');
      person.status = 'importing';
      await saveRecord('person', person, owner);
      job.payload = job.payload ? await pollImport(job.payload, config) : await startImport(person, config);
      if (job.payload.status === 'complete') {
        person.sources = job.payload.sources;
        person.identityStatus = verifyProfileIdentity(person.sources);
        const linkedin = person.sources.find(s => s.platform === 'linkedin');
        const instagram = person.sources.find(s => s.platform === 'instagram');
        person.name = linkedin?.metadata?.name || instagram?.metadata?.name || person.name;
        person.headline = linkedin?.metadata?.headline;
        person.imageUrl = instagram?.metadata?.imageUrl || linkedin?.metadata?.imageUrl;
        person.status = 'analyzing';
        person.updatedAt = new Date().toISOString();
        await saveRecord('person', person, owner);
        await enqueueAnalysisJob(await analysisJob(person), owner);
        job.status = 'complete';
      } else { job.nextAttemptAt = Date.now() + 4000; }
    } else if (job.kind === 'analysis') {
      person = await getRecord<Person>('person', job.personId!, owner);
      if (!person) throw new EngineError('NOT_FOUND', 'Profile no longer exists.');
      person.analysis = await analyzePerson(person, config);
      person.status = 'ready'; person.error = undefined; person.updatedAt = new Date().toISOString();
      await saveRecord('person', person, owner);
      job.status = 'complete';
    } else {
      date = await getRecord<DateSession>('date', job.dateId!, owner, false);
      if (!date) throw new EngineError('NOT_FOUND', 'Date no longer exists.');
      const [a, b] = date.profileSnapshots
        ? [date.profileSnapshots[date.personAId], date.profileSnapshots[date.personBId]]
        : await Promise.all([getRecord<Person>('person', date.personAId, owner), getRecord<Person>('person', date.personBId, owner)]);
      if (!a || !b) throw new EngineError('NOT_FOUND', 'A date participant could not be found.');
      date.status = 'running';
      if (date.turns.length < 6) date.turns.push(await generateDateTurn(date, a, b, config));
      else if (!date.assessments.some(item => item.personId === a.id)) date.assessments.push(await assessDate(date, a, b, config));
      else if (!date.assessments.some(item => item.personId === b.id)) date.assessments.push(await assessDate(date, b, a, config));
      if (date.turns.length === 6 && date.assessments.length === 2) { date.status = 'complete'; job.status = 'complete'; }
      date.updatedAt = new Date().toISOString();
      await saveRecord('date', date, owner);
      job.nextAttemptAt = Date.now() + (config.groqApiKey ? 6000 : config.anonymousModel ? 45_000 : 150);
    }
    job.attempts = 0;
    job.error = undefined;
  } catch (error) {
    const recoverable = error instanceof EngineError && error.retryable;
    job.attempts += 1;
    job.error = error instanceof Error ? error.message : 'The operation could not be completed.';
    job.status = recoverable && job.attempts < 3 ? 'pending' : 'failed';
    job.nextAttemptAt = Date.now() + Math.min(60_000, 10_000 * 2 ** job.attempts);
    if (job.status === 'failed' && person) { person.status = 'failed'; person.error = job.error; await saveRecord('person', person, owner); }
    if (job.status === 'failed' && date) { date.status = 'failed'; date.error = job.error; await saveRecord('date', date, owner); }
  }
  job.leaseUntil = 0;
  job.updatedAt = new Date().toISOString();
  await saveRecord('job', job, owner);
  return { processed: true, job, ...(date ? { date } : {}), ...(person ? { person } : {}) };
}
