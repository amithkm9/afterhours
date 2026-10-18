import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemo, parseOptions, validatePeople } from '../scripts/build-demo';

test('demo builder refuses implicit model fallback when no API key exists', async () => {
  const options = parseOptions([]);
  assert.equal(options.rulesPreview, false);
  await assert.rejects(buildDemo(options, {}), /GROQ_API_KEY is required/);
});

test('rules preview is explicit and CLI limits preserve free-tier reserve', () => {
  const options = parseOptions(['--rules-preview', '--minimum', '2', '--token-budget', '150000']);
  assert.equal(options.rulesPreview, true);
  assert.equal(options.minimum, 2);
  assert.equal(options.tokenBudget, 150000);
  assert.throws(() => parseOptions(['--token-budget', '500000']), /reserve free-tier capacity/);
  assert.throws(() => parseOptions(['--input']), /requires a value/);
});

test('demo builder refuses an empty or unverified cohort', () => {
  assert.throws(() => validatePeople({ people: [] }, 25), /at least 25/);
  assert.throws(() => validatePeople([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 2), /verified identity pair/);
});
