# Canonical X Card V2 — Frozen Visual Contract

This document freezes the user-approved visual source of truth for Developer Card FV.

## Canonical share card
The canonical X card is the reference layout with:
- large full-body character on the left;
- `GitHub解析でわかる` eyebrow;
- large gradient `開発スタイル診断` title;
- short subtitle about strengths / development pattern;
- developer type as the dominant identity;
- four compact evidence metrics;
- right-side QR panel labeled as the detail report entrance;
- short bottom tagline.

This is the ONLY canonical share-card specification.

## One renderer contract
The on-page X-card preview and the exported 1200×675 PNG MUST be produced from the same `ShareCardModel`.

Forbidden regression:
- bringing back the old left-profile / five-bar / TOP3 status card as the exported X card;
- using a separate legacy Canvas renderer for export;
- using a different public card for download and preview.

## Two-layer output
1. X card — 16:9 single share asset.
2. Detailed Web report — profile, radar, activity, languages, repository TOP3, strengths, growth points, Deep CTA.

The detailed report may contain more data than the X card, but must never mutate the X-card visual contract.

## Share actions
Actions are deliberately separated:
- `Xカードを保存` => downloads the canonical 1200×675 PNG.
- `投稿文をコピー` => copies posting text + public-safe report URL.

Do not route both buttons through the same iOS share sheet.

## QR / public report
The QR points to a public-safe report URL containing aggregate/public output only. It MUST NOT encode:
- EXCLUDE repository identities;
- EVALUATE_ONLY repository identities;
- private findings;
- paid/private Core data.

## Reality gate
PASS requires iPhone Safari to complete:
GitHub load -> repo authorization -> confirmation -> Generate -> canonical X-card preview -> detailed report -> PNG save -> text copy without tab termination.
