# Deploy to Cloudflare Workers and D1

This checkout builds a Cloudflare Worker with a `DB` D1 binding. Vercel's Next.js import preset cannot run it unchanged. Vinext can target other platforms, but that requires a different server adapter and a replacement for this app's Cloudflare database/environment access.

These commands deploy to your own Cloudflare account, independently of ChatGPT Sites. Use a Workers Free account for the challenge; do not enable paid plans or paid inference. Free quotas can still stop requests. Production deployment and fresh-link ingestion have not yet been verified.

## 1. Install and authenticate

Requires Node.js 22.13 or newer. Run in the repository directory:

```sh
npm ci
npx wrangler login
npx wrangler d1 create after-hours-db
```

Copy the `database_id` printed by the last command. If the database already exists, use `npx wrangler d1 list` to find its ID instead of creating another one.

## 2. Build and configure the actual database

Replace `YOUR_DATABASE_ID` below with that UUID:

```sh
npm run build
node scripts/prepare-cloudflare.mjs YOUR_DATABASE_ID
```

The generated `dist/server/wrangler.cloudflare.json` preserves Vite's server module and static asset paths, uses the real database, and points to committed migrations. It is ignored by Git. Repeat this preparation after every new build: build output is disposable. Do not deploy the original `dist/server/wrangler.json`, which contains a Sites placeholder database ID.

## 3. Apply the schema and deploy

```sh
npx wrangler d1 migrations apply DB --remote --config dist/server/wrangler.cloudflare.json
npx wrangler deploy --config dist/server/wrangler.cloudflare.json
openssl rand -hex 32 | npx wrangler secret put APP_SECRET --config dist/server/wrangler.cloudflare.json
```

Run the secret command once for a new deployment. Preserve the same secret on subsequent releases: changing it makes existing saved provider credentials unreadable. Do not share the app until this command succeeds. Optional provider keys are unnecessary for the saved demo and anonymous model path.

Wrangler prints the actual `https://after-hours-agents.<your-subdomain>.workers.dev` URL. Use the printed URL rather than an invented address. This is a Workers deployment, not a Pages static upload. The same site opens the completed demo and supports the live input flow.

## 4. Verify before submitting

1. Open the deployed URL in a fresh browser session; confirm all 25 profiles and their LinkedIn/Instagram evidence are present.
2. Open a saved date, inspect its six turns and separate assessments, then inspect rankings. Reload and confirm the completed demo remains accessible.
3. Paste a new pair of official public links. Confirm retrieval, profile analysis, a new date, rankings, and persistence after reload. Keep the page open while jobs advance.
4. Confirm blocked/private profiles produce clear errors. LinkedIn can require login; the current direct scraper does not guarantee arbitrary fresh-link retrieval. Optional Apify access requires a token and available account allowance.
5. Record the actual hosted flow, profiles before rankings, in at most three minutes. The current local video is a draft, not proof of hosted ingestion. Upload the finished recording to YouTube and record the accessible link in `docs/SUBMISSION.md`.

The source ZIP and read-only HTML export are local artifacts; neither replaces the live app or YouTube submission.

References: [Cloudflare D1 setup](https://developers.cloudflare.com/d1/get-started/), [Vinext deployment support](https://github.com/cloudflare/vinext).
