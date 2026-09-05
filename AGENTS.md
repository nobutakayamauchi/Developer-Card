# AGENTS.md

## Repository role
Developer Card is the public product surface for evidence-backed GitHub self-discovery, lightweight diagnosis, public summaries, and shareable cards.

## Load order
1. Read `README.md`.
2. Load only the files needed for the current FV/public-surface task.
3. If the task enters private analysis or commercial-core logic, route it to `nobutakayamauchi/Developer-Card-Core`.

## Source of truth
- Public UX, public schemas, consent controls, and public rendering live here.
- Private/commercial analysis logic belongs in the Core repository.

## Context budget
- Never send whole repositories blindly to an LLM.
- Prefer bounded evidence packets, static extraction, caching, and targeted reads.
- Do not load deep-analysis internals for ordinary FV/public-card work.

## Human gates
- Repository evaluation scope and public exposure require explicit owner consent.
- Publication, paid actions, external messaging, deletion, or permission changes require human approval.

## Stop conditions
Stop when public/private boundaries are unclear, consent is missing, or evidence is insufficient to support a public claim.