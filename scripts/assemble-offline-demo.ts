import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { rankPeople } from '../src/lib/engine';
import { validatePeople } from './build-demo';
import type { DateSession, PersonAnalysis } from '../src/lib/types';

const read = async <T,>(path: string): Promise<T> => JSON.parse(await readFile(path, 'utf8')) as T;
const people = validatePeople(await read('data/verified-people.json'), 25);
const analyses = await read<{ personId: string; analysis: PersonAnalysis }[]>('data/offline-analyses.json');
const dates = await read<(DateSession & { agentIds: Record<string, string>; isolation: string; agentRuntime: string })[]>('data/offline-dates.json');
const personAgents = new Map<string, string>();
assert.equal(people.length, 25, 'The selected cohort must contain exactly 25 people.');
assert.equal(analyses.length, 25, 'Every person needs an offline model analysis.');
assert.equal(new Set(analyses.map(item => item.personId)).size, 25);
let claims = 0;
for (const person of people) {
  const analysis = analyses.find(item => item.personId === person.id)?.analysis;
  assert.ok(analysis, `${person.name} has no model analysis.`);
  assert.equal(analysis.mode, 'llm');
  assert.equal(analysis.model, 'Codex offline analysis');
  assert.ok(analysis.claims.length >= 1 && analysis.claims.length <= 8);
  assert.ok(analysis.summary && analysis.summary.isWellFormed());
  const ids = new Set<string>();
  for (const claim of analysis.claims) {
    assert.ok(!ids.has(claim.id)); ids.add(claim.id); claims++;
    assert.ok(['interest', 'hobby', 'need', 'quality', 'work', 'routine'].includes(claim.category));
    assert.ok(['observed', 'inferred'].includes(claim.kind));
    assert.ok(claim.confidence >= 0 && claim.confidence <= (claim.kind === 'inferred' ? 0.75 : 1));
    if (claim.category === 'need') assert.equal(claim.kind, 'observed');
    assert.ok(claim.evidence.length >= 1);
    for (const evidence of claim.evidence) {
      const source = person.sources.find(item => item.id === evidence.sourceId);
      assert.ok(source?.content.includes(evidence.quote), `${person.name}: unsupported quote in ${claim.id}`);
      assert.ok(evidence.quote.length <= 160 && evidence.quote.isWellFormed());
    }
  }
  for (const [field, category] of [['interests', 'interest'], ['hobbies', 'hobby'], ['needs', 'need']] as const) {
    assert.deepEqual(analysis[field], analysis.claims.filter(claim => claim.category === category).map(claim => claim.text));
  }
  person.analysis = analysis; person.status = 'ready'; person.updatedAt = analysis.createdAt;
}

assert.equal(dates.length, 25, 'All 25 scheduled dates must finish.');
assert.equal(new Set(dates.map(date => date.id)).size, 25);
const pairKeys = new Set<string>();
const count = new Map(people.map(person => [person.id, 0]));
const personById = new Map(people.map(person => [person.id, person]));
for (const date of dates) {
  assert.equal(date.status, 'complete'); assert.equal(date.mode, 'llm'); assert.equal(date.generation, 'offline');
  assert.equal(date.model, 'Codex agents (offline)');
  const a = personById.get(date.personAId); const b = personById.get(date.personBId);
  assert.ok(a && b && a.id !== b.id);
  date.profileSnapshots = { [a.id]: structuredClone(a), [b.id]: structuredClone(b) };
  assert.equal(date.agentRuntime, 'Codex collaboration subagents');
  assert.ok(date.isolation.includes('own dossier'));
  for (const person of [a, b]) {
    const agent = date.agentIds[person.id]; assert.ok(typeof agent === 'string' && agent.length > 3);
    if (personAgents.has(person.id)) assert.equal(personAgents.get(person.id), agent, 'Each person keeps one retained agent.');
    personAgents.set(person.id, agent);
  }
  const key = [a.id, b.id].sort().join(':'); assert.ok(!pairKeys.has(key)); pairKeys.add(key);
  count.set(a.id, count.get(a.id)! + 1); count.set(b.id, count.get(b.id)! + 1);
  assert.equal(date.turns.length, 6); assert.equal(date.assessments.length, 2);
  date.turns.forEach((turn, index) => {
    const self = index % 2 ? b : a;
    assert.equal(turn.personId, self.id); assert.equal(turn.turn, index + 1);
    assert.equal(turn.action, ['propose', 'respond', 'adapt', 'reflect', 'explore', 'connect'][index]);
    assert.equal(turn.mode, 'llm'); assert.ok(turn.message.isWellFormed());
    const words = turn.message.trim().split(/\s+/).length;
    assert.ok(words >= 35 && words <= 65, `${date.id} turn ${index + 1}: ${words} words.`);
    assert.ok(turn.evidenceIds.length > 0);
    assert.ok(turn.evidenceIds.every(id => self.analysis!.claims.some(claim => claim.id === id)));
  });
  for (const self of [a, b]) {
    const assessment = date.assessments.find(item => item.personId === self.id);
    assert.ok(assessment); assert.equal(assessment.counterpartId, self.id === a.id ? b.id : a.id);
    assert.ok(Number.isInteger(assessment.score) && assessment.score >= 0 && assessment.score <= 100);
    assert.ok(['yes', 'maybe', 'no'].includes(assessment.secondDate)); assert.equal(assessment.mode, 'llm');
    assert.ok(assessment.evidenceIds.length > 0 && assessment.evidenceIds.every(id => self.analysis!.claims.some(claim => claim.id === id)));
    assert.ok([assessment.connection, assessment.tension, assessment.question].every(text => typeof text === 'string' && text.length > 12));
  }
}
assert.equal(personAgents.size, 25);
assert.equal(new Set(personAgents.values()).size, 25, 'Every person must have its own distinct agent.');
assert.ok([...count.values()].every(value => value === 2), 'Every agent must have two completed dates.');
for (const person of people) {
  const rankings = rankPeople(person, people, dates);
  assert.equal(rankings.length, 24);
  assert.equal(rankings.filter(entry => entry.basis === 'date').length, 2);
  assert.ok(rankings.every(entry => Number.isFinite(entry.score)));
}

const state = {
  version: 'offline-codex-v1', mode: 'llm', model: 'Codex agents (offline)', generation: 'offline',
  people, dates, complete: true, updatedAt: new Date().toISOString(),
  sourceFingerprint: createHash('sha256').update(JSON.stringify(people.map(person => ({ id: person.id, linkedinUrl: person.linkedinUrl, instagramUrl: person.instagramUrl, sources: person.sources })))).digest('hex'),
  note: 'Saved replay of independently contextualized Codex person agents. New live dates use the separately configured runtime provider.',
};
await writeFile('data/seed.json.tmp', JSON.stringify(state, null, 2) + '\n');
await rename('data/seed.json.tmp', 'data/seed.json');
const audit = { generatedAt: state.updatedAt, model: state.model, generation: state.generation, people: people.length, distinctPersonAgents: personAgents.size, claims, dates: dates.length, turns: dates.length * 6, independentAssessments: dates.length * 2, datesPerPerson: 2, rankedCandidatesPerPerson: 24, sourceFingerprint: state.sourceFingerprint, method: state.note };
await writeFile('data/generation-audit.json', JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify(audit));
