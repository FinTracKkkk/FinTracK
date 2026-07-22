# FinTrack

**Track Today, Grow Tomorrow** — a personal expense, salary, debt, and savings tracker built for tracking finances across two currencies (AED in Dubai, INR in India). Offline-first PWA, syncs to Supabase when online.

## Features
- PIN-protected login (default `5656`), change/forgot-PIN recovery
- Dashboard: dual-wallet balances, live trend %, today/month spend, budget vs actual, alerts
- Quick-add expense/income with receipt photo capture
- Salary history log
- Debts (I Owe / Owed to Me) with partial payment tracking
- Savings Goals with contribution tracking
- Analytics: Daily/Weekly/Monthly/Yearly, Income vs Expense, Cash Flow, category breakdown
- PDF report export (Download + native Share)
- Fully offline-capable (service worker + localStorage), installable as a PWA
- Supabase cloud sync (transactions, salary, debts, debt payments)

## Setup

### 1. Database (Supabase)
1. Create a project at [supabase.com](https://supabase.com)
2. Open **SQL Editor → New Query**, paste the contents of `database/fintrack_schema.sql`, and run it
3. Go to **Project Settings → API**, copy the **Project URL** and **anon/publishable key**
4. Paste them into `js/supabase-config.js`

### 2. Run locally
No build step — just open `index.html` in a browser, or serve the folder with any static file server:
```
npx serve .
```

### 3. Deploy (Netlify)
1. Push this folder to a GitHub repo
2. In Netlify: **New site from Git** → select the repo → deploy (no build command needed, publish directory is the repo root)

### 4. Install as an app
Open the deployed site on your phone → browser menu → **Add to Home Screen**. Works offline after first load.

## Project structure
```
fintrack/
├── index.html          # Login
├── app.html             # Dashboard
├── salary.html
├── debts.html
├── goals.html
├── analytics.html
├── settings.html
├── manifest.json         # PWA manifest
├── sw.js                 # Service worker (offline caching)
├── css/                  # One stylesheet per module
├── js/                   # One script per module
├── icons/                # App icons
└── database/
    └── fintrack_schema.sql
```

## Notes
- All data is stored locally first (localStorage) and pushed to Supabase on sync — the app works fully offline.
- Default login PIN is `5656` — change it in Settings after first login.
- Receipts are stored as embedded images locally; for heavy receipt use, migrating to Supabase Storage is recommended (not yet wired).
