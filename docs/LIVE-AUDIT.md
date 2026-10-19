# Deployed website audit — 19 October 2026

**Result: the prepared demonstration works, but the complete live requirements did not pass this audit.** A fresh profile import failed, a new model-driven date failed without producing a turn, and several requests hit Cloudflare resource limits. Local fixes have passed tests but were **not deployed at the end of this audit**.

Target: <https://after-hours-agents.amithkm9.workers.dev>. HTTP checks ran approximately **00:07–00:16 UTC** on 19 October 2026. All requests used ordinary `curl` with normal HTTPS certificate verification; successful requests reported `ssl_verify_result=0`. No TLS bypass, browser automation, paid provider credentials, or changes to the shared demonstration were used by the API audit.

## Requirement matrix

| Requirement | Observed result | Evidence and limits |
|---|---|---|
| A reachable live website/API | Partial | `/api/state` returned 200 with persistent storage configured. Three ranking requests and the first live date step returned Cloudflare 503/1102. The parent browser audit also observed a resource-limit error on the website entry page. |
| At least 25 real people with LinkedIn and public Instagram links | Pass for the saved cohort | Deployed state contains 25 distinct ready profiles, each with exactly two readable source documents and explicit public-Instagram metadata. Account identity was researched previously; this audit did not independently re-scrape all 50 external accounts. |
| Profile analysis backed by the two allowed sources | Pass for saved analysis | All 122 displayed claims cite quotations found in their own saved LinkedIn/Instagram source documents. This verifies references, not the semantic truth of every interpretation. LinkedIn provenance remains `search-excerpt`; Instagram provenance is `public-page`. |
| Agents actually converse and independently assess a date | Pass for the prepared example; fail for a fresh live run | The saved cohort has 25 completed **offline Codex-generated** dates, 150 alternating turns, and 50 assessments. Every person appears in two dates. A newly queued live date produced zero turns and failed after provider rate-limit errors. |
| A ranking for every person | Pass after sequential retries | All 25 ranking endpoints returned 24 unique other people, ordered scores, and the expected profile/date score blend. Three requests in the concurrent batch initially failed and then succeeded sequentially. |
| Paste previously unseen public links and obtain a profile | Fail | A genuine unused Ann Handley LinkedIn/Instagram pair queued successfully, but all three retrieval attempts were blocked by the platform. The final profile has zero sources and no analysis. |
| Fresh analysis after live import | Not reached | The source import failed before analysis. The saved analysis and local fixture tests do not establish success for this live flow. |
| Complete a new live date and update its rankings | Fail | Ali Abdaal/Sahil Bloom was queued in a dedicated session. The first step hit 1102; three subsequent spaced attempts received `FREE_LIMIT`. The final job/date is failed with zero turns and zero assessments. |
| Reuse existing work and isolate visitor sessions | Pass | A completed demo date was reused. Repeating a new-date request reused its ID and left one job. Another visitor and the shared demo retained 25 dates and zero jobs. |
| Reject invalid inputs and cross-origin writes | Pass | Null, array, malformed JSON, missing links, a lookalike LinkedIn domain, and self-dates returned 400. A foreign-origin write returned 403. |
| Three-minute YouTube demonstration and final public repository | Outside this API audit | Screenshots, video preparation, publication, and repository submission are separate deliverables. No pass is inferred from API responses. |

## Deployed HTTP evidence

Raw response bodies and headers are retained locally under `work/live-audit/`. The compact machine-readable report is `work/live-audit/audit.json`; request timing/TLS results are in `http-results.json`. Cookie jars and raw `Set-Cookie` headers are private test artifacts and are not intended for publication.

| Check | HTTP/result | Local artifact |
|---|---|---|
| Fresh session A and B state | 200; each 25 ready/verified profiles, 25 complete dates, zero jobs | `state-a.json`, `state-b.json`, corresponding `.headers` |
| Shared demo state | 200; same prepared cohort | `state-demo.json` |
| Every profile's rankings | 200 on the initial request or sequential retry; 24 candidates each | `rankings-<person-id>.json`; three `-retry.json` files |
| Cached date | 200; `reused: true`, complete | `cached-date.json` |
| New date and repeated request | 200; same date ID, one visitor job | `new-date.json`, `new-date-repeat.json` |
| Session isolation after queuing | A: 26 dates/one job; B and demo: 25 dates/zero jobs | `state-a-after.json`, `state-b-after.json`, `state-demo-after.json` |
| Invalid body/link/self-date inputs | 400 with explicit validation codes | `null-body.json`, `array-body.json`, `malformed.json`, `missing-links.json`, `lookalike.json`, `same-person.json` |
| Foreign-origin mutation | 403, `INVALID_ORIGIN` | `csrf.json` |
| Genuine fresh import | 200 when queued; third processing response reports terminal failure | `fresh-import.json`, `fresh-import-step-03.json` |
| New live model date | First processing request: 503; later HTTP 200 responses contain failed application work | `live-date-step-01.json` through `live-date-step-04.json` |

HTTP 200 on a processing endpoint means the server returned its job result. It **does not** mean the import or date succeeded; `job.status`, `date.status`, source counts, and turn counts were inspected.

The eight saved-data, reference, ranking, cookie, reuse, isolation, and validation checks in `work/live-audit/verify.mjs` passed. Its report is supplemented by the later live import/date failures described here.

## Separate live Safari check

The parent agent tested the deployed site in Safari independently of the curl sessions. Profile quotations, source views, date grounding, assessments, shortlists, ranking explanations, and the "How it works" page were usable. Screenshots are retained in `work/live-video/shots/02-profile.png` through `10-ranking-evidence.png` and `14-how-it-works.png`.

The browser also submitted the genuine Ann Handley pair. The queued state and honest blocked result are captured in `11-live-input.png`, `12-live-pending.png`, and `13-live-blocked.png`. After a full **Cmd-R reload**, the personal workspace still displayed **26 people, 25 ready**, with Ann Handley marked "Needs attention", **0/2 sources**, and the platform-blocked error. The persisted accessibility/UI state is recorded in `work/live-audit/browser-persistence.txt`. Searching `annhandley` and the "Getting acquainted" filter located this unfinished profile.

The shared `?demo=1` view remained read-only with the original **25 people**. These browser checks confirm persistence, navigation, filtering, and isolation; they do not change the failed fresh-import or live-date outcomes.

## Observed failures

### Cloudflare resource limits

A batch of 24 concurrent ranking reads produced these 503 responses. Each body was `error code: 1102`; each succeeded on a subsequent sequential retry.

| Person | Cloudflare Ray ID |
|---|---|
| Mel Robbins | `a4cb8c067be17008-CDG` |
| Gary Vaynerchuk | `a4cb8c067f2b6f13-CDG` |
| Hala Taha | `a4cb8c068e106fab-CDG` |

The first **single live date step** also failed with 1102 at **00:12:26 UTC**, Ray **`a4cb923bed646f48-CDG`**. It left zero completed turns and an active lease, which was allowed to expire before retrying. The failure therefore cannot be attributed only to concurrent reads.

An earlier shell invocation with redirected stdout encountered local DNS-resolution failures. Direct ordinary `curl` invocations succeeded afterward. Those local failures are preserved under `environment-dns-attempts/` and are not counted as application failures.

### Fresh profile ingestion

The unused pair was [Ann Handley's LinkedIn](https://www.linkedin.com/in/annhandley/) and [public Instagram](https://www.instagram.com/annhandley/). Previously captured first-party account excerpts identify both Ann Handley and MarketingProfs; Instagram's matching-owner visibility flags were false for `is_private`. The corroboration is retained in `fresh-person-evidence.json`.

The deployed importer queued the URLs, then failed after three attempts with:

> The platform blocked access to its public profile. Connect an Apify token to try the supported scraper.

The final source count is **0**, profile status is **failed**, and no analysis was fabricated. The generic response does not establish which platform blocked this particular request. Production state reported no Apify token.

### Anonymous model date

The dedicated date used the already analyzed Ali Abdaal and Sahil Bloom profiles, so source ingestion was not a prerequisite for this test. After the initial 1102 failure, model attempts returned `FREE_LIMIT` at approximately **00:13:55, 00:14:55, and 00:16:17 UTC**. The latter attempts were spaced roughly 60 and 82 seconds apart.

The final result is **failed**, with **0 turns and 0 assessments**. The error text mentions a 30-second limit and retrying, but the persisted status is terminal failure after three attempts. No further retries were made. The cause of the provider's continued limit was not established; it must not be described as a verified short wait that resolves the issue.

Production state reported the anonymous model enabled and Groq unconfigured. These results do not demonstrate a working production model path.

## Local fixes awaiting deployment

The backend now fetches only ranking-relevant D1 fields instead of complete transcripts and duplicated source snapshots. Topic normalization is reused within ranking and cohort scheduling requests. The ranking input shrank from **510,564 to 103,099 serialized bytes — an 80% reduction** in a local measurement.

A regression compares every ranking in the 25-person cohort against full-record results, checks visitor overrides, and confirms that reanalyzed profiles exclude stale date scores. **All 47 local tests, TypeScript, and changed-file ESLint passed.** The parent also prepared an entry-page change to avoid server rendering the full application.

The D1 test adapter uses **actual SQLite** through Node's `DatabaseSync(':memory:')`: SQL is executed with `sqlite.prepare`, not replaced by pattern-matched responses. The projection regression checks nested analysis objects, assessment arrays, revision objects, and an empty `{}` revision map for a date without snapshots, as well as exact results for all 25 rankings. This validates SQLite query behavior locally; it is not a substitute for a deployed D1 check.

Deployment was still pending at audit completion after the deployment CLI could not resolve `api.cloudflare.com`. These local changes have **not yet been proven to remove production 1102 errors**. They do not supply missing scraper access or make the anonymous model's allowance available.

## Completion criteria still open

1. Deploy the prepared free-plan resource optimizations and recheck the entry page, state, rankings, and date processing sequentially.
2. Demonstrate a genuine new pair of public profile links importing and reaching a completed source-backed analysis.
3. Complete a fresh live six-turn date with two assessments, then confirm its result appears in rankings.
4. Finish the separately tracked video/publication and submission checks.

The prepared cohort remains useful for reviewing profiles, evidence, simulated conversations, and rankings. It is not evidence that the two failed live flows satisfy the challenge.
