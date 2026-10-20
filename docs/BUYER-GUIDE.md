# Business Ledger — buyer guide

**One-time-purchase downloadable web app** for multi-business books. Open it in Chrome (or another modern desktop browser) — your data stays in this browser's **localStorage** on your computer. No account, no cloud sync, no SaaS backend.

## Buyer journey

1. **Open** — unzip your purchase and open `index.html` (double-click, or Chrome → File → Open File). You can also serve the folder with any static local server.
2. **Wizard** — set workspace name, currency (default ZAR), VAT yes/no, optional Listings tab, and at least one business.
3. **Books** — record income/expenses, invoices, quotes, checklists; filter by business and period.
4. **Backup** — use **Export backup** in the top bar regularly. Keep the JSON with your business records. Use **Import backup** to restore or move browsers.

## What it is / is not

| It is | It is not |
|-------|-----------|
| A private, offline-first books tool you own after purchase | A hosted accounting SaaS or multi-user cloud product |
| Browser localStorage + JSON backup files | Automatic cloud backup or bank feeds |
| Helpers for SA tax year (1 Mar – 28/29 Feb) and P&L | Tax advice, SARS eFiling, or a substitute for an accountant |
| Optional tools: quotes, projects, orders, suppliers, listings | Payroll, inventory costing, or multi-currency FX engines |

Runnable files for buyers: `index.html`, `app.js`, `styles.css`, and `assets/` (icon). Design PDFs under `docs/` are optional reference material.

## What you get

- Income and expenses by business (with optional receipt attachments)
- Invoices and generic quotes (quotes can become invoices)
- Recurring checklists (daily / weekly / monthly)
- Period filters: this month, last month, SA tax year, all time
- Profit & loss and SA tax-year helper for ITR12 prep — **not tax advice**
- Orders, suppliers, project pipeline, and **optional** digital Listings tab (`Settings` → Listings tab, or wizard checkbox)
- CSV exports and full JSON backup export/import (includes all settings, including Listings)
- Backup reminders when you have not exported recently
- Corrupt-storage recovery from a secondary browser backup copy when possible

## Backup and import

1. Click **Export backup** in the top bar. Keep the JSON file with your business records.
2. To restore (or move to another browser/computer), use **Import backup** and choose that JSON file.
3. If the folder path changes or you clear site data, localStorage may look empty — import your last export.
4. Invalid or non-Business-Ledger JSON is rejected with a clear message; do not hand-edit backups unless you know the schema.

## Update

Replace `index.html`, `app.js`, `styles.css`, and `assets/` with newer release files. Your books stay in the browser unless you clear site data. **Export a backup before updating.**

## Settings

- Workspace name, currency, VAT registered flag
- Optional **Listings** tab (hidden by default)
- Add / edit / remove businesses (name, colour, optional logo)
- Load sample data or clear all local data

## Marketing site SEO vs this app

This downloadable app ships with `robots: noindex` because it is a **private product you open locally**, not a public website. When you add a separate marketing / sales page later, put public SEO (indexable title, OG image, canonical URL) on that page — not inside buyers' unzipped app copies.

## Tests

If Playwright is installed:

```bash
node tests/smoke-ready.mjs
node tests/test-export-backup.mjs
node tests/test-listings-toggle.mjs
```

On Windows you may need Playwright next to Node, or set `PLAYWRIGHT_PATH`. Without Playwright, open `index.html` in Chrome and manually: complete the wizard → confirm Listings is hidden → enable it in Settings → add a money record → Export backup → Import backup.

## Licence

See `LICENSE.txt` (proprietary). Tax summaries are helpers only; use them with your documents and a tax practitioner or SARS guidance.
