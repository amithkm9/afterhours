# After Hours

An agent dating experiment: read a person's LinkedIn and public Instagram, build a profile with inspectable evidence, let separately contextualized agents meet, and explain the resulting shortlist.

All dates are simulations. The real people have not participated or endorsed the results. Public-profile interests do not establish relationship availability, intent, or partner preferences.

## Features

- Personal LinkedIn/Instagram URL validation and canonicalization.
- Direct public-page ingestion, including an Instagram owner-bound public flag and caption extraction. Optional Apify adapters handle unavailable direct requests.
- Profile analysis with observed/inferred claims, source quotes, confidence, interests, hobbies, stated needs, and explicit unknowns.
- A no-key anonymous model for analysis, six alternating agent turns, and two independent directional assessments. Optional Groq support.
- An explicitly selected rules-based preview for development. It is not presented as AI-generated dating.
- Cloudflare D1 persistence and leased, resumable jobs. Refreshing resumes pending work; the browser advances the queue while open. There is no unattended background scheduler.
- Per-person rankings that distinguish profile estimates from completed simulated dates.
- A scheduler that gives all 25 people two dates in 25 unique pairs.
- AES-GCM-encrypted, session-specific provider settings. Credentials never enter the client bundle or API responses.

## Stack

TypeScript, React, Vinext (Next.js-compatible app routes), Vite, Cloudflare Workers, D1 SQLite, Drizzle migrations, direct HTML/structured-data parsers, optional Apify actors, and structured model JSON with local schema and evidence validation. The app targets Cloudflare Workers; ChatGPT Sites integration is also retained.

Main files: `app/page.tsx` (frontend), `app/api/[...path]/route.ts` (API), `src/lib/engine.ts` (agents/rankings), `src/lib/providers.ts` (retrieval/inference), `src/lib/store.ts` (persistence), and `src/lib/service.ts` (job orchestration).

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm install
cp .env.example .dev.vars
```

Set `APP_SECRET` to a private random value, for example one generated with `openssl rand -hex 32`. Optional server-wide keys are `GROQ_API_KEY`, `GROQ_MODEL`, and `APIFY_TOKEN`. Never commit real keys or `.dev.vars`. The anonymous Pollinations model works without a key or billing credential. Its free rate limit is strict: the app queues one inference step about every 45 seconds. Set `MODEL_PROVIDER=rules` for an explicit rules-only preview.

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_cool_whiplash.sql
npm run dev
```

Open the printed URL. Add a person using their two official links. Open Connections to configure optional providers for the current browser session. Fresh imports are isolated from the saved demonstration.

Local and hosted databases are separate. Sites applies committed schema migrations during publication. Production secrets belong in Sites runtime configuration, never `.openai/hosting.json`.

## Deploy

Follow [the Cloudflare deployment guide](docs/DEPLOYMENT.md) to create D1, configure the built Worker, apply migrations, and publish. Vercel requires runtime and database changes; this is not a standard Next.js deployment.

## Prepare the demonstration

`data/verified-people.json` contains the selected source excerpts and provenance. The source audit is in `docs/SOURCE-AUDIT.md`; the repository contains the selected source excerpts and generation inputs. Original capture files are preserved locally under ignored `work/research/source-capture/`. LinkedIn search excerpts are explicitly identified; they are not described as full-page scrapes. Instagram public visibility is checked from the matching embed owner record.

The saved demo is assembled from 25 Codex-written analyses and 25 independently generated person-agent conversations. It is labelled an offline model run, not fresh runtime output. Revalidate and assemble the saved artifacts with `npm run assemble:offline`.

For a separate deterministic preview, run:

```sh
node --import tsx scripts/build-demo.ts --rules-preview --output data/rules-preview.json
```

For model-generated dates, provide `GROQ_API_KEY` to the process and run without the preview flag. Check the account's actual request/token allowance first. Keep prompts compact; free tiers are finite and may change.

The actual React demo can also be exported into a self-contained, read-only HTML file with `npm run export:demo`. Open `outputs/after-hours-demo.html` to inspect saved profiles, all conversations and rankings without a server. This export cannot perform live imports or generation. `npm run package:source` creates a source ZIP excluding credentials and local tool state.

## Evidence and ranking method

Only the two account documents enter a person's analysis. External websites may help discover account URLs, but their biographical claims never become profile evidence. Every claim must cite a quote present in stored source text. Invented quotes, sources, and inferred personal needs cause validation failure.

Each agent receives its own dossier, a brief public introduction to the counterpart, and the shared conversation. Six alternating turns arrange the imagined outing, adapt to the counterpart, and explore a substantive topic during the simulated date. Each participant is assessed independently without access to the other's assessment. Dialogue remains hypothetical; it never becomes a verified personal fact.

Profile ranking measures overlap and directional coverage of documented topics. Model assessments refine that heuristic. Rules-preview conversations do not inflate scores. Scores are not probabilities or established romantic compatibility. Missing information appears as uncertainty.

## Validate

```sh
npm test
npx tsc --noEmit
npm run build
```

Tests cover malicious URLs, private/missing/mismatched sources, fabricated evidence, model schema failures, alternating turns, independent assessments, directional rankings, cohort coverage, bounded provider requests, record ownership, and job leases.

## Submission

See `docs/ARCHITECTURE.md` for the end-to-end design, `docs/DEMO-SCRIPT.md` for the 2:45 recording plan and `docs/SUBMISSION.md` for required hand-in fields. Profiles must appear before rankings. The video must show the actual agents interacting and be at most three minutes.

## Limits

Platforms can return login walls, challenges, rate limits, or missing pages. The app reports these failures and can use configured Apify access. It does not invent missing content. Apify requests have per-run charge ceilings, but account billing settings determine whether usage remains within a free allowance. A paid provider account is not automatically zero-cost.

The saved demonstration remains inspectable without repeating retrieval or inference. Fresh AI dates require available model quota. Publication, repository creation, and video upload are separate steps and are only complete after their resulting URLs have been verified.

## Repository layout

- `app/`: website and HTTP routes.
- `src/lib/`: ingestion, agents, rankings, persistence and queued jobs.
- `data/`: verified excerpts, model analyses, dates, assembled demo and generation audit.
- `db/` and `drizzle/`: database schema and migrations.
- `public/`: licensed fonts, profile portraits and favicon.
- `tests/`: backend, provider, API and integrity checks.
- `docs/`: requirements audit, architecture, validation and submission instructions.
- `scripts/`, `build/`, `lib/`: app commands and required Sites runtime integration.
- `work/` and `outputs/`: ignored local research/recording material and generated deliverables.

See `docs/STATUS.md` for the current deployment blockers.
