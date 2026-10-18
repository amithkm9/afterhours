# Build status

The application and completed 25-person model demo are implemented and locally validated. **The challenge is not yet submission-complete:** public hosting, a public GitHub repository, a YouTube video, and fresh hosted link ingestion remain unverified.

## Completed

- 25 real public people with corroborated LinkedIn/public Instagram pairs, 50 saved source records, and 25 local portraits.
- 25 offline LLM analyses containing 122 claims with exact quotations, provenance, confidence, observed/inferred labels, and explicit unknowns.
- 25 retained person agents completed 25 dates: 150 alternating turns and 50 independent assessments. Every person has two dates.
- All 25 dates contain immutable participant-profile snapshots, preserving the evidence used before later reanalysis.
- Every person has 24 ranked candidates: two with date evidence and 22 explicitly untested profile estimates.
- Session-isolated persistence, encrypted optional credentials, resumable leased jobs, direct public-page parsers, anonymous inference, and optional Groq/Apify adapters.
- Final post-cleanup validation passed: 39 tests, TypeScript checking, lint, the official Sites production build, and the read-only demo export.
- Safari QA exercised the actual React read-only export: profiles, source quotations, conversations, assessments, and rankings.
- A fresh anonymous `openai-fast` smoke run completed six validated turns and two independent assessments. This proves a provider-level path, not hosted ingestion or semantic accuracy of every reply.

## Remaining submission gaps

- **Public live/demo hosting:** the source helper retry at 23:25 UTC on 2026-10-18 still failed to resolve `git.chatgpt-team.site`. No successful source push or verified deployment URL is recorded.
- **Fresh links on a hosted app:** unverified. Direct LinkedIn retrieval can return an authentication wall. Optional Apify requires a valid account/token and available allowance.
- **Public GitHub:** `gh` authentication is invalid; no public `amithkm9/after-hours-agents` repository was found, and no Git remote is configured. The authenticated connector cannot create a repository.
- **YouTube:** no completed recording/upload or accessible video URL is recorded. The required video is at most three minutes, shows profiles before rankings, and includes actual agent exchanges.
- **Runtime browser check:** this sandbox rejects listening sockets with `EPERM`; handler tests and the read-only export do not replace a hosted browser-to-server check.

## Next actions

1. Retain the validated completed model cohort and evidence snapshots in the final source commit.
2. Commit/push the exact source and deploy when hosting connectivity works; verify evaluator access.
3. Test fresh official links, analysis, dates, rankings, reload persistence, and retrieval failures on the hosted app.
4. Publish the public GitHub repository; record and upload the complete flow within three minutes.
5. Fill `docs/SUBMISSION.md` with actual verified URLs.

See `docs/REQUIREMENTS.md` for the challenge audit and `docs/VALIDATION.md` for verification boundaries.
