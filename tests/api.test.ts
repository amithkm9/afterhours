import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { resetDatabase } from './helpers/d1';
const { GET, POST } = await import('../app/api/[...path]/route');

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
