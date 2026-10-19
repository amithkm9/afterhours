# Deploy to Cloudflare Workers and D1

Updated 19 October 2026. The [HTTPS website](https://after-hours-agents.amithkm9.workers.dev) and [saved 25-person demo](https://after-hours-agents.amithkm9.workers.dev/?demo=1) are available. Hosted testing also found intermittent Worker CPU error 1102, a fresh two-link import blocked by platform access restrictions, and anonymous-model FREE_LIMIT responses. **This is not a fully passing live submission.**

The static-client and ranking-query performance fixes are built locally, with 47 local tests passing and a successful Wrangler dry run. **They have not yet been deployed.** The user must run the deployment commands in Terminal, then production checks must be repeated.

## Deployment architecture

This checkout targets Cloudflare Workers with a DB D1 binding. Standalone deployment preparation builds app/page.tsx into a static React client with fingerprinted JavaScript/CSS and local fonts/images. It makes the same real /api/* requests as the app; no saved cohort or offline fetch adapter is bundled into this live client.

Cloudflare serves static assets for / and /?demo=1. The prepared configuration sets assets.not_found_handling to "single-page-application" and assets.run_worker_first to ["/api/*"], preserving the API Worker and D1. The ranking query reads fields needed for scoring instead of deserializing full date transcripts and profile snapshots. The homepage avoids server rendering; API CPU use is reduced separately.

Vercel's Next.js import preset cannot run this checkout unchanged: the server uses Cloudflare Worker bindings and D1. Publishing the standalone HTML export on Vercel would only provide a read-only artifact. A full Vercel migration requires a different runtime/database adapter.

## 1. Install and authenticate

Requires Node.js 22.13 or newer. Run in the repository directory using the latest source, including scripts/build-live-client.mjs:

~~~sh
npm ci
npx wrangler login
~~~

For the existing deployment, find the existing database ID:

~~~sh
npx wrangler d1 list
~~~

For a new account only, create the database and copy its printed database_id:

~~~sh
npx wrangler d1 create after-hours-db
~~~

Use Workers Free for the challenge; do not enable a paid plan or paid inference. Free quotas can stop requests.

## 2. Build and prepare

Replace YOUR_DATABASE_ID with the actual D1 UUID:

~~~sh
npm run build
node scripts/prepare-cloudflare.mjs YOUR_DATABASE_ID
~~~

Preparation writes dist/client/index.html, its fingerprinted live assets, and dist/server/wrangler.cloudflare.json. It preserves the API Worker entry point, replaces the Sites placeholder database ID, and points to committed migrations. Build guards check that the client has not imported saved data or server modules and that local fonts exist.

Repeat preparation after every build: generated output is disposable. Do not deploy dist/server/wrangler.json, which contains a placeholder database ID. A successful build or dry run is not a remote deployment.

## 3. Apply migrations and deploy

~~~sh
npx wrangler d1 migrations apply DB --remote --config dist/server/wrangler.cloudflare.json
npx wrangler deploy --config dist/server/wrangler.cloudflare.json
~~~

For a **new deployment only**, configure the encryption secret before sharing the app:

~~~sh
openssl rand -hex 32 | npx wrangler secret put APP_SECRET --config dist/server/wrangler.cloudflare.json
~~~

Preserve the existing APP_SECRET on subsequent releases: changing it makes saved provider credentials unreadable. Optional provider keys are unnecessary for the saved demo. Anonymous model availability is subject to quotas.

On a new account, register a workers.dev subdomain if Wrangler prompts for one. Wrangler prints the actual HTTPS address. This is a Workers deployment with static assets and an API, not a Pages static upload.

## 4. Verify the deployed version

1. Open the HTTPS website and /?demo=1 in a fresh session. Confirm all 25 profiles and completed conversations, and check that repeated navigation no longer produces error 1102.
2. Open a profile first, inspect source quotations, then read a six-turn date and both assessments. Check rankings for several people: each should contain 24 other candidates. Reload to verify persistence.
3. Paste a new pair of official public links. Require successful retrieval, analysis, a new date, rankings, and persistence before marking fresh ingestion complete. Keep the page open while queued jobs advance.
4. Confirm blocked/private profiles and model quota failures display honest errors. The observed platform access block and FREE_LIMIT remain blockers until a fresh hosted run succeeds. Optional Apify requires a token and available allowance; it does not guarantee free or successful scraping.
5. Record the actual working hosted flow, profiles before rankings, in at most three minutes. Upload the finished video to YouTube and verify its accessible URL. A local saved-demo recording does not prove fresh hosted ingestion.

Before handing over a source ZIP, rerun npm run package:source after all changes. The archive must include the new live-client helper and current deployment preparation script. The source ZIP and read-only HTML export do not replace the live app or YouTube submission.

References: [Cloudflare SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/), [Cloudflare D1 setup](https://developers.cloudflare.com/d1/get-started/), [Vinext deployment support](https://github.com/cloudflare/vinext).
