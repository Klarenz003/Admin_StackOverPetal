# Gift QR PNG downloads

The owner-only Gift QR page exports tightly cropped 300 dpi PNGs using the supplied
front/back artwork. Dynamic overlays replace the sample QR, scratch instruction and
silver panel; the reverse includes the lost-card contact address. The transparent
flower SVG is a vector recreation of the supplied reference, without its background tile.

- Each side: 1063 × 638 pixels, approximately 90 × 54 mm at 300 dpi.
- Default: front and back together with a 24 px transparent cutting gap.
- Preview offers separate front/back PNGs for print-shop layouts.
- Batch: up to five front/back pairs per compact sheet (approximately 182 × 278 mm).
  Larger batches download a ZIP of PNG sheets. Batch follows the current filters.
- Corners and gaps are transparent, with no outer margin or full-page background.
  The cream background inside the card is intentionally preserved.
- PNG pHYs metadata records 300 dpi. Print at actual size, not Fit to page.
  Confirm 90 × 54 mm per side in your printing app.
- Paired sheets are side-by-side, not automatic duplex layouts. Download separate
  sides for double-sided layouts and proof registration with your printer.
- QR uses dark warm brown on cream, gently rounded eyes, a four-module quiet zone,
  H error correction and a small flower center plate. Digital scans are tested at
  three resolutions; proof-scan a physical print before a production run.
- These RGB PNGs have no bleed or crop marks. Ask commercial printers about
  borderless trimming and color conversion. Printed gold is not metallic foil.

The activation code is for composing, not reading a protected letter.
Keep unused card backs and downloads private. Never print the recipient password.
Existing codes use the new design when downloaded again; no database changes.

Validation: npm run build. With Vite on 5184 and isolated Chrome CDP on 9243,
run node scripts/check-gift-card-print.cjs (fake data only).
Install @napi-rs/canvas and jsqr in a temporary directory, then run
node scripts/verify-gift-card-png.cjs <dependency-directory> <test.png>.
