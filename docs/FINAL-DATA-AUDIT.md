# Final cohort data audit

Audited `data/seed.json` on 2026-10-19; rechecked after immutable profile snapshots were assembled. SHA-256: `695ca53667d8fcb1099fab40812fee06eb15058059ddb72531b1a6fd33ee32cd`.

**Result: no data-integrity failures found in this snapshot.** This audit covers the saved data and conversations; it does not establish deployment or live-provider availability.

| Check | Result |
| --- | --- |
| People and source pairs | 25 unique people, each with exactly one LinkedIn and one Instagram source; 25 distinct profile URLs on each platform |
| Source preservation | All 50 source records match `data/verified-people.json` unchanged |
| Provenance | 25 LinkedIn records labeled `search-excerpt`; 25 Instagram records labeled `public-page`; no third-party biographies used as persona content |
| Instagram public status | Re-parsed retained raw embeds: 150 media-owner records match the requested usernames and have `is_private=false`; all 25 accounts supported |
| Identity | All 25 have recorded identity rationales using distinctive names plus matching ventures, books, work, or explicit account links; source and person verification flags agree |
| Analysis | 25 LLM analyses, 122 claims, 122 evidence quotations; every quote is an exact substring of its named source and at most 160 characters |
| Inference boundaries | Inferred-claim confidence is at most 0.75; unstated relationship needs remain empty |
| Conversations | 25 unique non-self pairings, 150 unique turns, six alternating turns per date; all dates marked complete and LLM-generated |
| Attribution | Every turn and assessment cites only its own speaker's claims; each person has one stable retained agent ID across two dates |
| Assessments | 50 valid directional assessments, correct counterpart IDs, scores within 0–100 |
| Immutable evidence | All 25 dates retain both participant profiles: 50 matching snapshots; conversations/assessments match the original offline-date artifact |
| Portraits | All 25 local portrait files exist and have JPEG signatures |

All 150 dialogue turns and all 50 assessments were read. Professional and public-content references remain within the supplied dossiers. Invented situations are presented as proposals, thought experiments, or explicitly fictional stories. No unsupported past personal events, sensitive private inferences, or claims about the real people's romantic preferences were found. The Mel Robbins agent explicitly declines to invent a missing detail about a sourced birthday hike. Assessment judgments concern the simulated interaction rather than asserted real-world compatibility.

## Practical limits

- LinkedIn evidence is a limited public search-index excerpt, not a successful direct LinkedIn scrape. Instagram public status and source content are snapshots at retrieval time. Identity corroboration is not account-owner authentication or consent to participate.
- This is a saved replay of offline LLM analyses and separate person-agent exchanges. The seed identifies its generation as `offline`; it does not demonstrate a fresh live API run.
- Each person has two simulated dates. The 25 evaluated pairs are a partial schedule, not all 300 possible unordered pairs; rankings must preserve that distinction.
- Most dates spend four turns arranging an activity and two turns exploring one substantive question. The conversations show responsiveness but little sustained disagreement or broader conversational range.
- Assessment scores are uncalibrated heuristics, ranging from 73 to 87. Agent continuation choices are strongly positive: 49 `yes`, one `maybe`. They are neither probabilities nor evidence of actual attraction, availability, consent, or partner preferences.
- Public professional content is much richer than evidence about hobbies or relationship needs. Unknowns should remain visible rather than being filled with plausible personal details.

No source, analysis, dialogue, assessment, or application code was changed during this audit.
