import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

export const testEnvironment: { DB?: D1Database; APP_SECRET: string; APIFY_TOKEN?: string; GROQ_API_KEY?: string; GROQ_MODEL?: string; MODEL_PROVIDER?: string } = { APP_SECRET: 'test-only-app-secret' };
(globalThis as typeof globalThis & { __TEST_CF_ENV__: unknown }).__TEST_CF_ENV__ = testEnvironment;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cloudflare:workers') return { url: 'data:text/javascript,export const env = globalThis.__TEST_CF_ENV__', shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

export function resetDatabase() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, owner TEXT NOT NULL, value TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)');
  const adapter = {
    prepare(sql: string) {
      let values: (string | number | null)[] = [];
      const statement = {
        bind(...parameters: (string | number | null)[]) { values = parameters; return statement; },
        async all() { return { results: sqlite.prepare(sql).all(...values), success: true }; },
        async first() { return sqlite.prepare(sql).get(...values) ?? null; },
        execute() { const result = sqlite.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes) } }; },
        async run() { return statement.execute(); },
      };
      return statement;
    },
    async batch(statements: { execute: () => unknown }[]) {
      sqlite.exec('BEGIN');
      try {
        const result = [];
        for (const statement of statements) result.push(statement.execute());
        sqlite.exec('COMMIT');
        return result;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  testEnvironment.DB = adapter as unknown as D1Database;
  testEnvironment.APIFY_TOKEN = undefined;
  testEnvironment.GROQ_API_KEY = undefined;
  testEnvironment.GROQ_MODEL = undefined;
  testEnvironment.MODEL_PROVIDER = 'rules';
  return sqlite;
}
