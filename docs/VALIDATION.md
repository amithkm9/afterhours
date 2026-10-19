# Validation record

## Automated application checks

The final post-cleanup suite has **47 passing tests**. TypeScript checking, lint, the official Sites production build, and the read-only demo export also passed. The source package excludes ignored/local artifacts; the credential-pattern scan found zero matches. A pattern scan is not a guarantee that arbitrary secrets are absent.

Coverage includes URL validation; account/privacy/source binding; exact quotations; independent agent contexts; alternating turns; directional rankings and cohort coverage; bounded scraper requests; public HTML parsers; session ownership; credential encryption; transactional demo replacement; atomic leases; actual HTTP handlers; anonymous-provider quota reservations; and immutable date evidence after reanalysis.

The second audit also covers concurrent canonical imports/reanalyses/reversed date requests, resuming saved failed dates, retry budgets per model step, exact LinkedIn account paths, HTTPS cookies, private provider settings, repeatable scheduling, and all 600 ranking entries. Fresh-import success and authwall failures are tested with controlled HTTP fixtures, not claimed as production account retrieval.

HTTP tests invoke real handlers against SQLite through a D1-compatible adapter. They do not establish a reachable production deployment or listening local server.

## Completed cohort

Rechecked on 2026-10-19: 25 unique people, 25 distinct LinkedIn URLs, 25 distinct Instagram URLs, 50 source records, 25 LLM analyses, 122 quoted claims, 25 dates, 150 turns, and 50 independent assessments. Every person has two dates and 24 ranked candidates; 22 candidates remain profile estimates.

All 50 sources match `data/verified-people.json`. Every quotation is an exact substring of its cited source and at most 160 characters; inferred confidence is at most 0.75. Every turn/assessment cites only its speaker's claims. All 25 dates preserve both participant profiles in 50 immutable snapshots matching their generation-time profiles. Conversations and assessments match `data/offline-dates.json` unchanged.

All 150 turns and 50 assessments received content review. No unsupported past biographical events or sensitive private inferences were found. Hypothetical scenes remain hypothetical; actual relationship needs and partner preferences are not invented. This bounded review does not prove romantic compatibility. See `docs/FINAL-DATA-AUDIT.md` for fingerprint and limits.

## Actual source extraction

The production Instagram parser was run against all 25 real profile/embed pairs. All yielded nonempty target-account content and positive public status. A separate raw-embed audit found 150 matching-owner `is_private=false` records. All 25 portraits are valid JPEGs.

LinkedIn evidence is explicitly labeled public search-index excerpts, not full direct-page scraping. Direct requests can return an authentication wall. Public status is a retrieval-time snapshot; identity corroboration does not establish participation or endorsement. Raw capture/research files are retained locally in `work/research/source-capture`; required replay inputs remain in `data/`.

## Actual live inference

Unauthenticated requests to `https://text.pollinations.ai/openai` using `openai-fast` returned structured JSON. A real profile analysis passed schema and exact-quote validation. The provider also returned `FREE_LIMIT`, now treated as retryable and spaced with a shared 45-second reservation.

A separate fresh smoke run completed six validated turns and two independent assessments. `work/model-smoke/live-date-checked.json` records `status: complete`, `mode: llm`, `model: openai-fast`, and `generation: live`. The final cohort remains an honestly labeled offline Codex replay. This smoke run does not establish hosted source ingestion or guarantee every reply's semantic accuracy.

Earlier probes produced an unsupported first-person routine and invented book content; these were not accepted as the final demo. Guards and stronger evidence requirements were added. Schema and citation checks cannot establish the truth of every implication.

## Browser checks and limits

Chrome also opened the updated read-only export and displayed the 25-person/25-date cohort; user activity interrupted further Chrome interaction. Source inspection and compilation checked the new retry, duplicate-submit, navigation, stale-response and shortlist recovery behavior; browser-to-server mutation remains unverified.

Safari opened the actual React read-only export and exercised cohort navigation, profiles, quotations, source links, conversations, assessments, and 24-candidate rankings. This export cannot perform fresh imports or generation.

The sandbox denies local listening sockets (`EPERM`), but the actual Cloudflare HTTPS deployment was tested through Safari and HTTP requests. Saved profiles, all 600 ranking entries, conversations, assessments, session isolation, input validation, and explicit retrieval failures were exercised. Fresh import and model generation failed; intermittent Worker resource limits were observed. See [LIVE-AUDIT.md](LIVE-AUDIT.md) for the production results and unreleased optimization boundary. Optional Apify/Groq calls and YouTube publication remain unverified.
