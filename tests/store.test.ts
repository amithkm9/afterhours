import assert from 'node:assert/strict';
import test from 'node:test';
import { resetDatabase } from './helpers/d1';
const { DEMO_OWNER, getRecord, listRecords, saveRecord, leaseJob, encrypt, decrypt, replaceDemo, reserveAnonymousModel } = await import('../src/lib/store');

test('owner records override matching demo IDs while unrelated demo records remain visible', async () => {
  const database = resetDatabase();
  try {
    await saveRecord('person', { id: 'shared', name: 'Demo version' }, DEMO_OWNER);
    await saveRecord('person', { id: 'another', name: 'Another demo person' }, DEMO_OWNER);
    await saveRecord('person', { id: 'shared', name: 'Personal revised version' }, 'owner-a');
    await saveRecord('person', { id: 'secret', name: 'Another owner private record' }, 'owner-b');
    assert.deepEqual(await getRecord('person', 'shared', 'owner-a'), { id: 'shared', name: 'Personal revised version' });
    const people = await listRecords<{ id: string; name: string }>('person', 'owner-a');
    assert.equal(people.length, 2);
    assert.equal(people.filter(person => person.id === 'shared').length, 1);
    assert.equal(people.find(person => person.id === 'shared')!.name, 'Personal revised version');
    assert.equal(await getRecord('person', 'secret', 'owner-a'), null);
    assert.equal((await listRecords('person', 'owner-a', false)).length, 1);
    assert.equal(await getRecord('person', 'another', 'owner-a', false), null);
  } finally { database.close(); }
});

test('lease acquisition is atomic and rejects completed, failed, delayed and already-leased work', async () => {
  const database = resetDatabase();
  try {
    const now = Date.now();
    for (const [id, status, nextAttemptAt, leaseUntil] of [
      ['due', 'pending', 0, 0], ['running-due', 'running', 0, 0], ['done', 'complete', 0, 0],
      ['failed', 'failed', 0, 0], ['later', 'pending', now + 60_000, 0], ['leased', 'running', 0, now + 60_000],
    ] as const) await saveRecord('job', { id, status, nextAttemptAt, leaseUntil }, 'owner-a');
    const contenders = await Promise.all([leaseJob('due', 'owner-a'), leaseJob('due', 'owner-a')]);
    assert.equal(contenders.filter(Boolean).length, 1);
    assert.equal(await leaseJob('running-due', 'owner-a'), true);
    for (const id of ['done', 'failed', 'later', 'leased']) assert.equal(await leaseJob(id, 'owner-a'), false, `${id} must not be leased`);
    assert.equal(await leaseJob('due', 'owner-b'), false);
    const claimed = await getRecord<{ leaseUntil: number }>('job', 'due', 'owner-a', false);
    assert.ok(claimed!.leaseUntil > now);
  } finally { database.close(); }
});

test('provider settings encrypt with unique nonces and reject tampered ciphertext', async () => {
  const first = await encrypt({ apiKey: 'test-secret-value' });
  const second = await encrypt({ apiKey: 'test-secret-value' });
  assert.notEqual(first, second);
  assert.ok(!first.includes('test-secret-value'));
  assert.deepEqual(await decrypt(first), { apiKey: 'test-secret-value' });
  const bytes = Uint8Array.from(atob(first), char => char.charCodeAt(0));
  bytes[bytes.length - 1] ^= 1;
  await assert.rejects(decrypt(btoa(String.fromCharCode(...bytes))));
});

test('demo replacement is transactional and preserves visitor data', async () => {
  const database = resetDatabase();
  try {
    await saveRecord('person', { id: 'old' }, DEMO_OWNER);
    await saveRecord('person', { id: 'visitor' }, 'owner-a');
    await replaceDemo([{ id: 'new' }], [{ id: 'new-date' }], 'seed-new');
    assert.equal(await getRecord('person', 'old', 'owner-a'), null);
    assert.ok(await getRecord('person', 'new', 'owner-a'));
    assert.ok(await getRecord('person', 'visitor', 'owner-a', false));
    await assert.rejects(replaceDemo([{ id: 'duplicate' }, { id: 'duplicate' }], [], 'bad-version'));
    assert.ok(await getRecord('person', 'new', 'owner-a'), 'failed replacement must roll back its delete');
    assert.equal(await getRecord('meta', 'bad-version', DEMO_OWNER, false), null);
  } finally { database.close(); }
});


test('anonymous model budget is atomic across sessions and opens only after the interval', async () => {
  const database = resetDatabase();
  try {
    const now = Date.now();
    const contenders = await Promise.all([reserveAnonymousModel(now), reserveAnonymousModel(now)]);
    assert.equal(contenders.filter(Boolean).length, 1);
    assert.equal(await reserveAnonymousModel(now + 44_999), false);
    assert.equal(await reserveAnonymousModel(now + 45_000), true);
  } finally { database.close(); }
});
