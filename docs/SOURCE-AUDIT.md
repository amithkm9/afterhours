# Source audit

The submitted source cohort contains **25 real adult public professionals**, each with a corroborated LinkedIn account and an Instagram account whose public status was checked from Instagram's own public profile embed. The discovery pool contains 35 candidates; 34 Instagram accounts returned positive public-status evidence. Nisha Vora's embed did not return a usable profile context and was not selected.

## What was actually retrieved

- **Instagram:** unauthenticated HTTPS requests to each public profile and `/embed/` URL. Profile HTML supplied the name and bio metadata. The embed supplied recent media captions and owner objects. No cookies, accounts, paid service, or private endpoint was used.
- **Public status:** parse `contextJSON`, require the context username to match the submitted handle, and inspect only media whose owner username matches that same handle. Every included owner had `is_private: false`. Follower counts, a visible bio, and the absence of a private warning were not accepted as proof.
- **LinkedIn:** limited excerpts returned by the web search index for the person's actual LinkedIn profile. These are explicitly marked `search-excerpt`; they are not described as a successful direct LinkedIn scrape. Cached search results can lag the live profile.
- **Identity:** manual corroboration using a distinctive company, book, institution, professional identity or explicit account crosslink. Name similarity alone was insufficient. The conclusion describes account identity, not consent to participate or endorsement.
- **Persona input:** only the selected LinkedIn and Instagram account material. External discovery links helped locate/corroborate accounts but no third-party biography was inserted into a persona source.
- **Photos:** the public profile image returned by Instagram, downloaded to local JPEG assets to avoid expiring CDN URLs.

## Files

- `data/verified-people.json`: 25 source-only Person records for the application builder. Each has exactly two SourceDocuments, actual provenance and retrieval timestamps.
- `public/portraits/`: the 25 validated JPEG profile images.
- Local archive `work/research/source-capture/candidates.json`: 35 discovery candidates, source excerpts, public checks and identity rationale; 25 selected records marked verified.
- Parent workspace `../data/instagram-extracts.json`: extracted bios, short caption excerpts and per-owner public flags.
- Parent workspace `../data/linkedin-excerpts.json`: profile-page reference, source title and limited actual text.
- Local archive `work/research/source-capture/raw/`: public Instagram response HTML and the matching LinkedIn search-result blocks, retained outside the published application for audit.
- Local archive `work/research/source-capture/extract_sources.py`: repeatable extraction of existing saved Instagram HTML.
- Local archive `work/research/source-capture/build_verified_people.py`: repeatable 25-person source input builder. Analysis and conversation generation happen separately.

## Selected cohort

| Person | LinkedIn | Instagram | Corroboration |
|---|---|---|---|
| Ali Abdaal | [Profile](https://www.linkedin.com/in/aliabdaal/) | [Public profile](https://www.instagram.com/aliabdaal/) | Distinctive full name, bestselling author and creator identity; LinkedIn describes medical/Cambridge history and Instagram describes doctor-to-entrepreneur history. |
| Sahil Bloom | [Profile](https://www.linkedin.com/in/sahilbloom/) | [Public profile](https://www.instagram.com/sahilbloom/) | Both accounts name The 5 Types of Wealth and Wild Roman. |
| Anne-Laure Le Cunff | [Profile](https://www.linkedin.com/in/neuranne/) | [Public profile](https://www.instagram.com/neuranne/) | Both accounts identify Anne-Laure Le Cunff as a neuroscientist at King's College London/Institute of Psychiatry, Psychology & Neuroscience. |
| Dan Koe | [Profile](https://www.linkedin.com/in/thedankoe/) | [Public profile](https://www.instagram.com/thedankoe/) | Both accounts use the distinctive Dan Koe name and identify Eden. |
| Tiago Forte | [Profile](https://www.linkedin.com/in/tiagoforte/) | [Public profile](https://www.instagram.com/fortelabsco/) | LinkedIn names Forte Labs; Instagram fortelabsco identifies Tiago Forte. Both reference his Life in Perspective book. |
| Marie Forleo | [Profile](https://www.linkedin.com/in/marieforleo/) | [Public profile](https://www.instagram.com/marieforleo/) | Her company's LinkedIn post explicitly links @marieforleo; both accounts identify her B-School business. |
| Mel Robbins | [Profile](https://www.linkedin.com/in/melrobbins/) | [Public profile](https://www.instagram.com/melrobbins/) | Both accounts identify The Mel Robbins Podcast and Pure Genius Protein. |
| Adam Grant | [Profile](https://www.linkedin.com/in/adammgrant/) | [Public profile](https://www.instagram.com/adamgrant/) | Both accounts identify Adam Grant and Wharton; Instagram calls him an organizational psychologist. |
| Jay Shetty | [Profile](https://www.linkedin.com/in/shettyjay/) | [Public profile](https://www.instagram.com/jayshetty/) | Both accounts identify Jay Shetty and the Juni business, author and podcast work. |
| Vanessa Van Edwards | [Profile](https://www.linkedin.com/in/vanessavanedwards/) | [Public profile](https://www.instagram.com/vvanedwards/) | Both accounts identify the distinctive Vanessa Van Edwards name and her behavioral researcher/bestselling author work. |
| Chris Do | [Profile](https://www.linkedin.com/in/thechrisdo/) | [Public profile](https://www.instagram.com/thechrisdo/) | Both accounts identify Chris Do as founder of The Futur. |
| Gary Vaynerchuk | [Profile](https://www.linkedin.com/in/garyvaynerchuk/) | [Public profile](https://www.instagram.com/garyvee/) | His official website explicitly links both accounts; platform profiles identify the same Vayner business leader. |
| Grace Beverley | [Profile](https://www.linkedin.com/in/grace-beverley-574a10102/) | [Public profile](https://www.instagram.com/gracebeverley/) | LinkedIn identifies TALA and Shreddy founder Grace Beverley; Instagram names both ventures and uses @gracebeverley. |
| Codie Sanchez | [Profile](https://www.linkedin.com/in/codiesanchez/) | [Public profile](https://www.instagram.com/codiesanchez/) | Both accounts identify Codie Sanchez and Contrarian Thinking. |
| Leila Hormozi | [Profile](https://www.linkedin.com/in/leilahormozi/) | [Public profile](https://www.instagram.com/leilahormozi/) | Both accounts identify Leila Hormozi and Chairwoman of Acquisition.com. |
| Alex Hormozi | [Profile](https://www.linkedin.com/in/alexhormozi/) | [Public profile](https://www.instagram.com/hormozi/) | Both accounts identify Alex Hormozi and Acquisition.com. |
| Austin Kleon | [Profile](https://www.linkedin.com/in/austin-kleon-31116437b/) | [Public profile](https://www.instagram.com/austinkleon/) | Both accounts identify Austin Kleon as author of Steal Like an Artist. |
| Gretchen Rubin | [Profile](https://www.linkedin.com/in/gretchenrubin/) | [Public profile](https://www.instagram.com/gretchenrubin/) | Both accounts identify Gretchen Rubin and The Four Tendencies framework. |
| James Clear | [Profile](https://www.linkedin.com/in/jamesclear/) | [Public profile](https://www.instagram.com/jamesclear/) | LinkedIn explicitly lists the Instagram URL; both identify James Clear and writing about habits. |
| Ryan Holiday | [Profile](https://www.linkedin.com/in/ryanholiday/) | [Public profile](https://www.instagram.com/ryanholiday/) | Both accounts identify Ryan Holiday and The Painted Porch Book Shop. |
| Mark Manson | [Profile](https://www.linkedin.com/in/markmanson/) | [Public profile](https://www.instagram.com/markmanson/) | Both accounts identify Mark Manson and Purpose. |
| Hala Taha | [Profile](https://www.linkedin.com/in/htaha/) | [Public profile](https://www.instagram.com/yapwithhala/) | Both accounts identify Hala Taha and YAP Media/Young and Profiting. |
| Aileen Xu | [Profile](https://www.linkedin.com/in/aileenxu/) | [Public profile](https://www.instagram.com/lavendaire/) | Both accounts identify Aileen Xu, Lavendaire and Resonance, and use the life-is-an-art phrase. |
| Nathan Barry | [Profile](https://www.linkedin.com/in/nathanbarry/) | [Public profile](https://www.instagram.com/nathanbarry/) | Both accounts identify Nathan Barry and Kit. |
| Amanda Natividad | [Profile](https://www.linkedin.com/in/amandanat/) | [Public profile](https://www.instagram.com/amandanat/) | Both accounts identify Amanda Natividad, SparkToro and Zero Click Marketing. |

## Verified checks and limits

Validation checked 25 unique people, 25 unique LinkedIn URLs, 25 unique Instagram URLs, exactly 50 nonempty ready source records, and a positive target-specific Instagram public check for every selected person. All 25 portrait files passed the JPEG signature check.

The data does not establish romantic availability, dating preferences, orientation, relationship needs, or willingness to participate. The application must keep its dates clearly identified as agent simulations and mark unsupported needs/preferences unknown. Public marketing statements and reposted/coauthored captions are evidence of published content, not proof of private personality.

The LinkedIn excerpts are deliberately limited and sometimes truncated by the search index. Analysis must retain that uncertainty. A new live import cannot silently substitute this cached cohort or invent a successful scrape when a provider blocks access.
