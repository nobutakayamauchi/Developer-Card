# iPhone Reality findings — 2026-08-23

## Current validated findings

### DC-FV-008 — QR runtime fallback surfaced as DETAIL
Observed on iPhone Reality: the canonical card rendered the QR zone as a `DETAIL` placeholder instead of a scannable QR.

Fix:
- replaced remote ESM `qrcode` dynamic import path with classic browser-compatible `qrcodejs` runtime loaded before app modules;
- canonical DOM preview and PNG export still consume the same `qr_data_url` from `ShareCardModel`;
- regression test rejects the old `DETAIL` fallback path.

### DC-FV-009 — iPhone download opened file preview instead of Photos save flow
Observed on iPhone Reality: `Xカードを保存` navigated to a Safari file preview for `developer-card-x.png`.

Fix:
- when Web Share file support exists, the save action now opens the native share sheet with the PNG only;
- user can choose `画像を保存` to place the card in Photos;
- `投稿文をコピー` remains a separate clipboard-only action;
- desktop/non-supporting browsers retain download fallback.

### DC-FV-010 — uploaded white-background avatar looked pasted onto canonical card
Observed on iPhone Reality: the selected character image retained a large white rectangular background.

Fix:
- image preprocessing is bounded to 512x512;
- when a majority of the image border is near-white, only border-connected near-white pixels are made transparent;
- enclosed white subject areas (for example a white shirt bounded by outlines) are not intentionally removed.

## Reality stop line before merge
Re-run on iPhone Safari after GitHub Pages deployment:
1. GitHub load -> repo states -> confirmation -> Generate.
2. QR is visibly scannable, not `DETAIL`.
3. QR opens the public-safe detailed report.
4. uploaded character no longer has the large connected white rectangle where edge-background removal is applicable.
5. `Xカードを保存` opens the native share sheet; `画像を保存` is available.
6. `投稿文をコピー` copies text without opening the same share flow.
7. no Safari tab termination through the full flow.

CI at the latest implementation head passed after the fixes above.
