import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildLiveClient } from "./build-live-client.mjs";

// Preserve the API Worker and D1 binding while serving the live UI as static
// assets, so page rendering consumes no Worker CPU. Never deploy a placeholder ID.
const [databaseId, databaseName = "after-hours-db"] = process.argv.slice(2);
if (!databaseId || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(databaseId)
    || databaseId === "00000000-0000-4000-8000-000000000000") {
  throw new Error("Usage: node scripts/prepare-cloudflare.mjs REAL_D1_DATABASE_UUID [database-name]");
}
if (!/^[a-zA-Z0-9_-]+$/.test(databaseName)) throw new Error("Invalid database name.");
const input = new URL("../dist/server/wrangler.json", import.meta.url);
const output = new URL("../dist/server/wrangler.cloudflare.json", import.meta.url);
const config = JSON.parse(readFileSync(input, "utf8"));
if (!config.d1_databases?.some((database) => database.binding === "DB")) {
  throw new Error("Build is missing the required DB binding. Run npm run build first.");
}
config.name = "after-hours-agents";
config.workers_dev = true;
config.d1_databases = [{
  binding: "DB",
  database_name: databaseName,
  database_id: databaseId,
  migrations_dir: "../../drizzle",
}];
const client = await buildLiveClient();
config.assets = {
  ...config.assets,
  directory: "../client",
  not_found_handling: "single-page-application",
  run_worker_first: ["/api/*"],
};
writeFileSync(output, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Built live static client: ${JSON.stringify(client)}`);
console.log(`Prepared ${fileURLToPath(output)}. No deployment was performed.`);
