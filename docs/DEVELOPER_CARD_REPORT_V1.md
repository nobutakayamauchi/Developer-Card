# DeveloperCardReport v1 — Machine-readable contract

Status: **FV contract frozen for Reality validation**

## Purpose

Developer Card has one canonical public-safe report model. Human views and machine/automation views must be projections of the same model:

`GitHub Evidence -> DeveloperCardReport v1 -> X card / detailed Web report / machine JSON`

The machine contract exists so future Deep analysis, portfolio generation, consent-based hiring analysis, AI workflows, and API delivery do not scrape the human UI.

## Identity

- `schema`: `developer-card-report`
- `schema_version`: `1`
- JSON Schema: `schema/developer-card-report.v1.schema.json`
- `public_safe`: always `true` in the FV public contract
- `evidence_scope`: `public-safe-aggregate`

## Privacy boundary

The serializer is allow-list based. Unknown fields are dropped.

The public machine report MUST NOT include:

- EXCLUDE repo identities or metadata;
- arbitrary internal fields accidentally attached to runtime objects;
- uploaded image Data URLs;
- secrets, tokens, private repository data, or authenticated GitHub data.

Detailed `recommended` repo identities are constrained to the same repo names already present in the public top-level `recommended` list.

## Transports

### Human report URL

New FV links use:

`?report=<base64url-token>`

The token is in the query rather than the URL fragment so the complete report reference survives ordinary server-side URL handling and can be handed to automation intact.

Old `#report=<token>` FV links remain readable for backward compatibility, but new links MUST NOT be emitted in fragment form.

### Machine view URL

`?report=<base64url-token>&view=json`

On the static GitHub Pages FV, browser JavaScript decodes the token and renders canonical JSON in `#machineReport`.

**Important limitation:** this is not yet an HTTP JSON API. A raw HTTP client that does not execute browser JavaScript receives the static HTML shell. Such clients should consume the exported JSON file or decode the `report` query token according to this contract. A future backend/API may serve this exact schema with `application/json` without changing the report model.

### JSON artifact

The UI exposes `JSONレポートを保存`, producing:

`developer-card-report-v1.json`

This file is the preferred FV handoff for tools that ingest files directly.

## Versioning rule

Breaking field or semantic changes require `schema_version: 2` (or later). Adding a backend transport does **not** require a schema bump if the JSON contract is unchanged.

## Reality stop line

Before merge, validate on iPhone Safari:

1. Generate a Developer Card report.
2. Existing human detailed report still opens from the X-card QR.
3. `JSONレポートを保存` produces a parseable v1 JSON file.
4. `Machine URLをコピー` produces a URL containing `report=` and `view=json`.
5. Opening that Machine URL renders `DeveloperCardReport v1` JSON.
6. No EXCLUDE / non-public identity appears in the machine output.
7. Legacy `#report=` links remain readable.
