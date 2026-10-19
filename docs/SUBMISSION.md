# Submission package

**Status: incomplete.** The HTTPS saved demo is verified. Fresh hosted import and generation failed in the live audit; the YouTube upload remains outstanding.

## Overall explanation (199 characters)

Agents use LinkedIn and public Instagram to build evidence-backed profiles, simulate dates, and rank matches. A saved 25-person demo exposes source quotes, conversations, and independent assessments.

## Technical field (402 characters)

React/TypeScript and Vinext on Cloudflare Workers with D1. Direct parsers read LinkedIn structured data and public Instagram profile/embed data; optional Apify handles blocked pages. The saved cohort uses labeled LinkedIn search excerpts and public Instagram captions, with exact quotes. Fresh hosted retrieval was blocked and anonymous model generation hit FREE_LIMIT; those flows are not yet passing.

## Technical explanation

After Hours uses TypeScript, React and Vinext on Cloudflare Workers, with D1 for sources, analyses, leased jobs, and transcripts. Direct parsers read LinkedIn structured data and public Instagram profile/embed data; Instagram requires a matching-owner public flag. Optional Apify actors handle blocked pages with email enrichment disabled and per-run charge ceilings. Apify is recommended in the challenge, not mandatory. Direct LinkedIn can return an authentication wall; a fresh hosted import failed with an explicit platform-blocked error.

The selected cohort uses explicitly labeled LinkedIn public search-index excerpts and actual public Instagram bios/captions. Exactly those two account documents inform each persona. Quotations, source IDs, confidence, and observed/inferred labels are inspectable. Unsupported hobbies and personal needs remain unknown.

The saved demo has 25 real public people and 25 separately contextualized Codex person agents, labeled as an offline model run. The cohort contains 25 six-turn dates, 150 turns, and 50 independent assessments. Each person has two dates and a 24-candidate ranking; 22 candidates remain profile estimates. Immutable date-profile snapshots preserve the evidence used for each exchange.

New model operations use anonymous Pollinations `openai-fast` without an API key or billing credential; a previous provider smoke run completed six validated turns and two assessments, but the deployed fresh-date audit later failed with `FREE_LIMIT` and zero turns. A shared reservation spaces requests 45 seconds apart. Groq is optional. Provider/evidence failures produce errors. Optional accounts have separate quotas/billing; charge ceilings do not guarantee free usage. Opening the saved cohort requires no repeated inference. No paid API charge is recorded for this build.

## Required links

- YouTube video, at most three minutes: **2:51.854 narrated live screenshot walkthrough created; YouTube upload pending**.
- Completed 25-person demo: https://after-hours-agents.amithkm9.workers.dev/?demo=1 — **HTTPS and saved profiles, conversations, and rankings verified**.
- Live website accepting evaluator-provided links: https://after-hours-agents.amithkm9.workers.dev — **HTTPS verified; fresh-link import and fresh generation currently fail**.
- Public GitHub repository: https://github.com/amithkm9/afterhours — **public; source commit `adb2cf7` verified on GitHub**.

## Acceptance checks

- [x] 25 real public adults with corroborated official account links.
- [x] All Instagram accounts positively checked public at retrieval time.
- [x] Exactly two persona sources with provenance and timestamps.
- [x] Evidence-backed profiles and explicit unknowns for every person.
- [x] Every agent has two model-generated simulated dates.
- [x] Every person has rankings distinguishing dates from profile estimates.
- [x] Saved hosted demo opens without input and returns the completed 25-person cohort.
- [x] Explanation within 200 characters and technical section prepared.
- [ ] Fresh hosted links, analysis, dates, rankings, and clear failure behavior verified.
- [ ] Hosted persistence and all evaluator-facing features exercised.
- [x] Narrated live screenshot walkthrough shows profiles before rankings and a saved adaptive agent exchange.
- [ ] Video is at most three minutes with an accessible YouTube URL.
- [x] Live/demo URLs responded over verified HTTPS during the audit; intermittent resource-limit failures require follow-up.
- [x] GitHub repository is public and published files contain no credentials (verified source commit `adb2cf7`).

See `docs/REQUIREMENTS.md`. Local checks do not replace missing public submission artifacts.
