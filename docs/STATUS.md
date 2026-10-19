# Build status — 19 October 2026

**The saved HTTPS demonstration works, but the complete challenge requirements do not yet pass.** See [the live audit](LIVE-AUDIT.md) for observed results and exact evidence.

## Verified

- Live website: https://after-hours-agents.amithkm9.workers.dev
- Read-only completed example: https://after-hours-agents.amithkm9.workers.dev/?demo=1
- 25 real public people, 50 saved source documents, 122 quoted profile claims.
- 25 saved offline-model dates, 150 turns, 50 independent assessments, and two dates per person.
- All 25 ranking endpoints: 24 candidates each; two date-informed matches and 22 profile estimates. Three initial resource-limit failures succeeded on sequential retry.
- Live Safari checks: profile evidence, source accordions, immutable date-profile evidence, conversations, independent assessments, ranking explanations, search, pending-profile filter, explanation page, and read-only demo.
- A fresh failed import persisted after browser reload; the shared demo remained at 25 people.
- Invalid inputs, cross-origin writes, duplicate-date prevention, and visitor isolation behaved as expected.
- 47 local tests, TypeScript, lint, production build, and the prepared Cloudflare dry run passed.
- Public GitHub repository: https://github.com/amithkm9/afterhours. The previously verified remote source commit is `adb2cf7`; newer local changes require push verification.

## Video and captures

`outputs/after-hours-live-walkthrough.mp4` is a **2:51.854 narrated walkthrough of genuine live-browser screenshots**, with profile analysis first, agent exchanges, assessments, rankings, and fresh-link input/failure. It explicitly labels saved offline-agent conversations and does not claim that the failed fresh flows pass. It is an edited screenshot walkthrough, not a continuous screen recording.

English captions and a transcript accompany the video. Raw captures are in `work/live-video/shots/`. The earlier 2:40 local draft is preserved separately. **No YouTube upload or public video URL has been verified.**

## Remaining blockers

1. A fresh Ann Handley LinkedIn/Instagram import failed after three platform-blocked retrieval attempts, with zero sources and no analysis.
2. A new Ali Abdaal/Sahil Bloom model date failed after three spaced `FREE_LIMIT` responses, with zero turns. A prior provider smoke success does not override this deployed failure.
3. Intermittent Cloudflare `1102` resource-limit errors affected the homepage, rankings, and a single date-processing request.
4. A static frontend and compact ranking queries are built locally. The CLI could not resolve the Cloudflare deployment API, so deployment and post-deployment verification remain pending. These changes do not resolve missing scraper/model availability.
5. Upload the video to YouTube, verify the public source push, and complete the submission fields.

## Next concrete deployment step

The built configuration preserves the existing D1 binding and secret. From this checkout:

```sh
npx wrangler deploy --config dist/server/wrangler.cloudflare.json
```

Then recheck the entry page, APIs, and new date processing. See [deployment instructions](DEPLOYMENT.md) to rebuild this configuration from a fresh checkout. Do not describe all requirements as passing until a genuinely new import and new model date complete on the hosted app.
