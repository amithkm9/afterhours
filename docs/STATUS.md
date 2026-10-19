# Build status

The application and completed 25-person model demo are implemented and locally validated. **The challenge is not yet submission-complete:** HTTPS accessibility, a YouTube upload, and fresh hosted link ingestion remain unverified or unfinished.

## Completed

- 25 real public people with corroborated LinkedIn/public Instagram pairs, 50 saved source records, and 25 local portraits.
- 25 offline LLM analyses containing 122 claims with exact quotations, provenance, confidence, observed/inferred labels, and explicit unknowns.
- 25 retained person agents completed 25 dates: 150 alternating turns and 50 independent assessments. Every person has two dates.
- All 25 dates contain immutable participant-profile snapshots, preserving the evidence used before later reanalysis.
- Every person has 24 ranked candidates: two with date evidence and 22 explicitly untested profile estimates.
- Atomic duplicate-request prevention and failed-date resume retain completed turns and assessments. Frontend retries, profile-first import navigation, queue feedback, and shortlist refresh were repaired.
- Session-isolated persistence, encrypted optional credentials, resumable leased jobs, direct public-page parsers, anonymous inference, and optional Groq/Apify adapters.
- Standalone Cloudflare configuration preparation and Wrangler deployment dry run passed; no remote deployment was performed.
- Final post-cleanup validation passed: 46 tests, TypeScript checking, lint, the official Sites production build, and the read-only demo export.
- Safari QA exercised the actual React read-only export: profiles, source quotations, conversations, assessments, and rankings.
- A fresh anonymous `openai-fast` smoke run completed six validated turns and two independent assessments. This proves a provider-level path, not hosted ingestion or semantic accuracy of every reply.

## Remaining submission gaps

- **Public live/demo hosting:** Cloudflare confirmed deployment at https://after-hours-agents.amithkm9.workers.dev (version `7840fbbd-d600-4deb-9bdd-c8361135c4cd`). An HTTP probe returned the actual app HTML; initial HTTPS probes failed during TLS setup after subdomain creation. The saved demo is at `/?demo=1`. Successful HTTPS access and hosted functional checks remain pending.
- **Fresh links on a hosted app:** unverified. Direct LinkedIn retrieval can return an authentication wall. Optional Apify requires a valid account/token and available allowance.
- **Public GitHub:** https://github.com/amithkm9/afterhours is public. The user pushed commit `adb2cf798d9a54e377b58a57c4770386b26343c7`; remote commit and key file hashes were verified. Subsequent cleanup/deployment-guide changes still need pushing if shell DNS remains blocked.
- **YouTube:** a 2:40 local draft exists at `outputs/after-hours-walkthrough-draft.mp4`, using saved demo captures and explicitly disclosing that hosting is pending. It has not been uploaded; no YouTube URL is recorded. The required video is at most three minutes, shows profiles before rankings, and includes actual agent exchanges.
- **Runtime browser check:** this sandbox rejects listening sockets with `EPERM`; handler tests and the read-only export do not replace a hosted browser-to-server check.

## Next actions

1. Retain the validated completed model cohort and evidence snapshots in the final source commit.
2. Push final source/documentation changes and verify HTTPS evaluator access to the deployed Worker.
3. Test fresh official links, analysis, dates, rankings, reload persistence, and retrieval failures on the hosted app.
4. Push final cleanup changes; record and upload the hosted flow within three minutes.
5. Fill `docs/SUBMISSION.md` with actual verified URLs.

For standalone hosting steps see `docs/DEPLOYMENT.md`.

See `docs/REQUIREMENTS.md` for the challenge audit and `docs/VALIDATION.md` for verification boundaries.
