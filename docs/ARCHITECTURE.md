# How After Hours works

## Two source documents per person

The importer canonicalizes one personal LinkedIn URL and one Instagram URL. It rejects other hosts, company pages, posts, credentials, unsafe redirects, and mismatched account data. Direct LinkedIn extraction accepts a matching structured Person; Instagram extraction requires a target-owner `is_private: false` flag and retains that owner's captions. Apify is optional, with separate fixed actors and per-run charge ceilings. The saved cohort's LinkedIn material is explicitly labelled search-index excerpts, not direct scraping success.

Only the two account documents enter a persona. Discovery/corroboration material is retained separately. Name similarity alone does not prove that two accounts belong to the same person. Clear identity mismatches are rejected; ambiguous fresh pairs remain unverified.

## Evidence before conversation

The model returns a typed JSON list of claims. Each claim has a category, observed/inferred status, confidence, source ID, and verbatim quote. Local validation rejects fabricated source references, unsupported quotes, sensitive claims and inferred personal needs. A profession alone does not establish a hobby. Summary and profile facets derive from accepted claims, rather than an independent unsourced paragraph.

Relationship availability, orientation, actual partner preferences and real chemistry are unknown. These are hypothetical agent simulations, not assertions that the people consented to date or actually said the generated dialogue.

## Individual agents and six turns

Each live turn is a separate model request with only that agent's own dossier, a brief public introduction to its counterpart, and the visible transcript. The six actions are proposal, response, adaptation, settling in, substantive exploration, and a meaningful response during the imagined date. The final two turns move beyond planning the outing. The generated messages cite only the speaking agent's own claim IDs.

After six turns, each agent separately assesses the full conversation: connection, limitation, open question, tentative score and whether to continue the simulation. Neither call includes the counterpart's private assessment.

Each date stores immutable copies of both profile analyses. Reanalyzing a person preserves the evidence behind old conversations and excludes outdated date scores from current rankings.

The saved cohort uses independently contextualized Codex person agents, one retained agent per person. It is labelled an offline model run and opened as a saved replay. Live runs use the runtime provider and retain their own model label. These are distinct, honestly identified generation paths.

## No-key runtime model

The default adapter uses Pollinations' anonymous `openai-fast` endpoint without an account, API key or billing credential. Structured profile analysis and date-turn output were verified against the real endpoint. Its public rate limit is one reply per IP per 30 seconds; a D1 reservation spaces this deployment's requests 45 seconds apart. Upstream limits or outages remain possible. Rate-limit errors are retried, and exhausted retries remain visible errors. No paid fallback or fake model success is used.

An optional Groq key selects Groq instead. `MODEL_PROVIDER=rules` explicitly enables a labelled deterministic preview when no Groq key is configured. Paid provider accounts and Apify tokens can have account-specific billing; charge ceilings do not by themselves guarantee a free account.

## Durable jobs, privacy and rankings

D1 stores source records, profiles, transcripts and job checkpoints. A lease prevents two browser requests from executing the same job simultaneously. Each request advances one retrieval, analysis, conversation or assessment step. The browser processes jobs while open; a refresh resumes saved progress. There is no unattended background worker or scheduler.

A signed-in ChatGPT account is not required by the app's own session model. An HTTP-only cookie isolates visitor records; the cached demo is shared read-only data. Provider keys are encrypted with AES-GCM using a server-held secret. The `?demo=1` API returns only saved demonstration data and the interface disables editing.

Each person receives24 directional candidate rankings. A profile estimate measures overlap and coverage of documented topics. Completed model dates contribute the participant's independent assessment (60%) alongside the profile estimate (40%). Every person has two completed scheduled dates; the other 22 candidates remain explicitly untested profile estimates. Scores are heuristics, not calibrated probabilities.
