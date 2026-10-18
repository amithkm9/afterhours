# Submission package

**Status: not ready to submit.** The local application and completed model demo exist; required public URLs and the hosted fresh-link flow remain unverified.

## Overall explanation (199 characters)

Agents use LinkedIn and public Instagram to build evidence-backed profiles, simulate dates, and rank matches. A saved 25-person demo exposes source quotes, conversations, and independent assessments.

## Technical explanation

After Hours uses TypeScript, React and Vinext on Cloudflare Workers, with D1 for sources, analyses, leased jobs, and transcripts. Direct parsers read LinkedIn structured data and public Instagram profile/embed data; Instagram requires a matching-owner public flag. Optional Apify actors handle blocked pages with email enrichment disabled and per-run charge ceilings. Apify is recommended in the challenge, not mandatory. Direct LinkedIn can return an authentication wall; fresh hosted link success remains unverified.

The selected cohort uses explicitly labeled LinkedIn public search-index excerpts and actual public Instagram bios/captions. Exactly those two account documents inform each persona. Quotations, source IDs, confidence, and observed/inferred labels are inspectable. Unsupported hobbies and personal needs remain unknown.

The saved demo has 25 real public people and 25 separately contextualized Codex person agents, labeled as an offline model run. The cohort contains 25 six-turn dates, 150 turns, and 50 independent assessments. Each person has two dates and a 24-candidate ranking; 22 candidates remain profile estimates. Immutable date-profile snapshots preserve the evidence used for each exchange.

New model operations use anonymous Pollinations `openai-fast` without an API key or billing credential; a separate live smoke run completed six validated turns and two assessments. A shared reservation spaces requests 45 seconds apart. Groq is optional. Provider/evidence failures produce errors. Optional accounts have separate quotas/billing; charge ceilings do not guarantee free usage. Opening the saved cohort requires no repeated inference. No paid API charge is recorded for this build.

## Required links

- YouTube video, at most three minutes: **2:40 local draft recorded; final hosted-flow recording and YouTube upload pending**.
- Completed 25-person demo: local `outputs/after-hours-demo.html`; **public URL pending deployment**.
- Live website accepting evaluator-provided links: **pending deployment and hosted fresh-link verification**.
- Public GitHub repository: https://github.com/amithkm9/afterhours — **public; source commit `adb2cf7` verified on GitHub**.

## Acceptance checks

- [x] 25 real public adults with corroborated official account links.
- [x] All Instagram accounts positively checked public at retrieval time.
- [x] Exactly two persona sources with provenance and timestamps.
- [x] Evidence-backed profiles and explicit unknowns for every person.
- [x] Every agent has two model-generated simulated dates.
- [x] Every person has rankings distinguishing dates from profile estimates.
- [x] Saved local demo opens without input and reloads its saved cohort.
- [x] Explanation within 200 characters and technical section prepared.
- [ ] Fresh hosted links, analysis, dates, rankings, and clear failure behavior verified.
- [ ] Hosted persistence and all evaluator-facing features exercised.
- [ ] Video shows profiles before rankings and an actual adaptive agent exchange.
- [ ] Video is at most three minutes with an accessible YouTube URL.
- [ ] Live/demo URLs are accessible to evaluators.
- [x] GitHub repository is public and published files contain no credentials (verified source commit `adb2cf7`).

See `docs/REQUIREMENTS.md`. Local checks do not replace missing public submission artifacts.
