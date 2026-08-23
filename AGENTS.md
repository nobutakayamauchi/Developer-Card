# Developer Card public-surface guardrail

`Developer-Card` is the public product surface and intentionally open integration/demo layer.

## Public repo may contain
- FV onboarding UI and public GitHub selection UX
- deterministic X/SNS card renderer
- public Web summary presentation
- public schemas/contracts that are intentionally exposed
- privacy/consent UI
- public documentation, examples, test fixtures, and reviewed exports
- client code that does not contain secrets or proprietary scoring logic

## Route to private Core
Do not add proprietary/commercial-core logic here when it would expose copy-sensitive value. Route these to the authorized private `Developer-Card-Core` repository once created:
- capability scoring internals / weights / proprietary prompts
- Tech Radar matching/ranking logic
- Repository Opportunity Assessment internals
- Exposure Risk Advisor internals
- AI editorial review, DA, Counter-DA orchestration
- private diagnostic generation logic
- paid entitlement / fulfillment internals
- provider keys, secrets, private evaluation fixtures
- commercial anti-abuse / metering details where disclosure materially weakens protection

## Hard rule
Public visibility is not consent to publish a user's private diagnostic or proprietary analysis details.

The public surface may call a bounded Core API using explicit contracts. Public exports from Core must be allowlist-driven and reviewed.
