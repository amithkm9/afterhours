import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { resetDatabase } from './helpers/d1';
const { GET, POST } = await import('../app/api/[...path]/route');
type ApiState = Awaited<ReturnType<typeof import('../src/lib/service').stateFor>>;
type ScheduledDates = Awaited<ReturnType<typeof import('../src/lib/service').scheduleCohort>>;
type Rankings = Awaited<ReturnType<typeof import('../src/lib/service').rankings>>;

function request(path: string, body?: string, cookie?: string, origin = 'http://localhost') {
  return new NextRequest(`http://localhost/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json', Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body !== undefined ? { body } : {}),
  });
}

test('HTTP routes issue private session cookies, expose the saved cohort and isolate visitor jobs', async () => {
  const db = resetDatabase();
  try {
    const response = await GET(request('state'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const header = response.headers.get('Set-Cookie')!;
    assert.match(header, /afterhours-session=[a-f0-9-]{36}/);
    assert.match(header, /HttpOnly/i); assert.match(header, /SameSite=lax/i);
    const cookie = header.split(';')[0];
    const state = await response.json() as { people: { id: string; linkedinUrl: string; instagramUrl: string }[] };
    assert.equal(state.people.length, 25);
    const person = state.people[0];
    const cached = await POST(request('import', JSON.stringify({ linkedinUrl: person.linkedinUrl, instagramUrl: person.instagramUrl }), cookie));
    assert.equal(cached.status, 200);
    assert.equal((await cached.json() as { reused: boolean }).reused, true);
    const analyzed = await POST(request('analyze', JSON.stringify({ personId: person.id }), cookie));
    assert.equal(analyzed.status, 200);
    const personal = await GET(request('state', undefined, cookie));
    assert.equal((await personal.json() as { jobs: unknown[] }).jobs.length, 1);
    const stranger = await GET(request('state'));
    assert.equal((await stranger.json() as { jobs: unknown[] }).jobs.length, 0);
    const demo = await GET(request('state?demo=1', undefined, cookie));
    assert.equal((await demo.json() as { jobs: unknown[] }).jobs.length, 0);
    const step = await POST(request('jobs/step', '{}', cookie));
    assert.equal(step.status, 200);
    assert.equal((await step.json() as { job: { status: string } }).job.status, 'complete');
    const duplicate = await POST(request('jobs/step', '{}', cookie));
    assert.equal((await duplicate.json() as { processed: boolean }).processed, false);
  } finally { db.close(); }
});

test('HTTP routes reject malformed bodies and cross-origin writes without changing the cohort', async () => {
  const db = resetDatabase();
  try {
    for (const body of ['null', '[]', '{bad-json', JSON.stringify({ value: 'x'.repeat(13_000) })]) {
      const response = await POST(request('import', body));
      assert.equal(response.status, 400);
      assert.equal((await response.json() as { code: string }).code, 'INVALID_INPUT');
    }
    const forged = await POST(request('import', '{}', undefined, 'https://different.example'));
    assert.equal(forged.status, 403);
    assert.equal((await GET(request('unknown'))).status, 404);
    assert.equal((await POST(request('unknown', '{}'))).status, 404);
    assert.equal((await GET(request('rankings?personId=missing'))).status, 404);
  } finally { db.close(); }
});

test('HTTPS settings save hides credentials and preserves isolation across browser sessions', async () => {
  const db = resetDatabase();
  try {
    const first = await GET(new NextRequest('https://after-hours.example/api/state'));
    assert.match(first.headers.get('Set-Cookie')!, /; Secure/i);
    const cookie = first.headers.get('Set-Cookie')!.split(';')[0];
    const secret = 'test-session-only-provider-secret';
    const saved = await POST(request('settings', JSON.stringify({ groqApiKey: secret, apifyToken: secret }), cookie));
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { saved: true });
    const own = await GET(request('state', undefined, cookie));
    const serialized = await own.text();
    assert.ok(!serialized.includes(secret));
    const status = JSON.parse(serialized).providerStatus;
    assert.equal(status.groq.configured, true);
    assert.equal(status.apify.configured, true);
    const stranger = await (await GET(request('state'))).json() as ApiState;
    assert.equal(stranger.providerStatus.groq.configured, false);
    assert.equal(stranger.providerStatus.apify.configured, false);
    const invalid = await POST(request('settings', JSON.stringify({ groqApiKey: 123 }), cookie));
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json() as { code: string }).code, 'INVALID_SETTINGS');
    await POST(request('settings', JSON.stringify({ groqApiKey: '', apifyToken: '' }), cookie));
    const cleared = await (await GET(request('state', undefined, cookie))).json() as ApiState;
    assert.equal(cleared.providerStatus.groq.configured, false);
    assert.equal(cleared.providerStatus.apify.configured, false);
  } finally { db.close(); }
});

test('HTTP cohort scheduling is repeatable, private to the visitor, and every profile has a full shortlist', async () => {
  const db = resetDatabase();
  try {
    const initial = await GET(request('state'));
    const cookie = initial.headers.get('Set-Cookie')!.split(';')[0];
    const initialState = await initial.json() as ApiState;
    const first = await POST(request('dates/schedule', '{}', cookie));
    assert.equal(first.status, 200);
    const scheduled = await first.json() as ScheduledDates;
    assert.equal(scheduled.scheduled, 25);
    const ids = scheduled.dates.map((item: { date: { id: string } }) => item.date.id).sort();
    assert.equal(new Set(ids).size, 25);
    const repeated = await (await POST(request('dates/schedule', '{}', cookie))).json() as ScheduledDates;
    assert.deepEqual(repeated.dates.map((item: { date: { id: string } }) => item.date.id).sort(), ids);
    const own = await (await GET(request('state', undefined, cookie))).json() as ApiState;
    assert.equal(own.jobs.length, 25);
    const stranger = await (await GET(request('state'))).json() as ApiState;
    assert.equal(stranger.jobs.length, 0);
    assert.equal(stranger.dates.length, initialState.dates.length);
    for (const person of initialState.people) {
      const response = await GET(request(`rankings?personId=${encodeURIComponent(person.id)}`, undefined, cookie));
      assert.equal(response.status, 200);
      const { rankings } = await response.json() as Rankings;
      assert.equal(rankings.length, 24);
      assert.equal(new Set(rankings.map((row: { candidateId: string }) => row.candidateId)).size, 24);
      assert.ok(rankings.every((row: { candidateId: string }) => row.candidateId !== person.id));
    }
  } finally { db.close(); }
});
