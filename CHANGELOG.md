# Changelog

## 1.0.3 — 2026-10-19

- Fix: saving a money record failed with "Enter a valid date" in time zones ahead of UTC (e.g. South Africa); date validation no longer depends on the time zone
- Fix: today's date, invoice due dates and the weekly checklist reset range now use local dates instead of UTC

## 1.0.2 — 2026-09-24

- Fix: Reports and Checklists failed to load ("businesses is not defined"), so Reports showed R0 and checklist items could not be matched to a business

## 1.0.1 — 2026-09-21

- Optional **Listings** tab (wizard checkbox + Settings); hidden by default
- Sale-hardening: robust localStorage save/load with quota errors and corrupt JSON recovery
- Backup import schema validation with clearer buyer-facing errors
- Money amount / date / required-field validation on money records
- Export/import preserves `showListings` and full workspace settings
- Accessibility: skip link, wizard focus + `aria-modal`, stronger `:focus-visible`
- SEO hygiene for downloadable app: title, meta description, Open Graph basics, `lang=en-ZA`, `robots=noindex`
- README scope honesty (what it is / is not), buyer journey, marketing-site SEO note
- Playwright coverage: wizard path, Listings toggle, export/import `showListings`, nav + transaction smoke


## 1.0.0 — Product downloadable release

- First-run setup wizard (workspace name, currency default ZAR, VAT flag, 1+ businesses)
- No hardcoded personal businesses or logos; neutral Business Ledger branding
- Optional clearable sample data from wizard / Settings
- Kept: income/expenses, invoices, generic quotes, checklists, period filters, P&L, SA tax year (1 Mar–28/29 Feb), receipts, CSV/JSON export+import, backup reminders
- Removed: personal business seeds, NSR/Powers Publication localhost embeds, private publish-ban project notes for buyers
- Buyer-facing README, proprietary LICENSE.txt, this changelog
- Smoke and export tests updated for wizard + export/import
