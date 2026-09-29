# Admin letter themes

In Letters, create or open a letter and use Letter Theme to choose Romance,
Birthday, Sympathy, Family, or Classic (original). Sympathy supports Comfort and
support or In remembrance. Save Changes persists the choice; Publish saves content
and theme together before making the letter available. The existing QR URL stays
the same. Theme labels are shown on the letter list.

The storefront must include its ThemedLetterExperience renderer, and the database
must have the storefront migration 202609130001_letter_event_themes.sql applied
before releasing this admin update. It adds nullable letter_theme and sympathy_mode
columns; existing NULL themes keep their original design. No access rules change.

The theme card is a design sample, not an unsaved live preview. The published
letter link displays the saved choice. Existing template and media fields are
preserved. Theme-specific page journeys omit blank chapters, so their old fixed
ten-page analytics labels are hidden; feature totals remain available.
