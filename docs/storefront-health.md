# Storefront Health

Owner-only error inbox: `/storefront-health` (sidebar: **Storefront Health**).

Shows reports, open/priority/resolved totals, action/page/code search, market/status/date filters, pagination, optional 30-second refresh, and resolve/reopen actions. Reports exclude customer content and QR tokens.

Deploy the canonical migration and `report-storefront-error` function from the **stack-petals storefront repository**, following its `docs/storefront-error-tracking.md`. Both applications must connect to the same Supabase project. This admin repository does not duplicate the migration.

Access requires `investor_profiles.role = 'admin'` and `admin_market = 'ALL'`; database RLS enforces this independently of navigation. Customers cannot read or write the report table directly. A new failure after resolution produces a new open report; counts are received reports, not unique customers.

The feature has not been deployed to the live database. Until setup is complete, the inbox shows an actionable load error, not a false healthy status.
