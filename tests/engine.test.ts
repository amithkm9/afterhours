import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzePerson, assessDate, createDateSession, generateDateTurn, rankPeople, runDate, schedulePairs } from '../src/lib/engine';
import { fetchPublicProfiles, parsePublicInstagramHtml, parsePublicLinkedinHtml, sourceFromActor, startImport } from '../src/lib/providers';
import { EngineError, normalizeProfileUrls, verifyProfileIdentity, verifySources } from '../src/lib/validation';
import type { Person, SourceDocument } from '../src/lib/types';

const timestamp = '2026-10-19T00:00:00.000Z';
function profile(id: string, linkedin = 'Founder and software engineer. I enjoy photography.', instagram = 'Photography, hiking and travel.'): Person {
  const sources: SourceDocument[] = [
    { id: `${id}-li`, platform: 'linkedin', url: `https://www.linkedin.com/in/${id}/`, status: 'ready', retrievedAt: timestamp, content: `Name: ${id}\nAbout: ${linkedin}`, metadata: { isPublic: true } },
    { id: `${id}-ig`, platform: 'instagram', url: `https://www.instagram.com/${id}/`, status: 'ready', retrievedAt: timestamp, content: `Name: ${id}\nBio: ${instagram}`, metadata: { isPublic: true } },
  ];
  return { id, name: id, linkedinUrl: sources[0].url, instagramUrl: sources[1].url, sources, status: 'analyzing', createdAt: timestamp, updatedAt: timestamp };
}
async function ready(id: string, linkedin?: string, instagram?: string): Promise<Person> {
  const person = profile(id, linkedin, instagram);
  person.analysis = await analyzePerson(person);
  person.status = 'ready';
  return person;
}
function mockedModel(value: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) }, finish_reason: 'stop' }] }), { headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
}

test('normalizes official personal URLs and removes tracking parameters', () => {
  assert.deepEqual(normalizeProfileUrls({ linkedinUrl: 'http://fr.linkedin.com/in/Some-Person?trk=foo', instagramUrl: 'https://instagram.com/Some.Person/?igsh=foo' }), {
    linkedinUrl: 'https://www.linkedin.com/in/some-person/', instagramUrl: 'https://www.instagram.com/some.person/',
  });
});

test('rejects lookalike hosts, credentials, company links, posts, and encoded traversal', () => {
  const valid = { linkedinUrl: 'https://linkedin.com/in/person', instagramUrl: 'https://instagram.com/person' };
  for (const linkedinUrl of ['https://linkedin.com.evil.test/in/person', 'https://user:pass@linkedin.com/in/person', 'https://linkedin.com/company/team', 'https://linkedin.com/in/a%2fb', 'file:///in/person']) {
    assert.throws(() => normalizeProfileUrls({ ...valid, linkedinUrl }), EngineError);
  }
  for (const instagramUrl of ['https://instagram.com/p/post', 'https://instagram.com/reels/', 'https://instagram.com:444/person', 'https://evil.test/person']) {
    assert.throws(() => normalizeProfileUrls({ ...valid, instagramUrl }), EngineError);
  }
});

test('analysis fails closed without exactly two readable, matching sources and verified public Instagram', async () => {
  const person = profile('testperson');
  assert.throws(() => verifySources(person.sources.slice(0, 1)), /exactly one/);
  person.sources[1].metadata!.isPublic = false;
  await assert.rejects(analyzePerson(person), /confirmed public/);
  person.sources[1].metadata!.isPublic = true;
  person.sources[1].url = 'https://www.instagram.com/different/';
  await assert.rejects(analyzePerson(person), /does not match/);
});

test('clear cross-person profile pairs are rejected and name matches do not prove identity', async () => {
  const person = profile('identityperson');
  person.sources[0].metadata!.name = 'Taylor Example';
  person.sources[1].metadata!.name = 'Jordan Different';
  await assert.rejects(analyzePerson(person), /different people/);
  person.sources[1].metadata!.name = 'Taylor Example';
  assert.equal(verifyProfileIdentity(person.sources), 'unverified');
  person.sources[1].content += '\nOfficial LinkedIn: https://www.linkedin.com/in/identityperson/';
  assert.equal(verifyProfileIdentity(person.sources), 'verified');
});

test('rules analysis keeps evidence, unknowns and mode explicit without invented needs', async () => {
  const person = await ready('rulesperson');
  assert.equal(person.analysis!.mode, 'rules');
  assert.ok(person.analysis!.hobbies.includes('Photography'));
  assert.deepEqual(person.analysis!.needs, []);
  assert.ok(person.analysis!.unknowns.some(value => value.includes('availability')));
  for (const claim of person.analysis!.claims) for (const ref of claim.evidence) {
    assert.ok(person.sources.find(source => source.id === ref.sourceId)!.content.includes(ref.quote));
  }
});

test('source excerpts keep emoji pairs intact at the truncation boundary', async () => {
  const person = await ready('unicodeperson', 'Author.', 'Author' + ' '.repeat(94) + '🧠 More context');
  for (const claim of person.analysis!.claims) for (const reference of claim.evidence) {
    assert.equal(reference.quote.isWellFormed(), true);
    assert.ok(person.sources.find(source => source.id === reference.sourceId)!.content.includes(reference.quote));
  }
});

test('model analysis rejects fabricated evidence and inferred personal needs', async () => {
  const person = profile('sourceperson');
  const claim = { category: 'interest', text: 'Astronomy', kind: 'observed', confidence: 0.9, evidence: [{ sourceId: 'sourceperson-li', quote: 'I love astronomy' }] };
  await assert.rejects(analyzePerson(person, { groqApiKey: 'test', fetchImpl: mockedModel({ claims: [claim] }) }), /does not exist/);
  await assert.rejects(analyzePerson(person, { groqApiKey: 'test', fetchImpl: mockedModel({ claims: [{ ...claim, category: 'need', kind: 'inferred', text: 'Needs an adventurous partner' }] }) }), /inferred a personal need/);
});

test('model analysis validates schema and derives the summary only from supported claims', async () => {
  const person = profile('grounded');
  const claim = { category: 'hobby', text: 'Photography', kind: 'inferred', confidence: 0.99, evidence: [{ sourceId: 'grounded-li', quote: 'I enjoy photography.' }] };
  const analysis = await analyzePerson(person, { groqApiKey: 'test', fetchImpl: mockedModel({ claims: [claim] }) });
  assert.equal(analysis.mode, 'llm');
  assert.equal(analysis.summary, 'Photography.');
  assert.equal(analysis.claims[0].confidence, 0.75);
  await assert.rejects(analyzePerson(person, { groqApiKey: 'test', fetchImpl: mockedModel({ claims: 'not-an-array' }) }), /invalid type/);
});

test('a full rules date alternates, responds, adapts and records two independent assessments', async () => {
  const a = await ready('alpha'); const b = await ready('beta', 'Designer and author.', 'Photography and cooking.');
  const date = await runDate(a, b);
  assert.equal(date.status, 'complete');
  assert.equal(date.mode, 'rules');
  assert.deepEqual(date.turns.map(turn => turn.personId), ['alpha', 'beta', 'alpha', 'beta', 'alpha', 'beta']);
  assert.deepEqual(date.turns.map(turn => turn.action), ['propose', 'respond', 'adapt', 'reflect', 'explore', 'connect']);
  assert.match(date.turns[1].message, /flexible/);
  assert.match(date.turns[2].message, /changes the plan/);
  assert.deepEqual(date.assessments.map(assessment => assessment.personId), ['alpha', 'beta']);
  await assert.rejects(generateDateTurn(date, a, b), /six conversation turns/);
});

test('date generation rejects an out-of-order session and cross-person evidence references', async () => {
  const a = await ready('speaker'); const b = await ready('counterpart');
  const date = createDateSession(a.id, b.id, 'llm');
  await assert.rejects(generateDateTurn(date, a, b, { groqApiKey: 'test', fetchImpl: mockedModel({ message: 'Let us talk about our projects.', evidenceIds: [b.analysis!.claims[0].id] }) }), /outside its own verified profile/);
  date.turns = [{ id: 'wrong', personId: b.id, turn: 1, message: 'Wrong order', evidenceIds: [], action: 'propose', mode: 'rules', createdAt: timestamp }];
  await assert.rejects(generateDateTurn(date, a, b), /must alternate/);
});

test('rankings are directional, separate dated from untested, and rules dates do not inflate scores', async () => {
  const a = await ready('focused', 'Photographer.', 'Photography.');
  const b = await ready('broad', 'Founder and software engineer.', 'Photography, hiking, travel, cooking and music.');
  const c = await ready('third', 'A writer and teacher.', 'Books and education.');
  const ab = rankPeople(a, [a, b, c]).find(entry => entry.candidateId === b.id)!;
  const ba = rankPeople(b, [a, b, c]).find(entry => entry.candidateId === a.id)!;
  assert.ok(ab.profileScore > ba.profileScore);
  assert.equal(ab.basis, 'profile');
  const date = await runDate(a, b);
  const ranked = rankPeople(a, [a, b, c], [date]);
  assert.equal(ranked.find(entry => entry.candidateId === b.id)!.basis, 'date');
  assert.equal(ranked.find(entry => entry.candidateId === b.id)!.score, ab.score);
  assert.equal(ranked.find(entry => entry.candidateId === c.id)!.basis, 'profile');
  assert.ok(ranked.every(entry => entry.candidateId !== a.id));
});

test('25-person schedule has 25 unique pairs and exactly two dates per person', async () => {
  const people = await Promise.all(Array.from({ length: 25 }, (_, index) => ready(`person${index}`)));
  const pairs = schedulePairs(people);
  assert.equal(pairs.length, 25);
  assert.equal(new Set(pairs.map(pair => [pair.personAId, pair.personBId].sort().join(':'))).size, 25);
  for (const person of people) assert.equal(pairs.filter(pair => pair.personAId === person.id || pair.personBId === person.id).length, 2);
  assert.equal(schedulePairs(people.slice(0, 2)).length, 1);
  assert.equal(schedulePairs(people.slice(0, 1)).length, 0);
});

test('Apify starts use fixed actors, no email enrichment, capped spend and secret headers', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const platform = String(url).includes('instagram') ? 'instagram' : 'linkedin';
    return Response.json({ data: { id: `${platform}run`, defaultDatasetId: `${platform}data`, status: 'RUNNING' } });
  }) as typeof fetch;
  const person = profile('importperson');
  const job = await startImport(person, { apifyToken: 'secret-test-key', fetchImpl });
  assert.equal(job.runs.length, 2);
  assert.equal(job.status, 'running');
  for (const call of calls) {
    assert.match(call.url, /maxTotalChargeUsd=0.02/);
    assert.ok(!call.url.includes('secret-test-key'));
    assert.equal((call.init.headers as Record<string, string>).Authorization, 'Bearer secret-test-key');
  }
  const linkedinBody = JSON.parse(String(calls.find(call => call.url.includes('linkedin'))!.init.body));
  assert.equal(linkedinBody.profileScraperMode, 'Profile details no email ($4 per 1k)');
});

test('actor extraction rejects private or mismatched Instagram and drops unrelated content', () => {
  const url = 'https://www.instagram.com/owner/';
  assert.throws(() => sourceFromActor('instagram', { username: 'owner', isPrivate: true, biography: 'Hello' }, url), /private/);
  assert.throws(() => sourceFromActor('instagram', { username: 'owner', isPrivate: false, private: true, biography: 'Hello' }, url), /private/);
  assert.throws(() => sourceFromActor('instagram', { username: 'other', isPrivate: false, biography: 'Hello' }, url), /different account/);
  const source = sourceFromActor('instagram', { username: 'owner', isPrivate: false, biography: 'Photography', relatedProfiles: [{ biography: 'Third-party secret' }], latestPosts: [{ ownerUsername: 'other', caption: 'Unrelated content' }, { ownerUsername: 'owner', caption: 'I enjoy hiking.' }] }, url);
  assert.match(source.content, /I enjoy hiking/);
  assert.doesNotMatch(source.content, /Third-party|Unrelated/);
  assert.equal(sourceFromActor('instagram', { username: 'owner', private: false, biography: 'Photography' }, url).metadata!.isPublic, true);
});

function publicEmbed(username: string, isPrivate: boolean, caption = 'I enjoy photography and hiking.'): string {
  const context = { username, full_name: 'Test Person', graphql_media: [{ shortcode_media: { shortcode: 'POST1', owner: { username, is_private: isPrivate }, edge_media_to_caption: { edges: [{ node: { text: caption } }] } } }] };
  return `<script type="application/json">${JSON.stringify({ contextJSON: JSON.stringify({ context }) })}</script>`;
}

test('direct Instagram parser requires username-bound public flag and preserves real captions', () => {
  const url = 'https://www.instagram.com/publicperson/';
  const html = '<meta content="Test Person on Instagram: &quot;I write &amp; photograph.&quot;" name="description">';
  assert.throws(() => parsePublicInstagramHtml(html, '', url), /public visibility/);
  assert.throws(() => parsePublicInstagramHtml(html, publicEmbed('other', false), url), /public visibility/);
  assert.throws(() => parsePublicInstagramHtml(html, publicEmbed('publicperson', true), url), /private/);
  const source = parsePublicInstagramHtml(html, publicEmbed('publicperson', false), url);
  assert.equal(source.metadata!.isPublic, true);
  assert.equal(source.metadata!.provenance, 'public-page');
  assert.match(source.content, /I write & photograph/);
  assert.match(source.content, /I enjoy photography and hiking/);
  assert.match(source.content, /https:\/\/www.instagram.com\/p\/POST1\//);
});

test('direct LinkedIn parser rejects an authwall and extracts only a matching structured person', () => {
  const url = 'https://www.linkedin.com/in/publicperson/';
  assert.throws(() => parsePublicLinkedinHtml('<script>location.href="/authwall"</script>', url), /did not expose/);
  assert.throws(() => parsePublicLinkedinHtml('<script type="application/ld+json">{"@type":"Person","name":"Unbound Person","description":"Author."}</script>', url), /did not identify/);
  const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'Person', name: 'Public Person', url, description: 'An author and teacher.', jobTitle: 'Writer' })}</script>`;
  const source = parsePublicLinkedinHtml(html, url);
  assert.equal(source.metadata!.name, 'Public Person');
  assert.match(source.content, /An author and teacher/);
});

test('LinkedIn ingestion requires an exact official profile URL even when an identifier matches', () => {
  const url = 'https://www.linkedin.com/in/publicperson/';
  const row = { '@type': 'Person', name: 'Public Person', description: 'An author and teacher.' };
  for (const returnedUrl of ['https://www.linkedin.com/company/publicperson/', `${url}extra/`, 'https://linkedin.com.evil.test/in/publicperson/', 'https://www.linkedin.com/in/publicperson-other/']) {
    const html = `<script type="application/ld+json">${JSON.stringify({ ...row, url: returnedUrl })}</script>`;
    assert.throws(() => parsePublicLinkedinHtml(html, url), /different account/);
    assert.throws(() => sourceFromActor('linkedin', { publicIdentifier: 'publicperson', linkedinUrl: returnedUrl, fullName: row.name, about: row.description }, url), /different account/);
  }
  const graph = { '@graph': [{ ...row, url: `${url}extra/` }, { ...row, url: 'https://fr.linkedin.com/in/publicperson?trk=test' }] };
  const source = parsePublicLinkedinHtml(`<script type="application/ld+json">${JSON.stringify(graph)}</script>`, url);
  assert.equal(source.metadata!.name, 'Public Person');
});

test('no-token public import refuses redirected external destinations', async () => {
  const person = profile('noexternals');
  let calls = 0;
  const fetchImpl = (async () => { calls++; return new Response('', { status: 302, headers: { Location: 'http://127.0.0.1/private' } }); }) as typeof fetch;
  await assert.rejects(fetchPublicProfiles(person, { fetchImpl }), /redirected this profile/);
  assert.equal(calls, 3);
});

test('provider authorization errors do not echo upstream responses or credentials', async () => {
  const person = profile('rateperson');
  await assert.rejects(analyzePerson(person, { groqApiKey: 'a-secret-key', fetchImpl: (async () => new Response('a-secret-key leaked upstream', { status: 401 })) as typeof fetch }), error => {
    assert.ok(error instanceof EngineError);
    assert.equal(error.code, 'PROVIDER_AUTH');
    assert.ok(!error.message.includes('a-secret-key'));
    return true;
  });
});


test('anonymous model requests use no authorization and rate limits remain retryable', async () => {
  const person = profile('anonymousperson');
  const fetchImpl = (async (url: string | URL | Request, init: RequestInit = {}) => {
    assert.equal(String(url), 'https://text.pollinations.ai/openai');
    assert.equal((init.headers as Record<string, string>).Authorization, undefined);
    assert.equal(JSON.parse(String(init.body)).model, 'openai-fast');
    return Response.json({ error: { code: 'FREE_LIMIT' } }, { status: 402 });
  }) as typeof fetch;
  await assert.rejects(analyzePerson(person, { anonymousModel: true, fetchImpl }), error => {
    assert.ok(error instanceof EngineError);
    assert.equal(error.code, 'PROVIDER_RATE_LIMIT');
    assert.equal(error.retryable, true);
    return true;
  });
});


test('a professional skill alone is not displayed as an observed hobby', async () => {
  const person = profile('skillperson', 'I work in content creation.', 'Author and writer.');
  const result = await analyzePerson(person, { anonymousModel: true, fetchImpl: mockedModel({ claims: [{ category: 'hobby', text: 'Content creation', kind: 'observed', confidence: 1, evidence: [{sourceId:'skillperson-li',quote:'I work in content creation.'}] }] }) });
  assert.deepEqual(result.hobbies, []);
  assert.equal(result.claims[0].category, 'interest');
  assert.equal(result.claims[0].kind, 'inferred');
  assert.equal(result.claims[0].confidence, 0.75);
});


test('model dialogue rejects a plausible but unsourced autobiographical routine', async () => {
  const a=await ready('routine_a'); const b=await ready('routine_b');
  const date=createDateSession(a.id,b.id,'llm');
  await assert.rejects(generateDateTurn(date,a,b,{anonymousModel:true,fetchImpl:mockedModel({message:"I've been experimenting with a daily podcast-editing routine. What works for you?",evidenceIds:[a.analysis!.claims[0].id]})}), error=>{
    assert.ok(error instanceof EngineError);assert.equal(error.code,'UNSUPPORTED_DIALOGUE');assert.equal(error.retryable,true);return true;
  });
});


test('substantive runtime dialogue must supply an exact quote from its own cited evidence', async () => {
  const a=await ready('quotedself'); const b=await ready('quotedother');
  const date=await runDate(a,b);date.mode='llm';date.status='running';date.turns=date.turns.slice(0,4);date.assessments=[];
  const claim=a.analysis!.claims[0];const quote=claim.evidence[0].quote;
  await assert.rejects(generateDateTurn(date,a,b,{anonymousModel:true,fetchImpl:mockedModel({message:'One idea worth exploring is how we make time for something creative. What makes it feel worthwhile to you?',evidenceIds:[claim.id],groundingQuote:'This quote is not in the source.'})}),/must supply an exact phrase/);
  const turn=await generateDateTurn(date,a,b,{anonymousModel:true,fetchImpl:mockedModel({message:`My source says “${quote}”. One idea worth exploring is how creative work changes our attention. What do you think?`,evidenceIds:[claim.id],groundingQuote:quote})});
  assert.equal(turn.action,'explore');assert.equal(turn.personId,a.id);assert.ok(turn.message.includes(quote));assert.equal(turn.groundingQuote,quote);
});

test('identity cross-links require the exact official account, not a substring in another URL', () => {
  const person = profile('identityperson');
  for (const misleading of [
    'https://evil.test/linkedin.com/in/identityperson',
    'https://www.linkedin.com/in/identityperson-other/',
    'https://linkedin.com@evil.test/in/identityperson/',
    'https://evil.test/?target=linkedin.com/in/identityperson',
  ]) {
    person.sources[1].content = `Bio: Portfolio ${misleading}`;
    assert.equal(verifyProfileIdentity(person.sources), 'unverified', misleading);
  }
  for (const valid of ['https://www.linkedin.com/in/identityperson/?trk=bio', 'linkedin.com/in/identityperson/', '(https://fr.linkedin.com/in/identityperson/)']) {
    person.sources[1].content = `Bio: Portfolio ${valid}`;
    assert.equal(verifyProfileIdentity(person.sources), 'verified', valid);
  }
});

test('date snapshots preserve original evidence after profile reanalysis and stale dates leave rankings', async () => {
  const a = await ready('original_a'); const b = await ready('original_b');
  const date = await runDate(a, b);
  const originalClaim = structuredClone(a.analysis!.claims[0]);
  const originalAnalysis = structuredClone(a.analysis!);
  assert.notEqual(date.profileSnapshots![a.id], a);
  assert.equal(rankPeople(a, [a, b], [date])[0].basis, 'date');
  a.analysis = { ...a.analysis!, createdAt: '2099-01-01T00:00:00.000Z', claims: [{ ...originalClaim, id: 'new-unrelated-claim', text: 'New analysis' }] };
  assert.deepEqual(date.profileSnapshots![a.id].analysis, originalAnalysis);
  assert.equal(rankPeople(a, [a, b], [date])[0].basis, 'profile');
  assert.equal(rankPeople(a, [a, b], [date])[0].dateId, undefined);
  // A date already in progress keeps the dossier it began with, even if current analysis fails.
  a.status = 'failed';
  const continuing = { ...date, status: 'running' as const, mode: 'llm' as const, turns: [], assessments: [] };
  const turn = await generateDateTurn(continuing, a, b, { anonymousModel: true, fetchImpl: mockedModel({ message: "I'd suggest a short conversation about the project in my original profile. What would you like to explore?", evidenceIds: [originalClaim.id] }) });
  assert.deepEqual(turn.evidenceIds, [originalClaim.id]);
  const assessment = await assessDate({ ...date, mode: 'llm' }, a, b, { anonymousModel: true, fetchImpl: mockedModel({ score: 65, connection: 'We explored a documented interest.', tension: 'Personal expectations remain unknown.', question: 'What pace would work?', secondDate: 'maybe', evidenceIds: [originalClaim.id] }) });
  assert.deepEqual(assessment.evidenceIds, [originalClaim.id]);
});
