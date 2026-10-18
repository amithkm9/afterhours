/**
 * Build a resumable cohort from verified, saved LinkedIn/Instagram sources.
 * node --import tsx scripts/build-demo.ts --rules-preview
 * GROQ_API_KEY=... node --import tsx scripts/build-demo.ts
 * Credentials are read only from the environment and never written to artifacts.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzePerson, assessDate, createDateSession, generateDateTurn, schedulePairs } from '../src/lib/engine';
import { DEFAULT_MODEL } from '../src/lib/providers';
import { EngineError, safeError, verifySources } from '../src/lib/validation';
import type { DateSession, EngineMode, Person, ProviderConfig } from '../src/lib/types';

export interface BuildOptions {
  input: string;
  output: string;
  rulesPreview: boolean;
  minimum: number;
  intervalMs: number;
  tokenBudget: number;
}
interface DemoState {
  version: string;
  mode: EngineMode;
  people: Person[];
  dates: DateSession[];
  updatedAt: string | null;
  complete: boolean;
  inputFingerprint: string;
  usage: { calls: number; inputTokens: number; outputTokens: number; totalTokens: number };
  model?: string;
  note: string;
}

export function parseOptions(args: string[]): BuildOptions {
  const option = (name: string, fallback: string) => {
    const index = args.indexOf(name);
    if (index < 0) return fallback;
    if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${name} requires a value.`);
    return args[index + 1];
  };
  const known = new Set(['--input', '--output', '--minimum', '--interval-ms', '--token-budget', '--rules-preview']);
  for (const arg of args.filter(value => value.startsWith('--'))) if (!known.has(arg)) throw new Error(`Unknown option ${arg}.`);
  const minimum = Number(option('--minimum', '25'));
  const intervalMs = Number(option('--interval-ms', '6000'));
  const tokenBudget = Number(option('--token-budget', '170000'));
  if (!Number.isInteger(minimum) || minimum < 2 || minimum > 100) throw new Error('--minimum must be an integer from 2 to 100.');
  if (!Number.isInteger(intervalMs) || intervalMs < 0 || intervalMs > 60000) throw new Error('--interval-ms must be between 0 and 60000.');
  if (!Number.isInteger(tokenBudget) || tokenBudget < 1000 || tokenBudget > 190000) throw new Error('--token-budget must be between 1000 and 190000 to reserve free-tier capacity.');
  return {
    input: resolve(option('--input', existsSync('data/verified-people.json') ? 'data/verified-people.json' : 'data/seed.json')),
    output: resolve(option('--output', 'data/seed.json')),
    rulesPreview: args.includes('--rules-preview'), minimum, intervalMs, tokenBudget,
  };
}

export function validatePeople(value: unknown, minimum: number): Person[] {
  const input = Array.isArray(value) ? value : value && typeof value === 'object' ? (value as { people?: unknown }).people : undefined;
  if (!Array.isArray(input) || input.length < minimum) throw new Error(`Need at least ${minimum} real people with verified source pairs.`);
  const people = input as Person[];
  const seen = new Set<string>();
  const linkedin = new Set<string>();
  const instagram = new Set<string>();
  for (const person of people) {
    if (!person || typeof person.id !== 'string' || typeof person.name !== 'string' || !person.name.trim()) throw new Error('Every person needs an ID and name.');
    if (seen.has(person.id) || linkedin.has(person.linkedinUrl) || instagram.has(person.instagramUrl)) throw new Error('The cohort contains duplicate people or profile accounts.');
    if (person.identityStatus !== 'verified') throw new Error(`${person.name}: the two accounts have not been marked as a verified identity pair.`);
    verifySources(person.sources, person);
    seen.add(person.id); linkedin.add(person.linkedinUrl); instagram.add(person.instagramUrl);
  }
  return people;
}

async function atomicWrite(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await rename(temporary, path);
}
const pause = (ms: number) => new Promise<void>(resolvePromise => setTimeout(resolvePromise, ms));

export async function buildDemo(options: BuildOptions, environment: { GROQ_API_KEY?: string; GROQ_MODEL?: string } = { GROQ_API_KEY: process.env.GROQ_API_KEY, GROQ_MODEL: process.env.GROQ_MODEL }): Promise<DemoState> {
  if (!options.rulesPreview && !environment.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is required for the AI demo. Use --rules-preview only for an explicitly labelled rules-based preview. No seed was changed.');
  }
  const sourcePeople = validatePeople(JSON.parse(await readFile(options.input, 'utf8')), options.minimum);
  const mode: EngineMode = options.rulesPreview ? 'rules' : 'llm';
  const fingerprint = createHash('sha256').update(JSON.stringify({ protocol: 'six-turn-v1', people: sourcePeople.map(person => ({ id: person.id, name: person.name, sources: person.sources })) })).digest('hex');
  const checkpointPath = `${options.output}.${mode}.checkpoint`;
  const model = environment.GROQ_MODEL || DEFAULT_MODEL;
  let state: DemoState = {
    version: `cohort-${fingerprint.slice(0, 12)}-${mode}`,
    mode, people: sourcePeople.map(person => ({ ...person, analysis: undefined, status: 'analyzing' })), dates: [],
    updatedAt: null, complete: false, inputFingerprint: fingerprint,
    usage: { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    ...(mode === 'llm' ? { model } : {}),
    note: mode === 'rules'
      ? 'Rules-based preview using real, source-backed profiles. Conversations are deterministic simulations, not model-generated agent dates. Connect Groq and rebuild for AI agents.'
      : 'AI-generated simulations grounded in the saved LinkedIn and public Instagram sources. The people did not participate; dialogue is not evidence of their real preferences.',
  };
  if (existsSync(checkpointPath)) {
    const saved = JSON.parse(await readFile(checkpointPath, 'utf8')) as DemoState;
    if (saved.inputFingerprint === fingerprint && saved.mode === mode && (mode === 'rules' || saved.model === model)) state = saved;
  }
  // Updating portrait paths or identity notes does not invalidate expensive completed analyses.
  state.people = state.people.map(person => ({ ...sourcePeople.find(source => source.id === person.id)!, analysis: person.analysis, status: person.status, updatedAt: person.updatedAt }));
  let nextRequestAt = 0;
  const config: ProviderConfig = options.rulesPreview ? {} : {
    groqApiKey: environment.GROQ_API_KEY,
    groqModel: model,
    fetchImpl: (async (input: string | URL | Request, init?: RequestInit) => {
      if (state.usage.totalTokens >= options.tokenBudget) throw new EngineError('BUILD_TOKEN_BUDGET', 'The local demo token budget was reached. The checkpoint is saved; no automatic paid fallback is used.');
      const wait = Math.max(0, nextRequestAt - Date.now());
      if (wait) await pause(Math.min(wait, 60000));
      nextRequestAt = Date.now() + options.intervalMs;
      state.usage.calls += 1;
      return fetch(input, { ...init, signal: AbortSignal.timeout(55_000) });
    }) as typeof fetch,
    onUsage: usage => {
      state.usage.inputTokens += usage.inputTokens;
      state.usage.outputTokens += usage.outputTokens;
      state.usage.totalTokens += usage.totalTokens;
      // Aim below the documented 8K TPM free limit. Exact account limits can differ.
      nextRequestAt = Math.max(nextRequestAt, Date.now() + Math.min(55000, Math.ceil(usage.totalTokens / 115 * 1000)));
    },
  };
  const save = async () => {
    state.updatedAt = new Date().toISOString();
    await atomicWrite(checkpointPath, state);
  };
  const retry = async <T>(operation: () => Promise<T>): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      try { return await operation(); }
      catch (error) {
        await save();
        if (!(error instanceof EngineError) || !error.retryable || attempt >= 2) throw error;
        console.warn(`${error.code}: retrying after ${20 * (attempt + 1)} seconds; progress is saved.`);
        await pause(20_000 * (attempt + 1));
      }
    }
  };
  await save();
  for (const [index, person] of state.people.entries()) {
    if (person.analysis?.mode === mode && person.status === 'ready') continue;
    person.analysis = await retry(() => analyzePerson(person, config));
    person.status = 'ready'; person.updatedAt = new Date().toISOString();
    await save();
    console.log(`Profile ${index + 1}/${state.people.length}: ${person.name} (${mode}).`);
  }
  const pairs = schedulePairs(state.people);
  for (const [index, pair] of pairs.entries()) {
    const a = state.people.find(person => person.id === pair.personAId)!;
    const b = state.people.find(person => person.id === pair.personBId)!;
    let date = state.dates.find(item => item.personAId === a.id && item.personBId === b.id && item.mode === mode);
    if (!date) { date = createDateSession(a.id, b.id, mode); state.dates.push(date); }
    date.profileSnapshots ??= structuredClone({ [a.id]: a, [b.id]: b });
    if (date.status === 'complete') continue;
    date.status = 'running';
    while (date.turns.length < 6) {
      date.turns.push(await retry(() => generateDateTurn(date!, a, b, config)));
      await save();
    }
    for (const [self, other] of [[a, b], [b, a]]) {
      if (!date.assessments.some(assessment => assessment.personId === self.id)) {
        date.assessments.push(await retry(() => assessDate(date!, self, other, config)));
        await save();
      }
    }
    date.status = 'complete'; date.updatedAt = new Date().toISOString();
    await save();
    console.log(`Date ${index + 1}/${pairs.length}: ${a.name} ↔ ${b.name} (${mode}).`);
  }
  state.complete = state.people.every(person => person.status === 'ready') && state.dates.length === pairs.length && state.dates.every(date => date.status === 'complete');
  await save();
  if (!state.complete) throw new Error('The cohort is incomplete. The published seed was not changed.');
  await atomicWrite(options.output, state);
  console.log(`Saved ${state.people.length} profiles and ${state.dates.length} completed ${mode === 'rules' ? 'rules-based preview' : 'AI'} dates to ${options.output}. Tokens recorded: ${state.usage.totalTokens}.`);
  return state;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  buildDemo(parseOptions(process.argv.slice(2))).catch(error => {
    console.error(error instanceof EngineError ? safeError(error).message : error instanceof Error ? error.message : 'Demo build failed.');
    process.exitCode = 1;
  });
}
