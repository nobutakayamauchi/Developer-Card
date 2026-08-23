# Developer Card

GitHub evidence → lightweight self-discovery → shareable X card → optional deep analysis → portfolio.

## V1 product thesis
Developer Card starts as a fun tool for indie/personal developers: paste GitHub, choose what may be evaluated, get a developer-style diagnosis and a 16:9 social card. The deeper product turns hard-to-explain technical work into an evidence-backed portfolio and helps the owner decide what to promote, summarize, mask, or keep private.

## Canonical flow

```text
GitHub URL / username
  -> repository discovery
  -> Gate 1: SHOWCASE_AND_EVALUATE / EVALUATE_ONLY / EXCLUDE
  -> evidence compression
  -> FV lightweight diagnosis
  -> 16:9 X Card + lightweight public Web summary
  -> optional paid Deep analysis
  -> Private Diagnostic
  -> Tech Radar / Repository Opportunity Assessment
  -> exposure-risk review
  -> Candidate Public Report (Card A)
  -> AI editorial review -> DA -> Counter-DA
  -> Recommended Public Report (Card B)
  -> Gate 2: owner publication approval
  -> Final Public Portfolio
  -> final X Card derived only from approved public fields
```

## V1 ship line — FV first
The first public Reality target is deliberately narrow:

`GitHub -> repo selection -> explicit consent -> lightweight diagnosis -> public Web summary -> 16:9 X Card -> share`

FV must be complete and fun on its own. It is not a crippled paid demo.

### FV includes
- public handle / display image
- public GitHub repo discovery
- repo exclusion and explicit evidence-set confirmation
- static-first evidence extraction
- lightweight developer type / style
- 3–5 capability highlights
- 1–3 showcase repo recommendations
- deterministic 16:9 X Card rendering
- lightweight public Web summary
- QR/share link
- cost telemetry and abuse limits

### FV cost target
Average marginal AI cost target: `<= ¥5 / completed diagnosis` under normal usage.

Do not send whole repositories blindly to an LLM. Prefer static extraction, bounded evidence packets, one lightweight structured inference, SHA/snapshot caching, deterministic card rendering, hard spend limits, and graceful degradation.

## Paid ladder — experiment defaults
- **Deep Analysis — ¥980 / run**: hidden strengths, repo potential, technical/research connections, research/development/commercial potential, next moves.
- **Portfolio Full — ¥2,980 / run**: Deep + exposure review + AI editorial pass + DA + Counter-DA + Double Gate + owner-approved public portfolio + final social card.

Prices are launch experiments and must be configurable without code changes.

Stripe launch path: existing Payment Link / Checkout is acceptable. Paid access must be bound to verified payment; success-page redirects alone are not sufficient proof when server-side verification is available.

## Three disclosure layers
1. **X Card** — sparse, social/share-first.
2. **Public Web Report** — owner-approved portfolio/detail.
3. **Private Diagnostic** — owner-only source of truth, including findings that should not be public.

Public artifacts are lossy projections of the Private Diagnostic. Never reconstruct the private source of truth from the public card.

## Double Gate Publishing
### Gate 1 — Evidence / repository scope
Owner decides which repositories are:
- `SHOWCASE_AND_EVALUATE`
- `EVALUATE_ONLY`
- `EXCLUDE`

`EXCLUDE` contributes no evidence to the current analysis snapshot.

### Gate 2 — Publication approval
AI can recommend, summarize, mask, cut, or promote. The owner remains the publication authority. Nothing becomes public only because an AI marked it safe.

## Repository evaluation model
Keep separate:
- `CAPABILITY_EVIDENCE_VALUE`
- `SHOWCASE_ATTRACTIVENESS`
- `TECH_RADAR_MATCH`
- `NOVELTY_CONFIDENCE`
- `TECHNICAL_INTEREST`
- `FRONTIER_ALIGNMENT`
- `RESEARCH_POTENTIAL`
- `DEVELOPMENT_POTENTIAL`
- `COMMERCIAL_POTENTIAL`
- `EVIDENCE_STRENGTH`

Large repo != strong repo. Small repo != weak repo. Stars, forks, LOC, commit volume, and fashionable stacks are secondary signals only.

## External Tech Radar — flagship deep feature
For owner-authorized repositories, infer a bounded set of technical concepts and compare them against auditable external technical evidence such as papers/preprints, official engineering/research material, standards/specifications, conferences, and inspectable OSS.

Every surfaced match must explain:
- repo-side evidence
- external evidence
- why they connect
- how they differ
- confidence
- source date/reference

Do not use trendiness to inflate developer capability. Do not claim novelty, priority, or originality without strong evidence.

## Exposure Risk Advisor
Candidate public findings may be classified as:
- `SAFE_TO_PUBLISH`
- `PUBLISH_SUMMARY_ONLY`
- `MASK_DETAILS`
- `PRIVATE_RECOMMENDED`
- `DO_NOT_PUBLISH`
- `UNKNOWN_REVIEW_MANUALLY`

Watch especially for proprietary know-how, monetizable recipes, security-sensitive details, unreleased mechanics, unpublished research advantages, client-confidential information, and details that materially reduce reverse-engineering cost.

## Editorial recommendation model
Private -> Public composition may recommend:
- `PROMOTE`
- `ADD_TO_PUBLIC`
- `KEEP`
- `SUMMARIZE`
- `MASK`
- `CUT`
- `PRIVATE_ONLY`
- `MANUAL_REVIEW`

Then run:
- **DA:** Why should this NOT be published or emphasized?
- **Counter-DA:** What valuable signal would be lost if we hide/cut it?

Only surviving recommendations form Card B / Recommended Public Report.

## BYOK / WebAI Bridge reuse
Deep/Full self-use should be able to reuse a WebAI Bridge-style execution layer where the user supplies an approved AI/API configuration. Heavy inference cost can then be borne by the user instead of the platform. Never expose API keys in reports or cards.

## Future scope — frozen until GitHub V1 validates
- consent-based enterprise/scout analysis
- multi-source evidence beyond GitHub (articles, demos, slides, portfolio pages, certifications, customer-approved case studies, research artifacts, etc.)

GitHub is the first high-quality evidence adapter, not the permanent ontology.

## V1 Reality metrics
Track from day one:
- completed FV diagnoses
- selected repo count
- compressed input/output tokens
- model/provider
- cache hit/miss
- estimated marginal cost
- latency/failure/retry state
- X Card generation
- share action
- public summary views
- paid CTA impressions
- checkout clicks
- successful payments
- Deep completions
- Full upgrades

Cohort expansion should be bounded: `10 -> 30 -> 100 -> 500 -> 1,000` only when cost and reliability ceilings survive.

## Immediate implementation priority
Design the whole architecture so Deep/Full do not force a rewrite, but implement and Reality-test FV first. No V2 expansion should block FV shipment.
