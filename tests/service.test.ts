import assert from 'node:assert/strict';
import test from 'node:test';
import { resetDatabase, testEnvironment } from './helpers/d1';
const { analyze, configFor, importPerson, processNext, rankings, startDate, stateFor, updateSettings } = await import('../src/lib/service');
const { getRecord, saveRecord } = await import('../src/lib/store');

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
