import assert from 'node:assert/strict';
import test from 'node:test';
import { resetDatabase, testEnvironment } from './helpers/d1';
import type { DateSession, Person } from '../src/lib/types';
import type { Job } from '../src/lib/service';
const { analyze, configFor, importPerson, processNext, rankings, startDate, stateFor, updateSettings } = await import('../src/lib/service');
const { getRecord, listRankingRecords, listRecords, saveRecord } = await import('../src/lib/store');
const { rankPeople } = await import('../src/lib/engine');

test('saved cohort initializes once, ranks all other people and reuses completed demo dates', async () => {
  const database = resetDatabase();
  try {
    const state = await stateFor('owner-a');
    assert.equal(state.people.length, 25);
    assert.equal(state.dates.length, 25);
    assert.equal(state.stats.ready, 25);
    for (const person of state.people) {
      const result = await rankings('owner-a', person.id);
      assert.equal(result.rankings.length, 24);
      assert.equal(new Set(result.rankings.map(entry => entry.candidateId)).size, 24);
    }
    const demo = state.dates[0];
    if (demo.mode === 'llm') await updateSettings('owner-a', { groqApiKey: 'test-key-for-cache-selection' });
    const result = await startDate('owner-a', demo.personAId, demo.personBId);
    assert.equal(result.reused, true);
    assert.equal(result.date.id, demo.id);
    assert.equal((await stateFor('owner-a')).dates.length, 25);
    const cachedImport = await importPerson('owner-a', { linkedinUrl: state.people[0].linkedinUrl, instagramUrl: state.people[0].instagramUrl });
    assert.equal(cachedImport.reused, true);
  } finally { database.close(); }
});

test('lightweight ranking records preserve every score and session override without loading date transcripts', async () => {
  const database = resetDatabase();
  try {
    const full = await stateFor('owner-a');
    const compact = await listRankingRecords('owner-a');
    assert.ok(JSON.stringify(compact).length < JSON.stringify({ people: full.people, dates: full.dates }).length / 3);
    assert.ok(compact.dates.every(date => !('turns' in date) && !('profileSnapshots' in date)));
    assert.ok(compact.people.every(person => typeof person.analysis === 'object' && Array.isArray(person.analysis!.claims)));
    assert.ok(compact.dates.every(date => Array.isArray(date.assessments) && typeof date.profileRevisions === 'object' && Object.keys(date.profileRevisions).length === 2));
    for (const person of full.people) assert.deepEqual(rankPeople(person, compact.people, compact.dates), rankPeople(person, full.people, full.dates));
    await saveRecord('date', { ...full.dates[0], id: 'legacy-without-snapshots', profileSnapshots: undefined }, 'owner-a');
    const legacy = await listRankingRecords('owner-a');
    assert.deepEqual(legacy.dates.find(date => date.id === 'legacy-without-snapshots')!.profileRevisions, {});
    assert.deepEqual(rankPeople(full.people[0], legacy.people, legacy.dates), rankPeople(full.people[0], full.people, full.dates));
    const person = full.people[0];
    await saveRecord('person', { ...person, analysis: { ...person.analysis!, createdAt: '2099-01-01T00:00:00.000Z' } }, 'owner-a');
    const changed = await listRankingRecords('owner-a');
    assert.equal(changed.people.length, 25);
    const own = changed.people.find(value => value.id === person.id)!;
    assert.equal(own.analysis!.createdAt, '2099-01-01T00:00:00.000Z');
    assert.ok(rankPeople(own, changed.people, changed.dates).every(entry => entry.basis === 'profile'));
    const stranger = await listRankingRecords('owner-b');
    assert.equal(stranger.people.find(value => value.id === person.id)!.analysis!.createdAt, person.analysis!.createdAt);
  } finally { database.close(); }
});

test('processing a personal reanalysis overrides demo without duplicates and cannot execute twice', async () => {
  const database = resetDatabase();
  try {
    const original = (await stateFor('owner-a')).people[0];
    const { job } = await analyze('owner-a', original.id);
    const first = await processNext('owner-a');
    assert.equal(first.processed, true);
    assert.ok('job' in first);
    assert.equal(first.job!.id, job.id);
    assert.equal(first.job!.status, 'complete');
    assert.equal(first.person!.analysis!.mode, 'rules');
    const state = await stateFor('owner-a');
    assert.equal(state.people.length, 25);
    assert.equal(state.people.filter(person => person.id === original.id).length, 1);
    assert.equal((await processNext('owner-a')).processed, false);
    assert.ok(await getRecord('person', original.id, 'owner-a', false));
    assert.equal(await getRecord('person', original.id, 'owner-b', false), null);
  } finally { database.close(); }
});

test('provider credentials stay isolated per session and configured model failure does not become rules success', async () => {
  const database = resetDatabase();
  const originalFetch = globalThis.fetch;
  try {
    await updateSettings('owner-a', { groqApiKey: 'test-private-key' });
    assert.equal((await configFor('owner-a')).groqApiKey, 'test-private-key');
    assert.equal((await configFor('owner-b')).groqApiKey, undefined);
    const state = await stateFor('owner-a');
    assert.ok(!JSON.stringify(state).includes('test-private-key'));
    const person = state.people[0];
    await analyze('owner-a', person.id);
    globalThis.fetch = (async () => new Response('invalid key test-private-key', { status: 401 })) as typeof fetch;
    const result = await processNext('owner-a');
    assert.ok('job' in result);
    assert.equal(result.job!.status, 'failed');
    assert.equal(result.person!.status, 'failed');
    assert.match(result.job!.error!, /Groq access/);
    assert.ok(!result.job!.error!.includes('test-private-key'));
    assert.equal((await configFor('owner-b')).groqApiKey, undefined);
    assert.equal(testEnvironment.GROQ_API_KEY, undefined);
  } finally { globalThis.fetch = originalFetch; database.close(); }
});

test('anonymous quota waits preserve the job without consuming an attempt or calling a model', async () => {
  const database=resetDatabase();
  const originalFetch=globalThis.fetch;
  try {
    testEnvironment.MODEL_PROVIDER='anonymous';
    const { reserveAnonymousModel }=await import('../src/lib/store');
    assert.equal(await reserveAnonymousModel(),true);
    const state=await stateFor('owner-a');
    assert.equal(state.providerStatus.model.configured,true);
    assert.equal(state.providerStatus.groq.configured,false);
    const {job}=await analyze('owner-a',state.people[0].id);
    globalThis.fetch=(async()=>{throw new Error('No model request should occur while quota is reserved');}) as typeof fetch;
    const result=await processNext('owner-a');
    assert.equal(result.waiting,true);
    assert.equal(result.job!.id,job.id);
    assert.equal(result.job!.status,'pending');
    assert.equal(result.job!.attempts,0);
    assert.equal(result.job!.leaseUntil,0);
  } finally {globalThis.fetch=originalFetch;database.close();}
});

test('starting a date after reanalysis creates a fresh session and retains the old evidence snapshot', async () => {
  const database = resetDatabase();
  try {
    const state = await stateFor('owner-a');
    const [a, b] = state.people;
    const first = await startDate('owner-a', a.id, b.id);
    const snapshot = structuredClone(first.date.profileSnapshots![a.id]);
    const changed = { ...a, analysis: { ...a.analysis!, createdAt: '2099-01-01T00:00:00.000Z', summary: 'Reanalyzed profile.' } };
    await saveRecord('person', changed, 'owner-a');
    const second = await startDate('owner-a', a.id, b.id);
    assert.notEqual(second.date.id, first.date.id);
    assert.equal(second.reused, undefined);
    assert.equal(second.date.profileSnapshots![a.id].analysis!.summary, 'Reanalyzed profile.');
    const retained = await getRecord<typeof first.date>('date', first.date.id, 'owner-a', false);
    assert.deepEqual(retained!.profileSnapshots![a.id], snapshot);
  } finally { database.close(); }
});

test('concurrent canonical imports, reanalyses and reversed date submissions each create one operation', async () => {
  const database = resetDatabase();
  try {
    const state = await stateFor('owner-a');
    const urls = { linkedinUrl: 'https://linkedin.com/in/concurrent-person?trk=test', instagramUrl: 'https://instagram.com/concurrent.person/?igsh=test' };
    const imports = await Promise.all(Array.from({ length: 8 }, () => importPerson('owner-a', urls)));
    assert.equal(new Set(imports.map(result => result.person.id)).size, 1);
    assert.equal((await listRecords<Person>('person', 'owner-a', false)).length, 1);
    assert.equal((await listRecords<Job>('job', 'owner-a', false)).filter(job => job.kind === 'import').length, 1);
    await assert.rejects(analyze('owner-a', imports[0].person.id), /Wait for both/);

    const analyses = await Promise.all(Array.from({ length: 8 }, () => analyze('owner-a', state.people[0].id)));
    assert.equal(new Set(analyses.map(result => result.job.id)).size, 1);
    assert.equal((await listRecords<Job>('job', 'owner-a', false)).filter(job => job.kind === 'analysis').length, 1);

    const [a, b] = state.people;
    const dates = await Promise.all(Array.from({ length: 8 }, (_, index) => startDate('owner-a', index % 2 ? b.id : a.id, index % 2 ? a.id : b.id)));
    assert.equal(new Set(dates.map(result => result.date.id)).size, 1);
    assert.equal((await listRecords<DateSession>('date', 'owner-a', false)).length, 1);
    assert.equal((await listRecords<Job>('job', 'owner-a', false)).filter(job => job.kind === 'date').length, 1);
  } finally { database.close(); }
});

test('a failed date resumes its stored turns and completes exactly six turns and two assessments', async () => {
  const database = resetDatabase();
  const originalNow = Date.now;
  let clock = originalNow();
  Date.now = () => clock;
  try {
    const [a, b] = (await stateFor('owner-a')).people;
    const started = await startDate('owner-a', a.id, b.id);
    for (let index = 0; index < 3; index++) { await processNext('owner-a', started.date.id); clock += 1000; }
    const partial = (await getRecord<DateSession>('date', started.date.id, 'owner-a', false))!;
    const job = (await listRecords<Job>('job', 'owner-a', false)).find(value => value.dateId === partial.id)!;
    assert.equal(partial.turns.length, 3);
    await saveRecord('date', { ...partial, status: 'failed', error: 'Temporary model failure' }, 'owner-a');
    await saveRecord('job', { ...job, status: 'failed', attempts: 3, error: 'Temporary model failure', leaseUntil: 0 }, 'owner-a');

    const resumed = await startDate('owner-a', b.id, a.id);
    assert.equal(resumed.date.id, partial.id);
    assert.deepEqual(resumed.date.turns, partial.turns);
    assert.equal(resumed.date.status, 'pending');
    assert.ok('job' in resumed);
    assert.equal(resumed.job.attempts, 0);
    for (let index = 0; index < 5; index++) { await processNext('owner-a', partial.id); clock += 1000; }
    const complete = (await getRecord<DateSession>('date', partial.id, 'owner-a', false))!;
    assert.equal(complete.status, 'complete');
    assert.equal(complete.turns.length, 6);
    assert.equal(new Set(complete.turns.map(turn => turn.id)).size, 6);
    assert.deepEqual(complete.turns.slice(0, 3), partial.turns);
    assert.equal(complete.assessments.length, 2);
    assert.equal((await processNext('owner-a', partial.id)).processed, false);
    assert.equal((await rankings('owner-a', a.id)).rankings.find(entry => entry.candidateId === b.id)!.dateId, complete.id);
  } finally { Date.now = originalNow; database.close(); }
});

test('a new readable public source pair imports and analyzes, while a LinkedIn authwall fails honestly', async () => {
  const database = resetDatabase();
  const originalFetch = globalThis.fetch;
  try {
    const urls = { linkedinUrl: 'https://www.linkedin.com/in/new-public-person/', instagramUrl: 'https://www.instagram.com/new.public.person/' };
    const linkedin = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Person', name: 'New Person', url: urls.linkedinUrl, description: 'Software engineer and photography enthusiast.' })}</script>`;
    const instagram = `<meta name="description" content="New Person on Instagram: &quot;I enjoy photography. ${urls.linkedinUrl}&quot;">`;
    const context = { username: 'new.public.person', full_name: 'New Person', graphql_media: [{ shortcode_media: { shortcode: 'NEWPOST', owner: { username: 'new.public.person', is_private: false }, edge_media_to_caption: { edges: [{ node: { text: 'I enjoy hiking and photography.' } }] } } }] };
    const embed = `<script>${JSON.stringify({ contextJSON: JSON.stringify({ context }) })}</script>`;
    globalThis.fetch = (async input => new Response(String(input).includes('linkedin.com') ? linkedin : String(input).endsWith('/embed/') ? embed : instagram)) as typeof fetch;
    const started = await importPerson('owner-a', urls);
    const imported = await processNext('owner-a');
    assert.equal(imported.job!.status, 'complete');
    assert.equal(imported.person!.sources.length, 2);
    assert.equal(imported.person!.identityStatus, 'verified');
    const analyzed = await processNext('owner-a');
    assert.equal(analyzed.person!.id, started.person.id);
    assert.equal(analyzed.person!.status, 'ready');
    assert.equal((await rankings('owner-a', started.person.id)).rankings.length, 25);

    globalThis.fetch = (async () => new Response('<script>location.href="/authwall"</script>')) as typeof fetch;
    await importPerson('owner-a', { linkedinUrl: 'https://www.linkedin.com/in/blocked-person/', instagramUrl: 'https://www.instagram.com/blocked.person/' });
    const blocked = await processNext('owner-a');
    assert.equal(blocked.job!.status, 'failed');
    assert.equal(blocked.person!.status, 'failed');
    assert.match(blocked.job!.error!, /LinkedIn did not expose/);
    assert.equal(blocked.person!.analysis, undefined);
    assert.equal(blocked.person!.sources.length, 0);
  } finally { globalThis.fetch = originalFetch; database.close(); }
});

test('model failures retry only the current step and successful turns reset the retry budget', async () => {
  const database = resetDatabase();
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let clock = originalNow();
  Date.now = () => clock;
  try {
    await updateSettings('owner-a', { groqApiKey: 'test-retry-key' });
    const state = await stateFor('owner-a');
    const a = state.people[0];
    const b = state.people.find(person => person.id !== a.id && !state.dates.some(date => [date.personAId, date.personBId].includes(a.id) && [date.personAId, date.personBId].includes(person.id)))!;
    const started = await startDate('owner-a', a.id, b.id);
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      if (calls % 2) return Response.json({ error: 'rate limit' }, { status: 429 });
      const self = calls === 2 ? a : b;
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ message: "I'd suggest a short conversation about the documented topic and leave the timing flexible. Which part would you explore?", evidenceIds: [self.analysis!.claims[0].id] }) } }] });
    }) as typeof fetch;
    for (let step = 0; step < 2; step++) {
      const failed = await processNext('owner-a', started.date.id);
      assert.equal(failed.job!.status, 'pending');
      assert.equal(failed.job!.attempts, 1);
      clock += 21_000;
      const succeeded = await processNext('owner-a', started.date.id);
      assert.equal(succeeded.job!.attempts, 0);
      assert.equal(succeeded.date!.turns.length, step + 1);
      clock += 7000;
    }
    assert.equal(calls, 4);
  } finally { globalThis.fetch = originalFetch; Date.now = originalNow; database.close(); }
});
