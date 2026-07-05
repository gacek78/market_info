# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Market Info — an AI market-monitoring app for a Polish IKE (retirement account) investor on the XTB broker. (The UI brand is "Market Info"; some backend code/logs still reference the legacy name "Sentinel IKE".) The backend orchestrates Google Gemini calls (with Google Search grounding) over a watchlist of ETFs/stocks and tracked finance influencers, fuses in real market quotes, and emits "signals". The frontend renders those signals; a backend cron can push high-severity signals to Telegram. UI text, prompts, and most comments are in Polish.

## Architecture

Two independent npm packages, no shared workspace — `backend/` (Express + ts-node, port 3000 in-container) and `frontend/` (React 19 + Vite, port 3000 in-container). They communicate over REST only.

### Two-phase analysis (the core flow)
Each ticker is analyzed in two phases, mirrored on both sides (`apiService.ts` ↔ `geminiService.ts`):
- **Fast (Faza 1)** — `MODEL_FAST`, no Google Search, JSON mode on. A quick estimate from the model's own knowledge; signals tagged `phase: 'fast'`. Cheap, instant.
- **Deep (Faza 2)** — runs in **two model calls** because Gemini cannot combine `googleSearch` with `responseMimeType: 'application/json'`:
  1. **Research** — `MODEL_DEEP` with `tools: [{ googleSearch: {} }]`, free-text output. Grounding sources are pulled from `candidates[0].groundingMetadata.groundingChunks`.
  2. **Structure** — `MODEL_STRUCTURE`, JSON mode, no search; converts the research text into structured signals. Must not invent data beyond the research.

  Real quotes (FX, VIX) always overwrite whatever the model produced for `globalData`. Signals tagged `phase: 'deep'`.

### Real market data (`backend/marketData.ts`)
Quotes are fetched from free, keyless endpoints and injected into the Deep research prompt as "hard data, do not guess": FX from **Frankfurter.app** (ECB data), **VIX from Yahoo Finance** chart API, and per-ticker prices best-effort from **Stooq** CSV (requires a browser `User-Agent` or it returns empty; tries ticker-suffix variants like `.l`→`.uk`, stripping `.pl`). All fetchers swallow errors and return `null`/`ND` rather than throwing.

### Persistent state (`backend/stateManager.ts`)
Single JSON file at `DATA_DIR` (default `backend/data/state.json`, git-ignored, Docker volume-mounted to survive restarts). Holds ETFs, influencers, sent-alert dedup keys, and a recent-signals history. Lazy-loaded singleton with a serialized write-lock. Seeds from `TRACKED_ETFS` / `DEFAULT_INFLUENCERS` in `backend/constants.ts` on first run.

### Notifications (`backend/notifier.ts`)
`node-cron` (schedule `ALERT_CRON`) runs `runAlertScan()`: deep-analyzes GLOBAL + every tracked ETF, keeps signals at/above `ALERT_SEVERITY`, drops already-sent ones (dedup via `alertKey`), and sends an HTML digest to Telegram (chunked under Telegram's ~4096-char limit). Disabled unless both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set. `ALERT_CRON` accepts **multiple `;`-separated cron expressions** (e.g. `0 5 * * *;55 13 * * *` = scans at 05:00 and 13:55) — `index.ts` splits on `;` and schedules each. Schedules run in **Polish local time**: `docker-compose.yml` sets `TZ=Europe/Warsaw` and the backend image installs `tzdata` (alpine otherwise ignores `TZ`, so cron would fire in UTC).

### Portfolio summary ("Podsumowanie dla mnie")
A cross-asset synthesis layer on top of the per-ticker signals. `generatePortfolioSummary` (`geminiService.ts`) takes the investor's free-form **strategy** text (stored in `state.json`, edited via `GET|PUT /api/strategy`) plus **all** fresh signals from a full scan and returns a `PortfolioSummary` (overall stance, headline, narrative, per-asset HOLD/ACCUMULATE/WATCH/REDUCE, action items) — single JSON-mode call, no Google Search, strict "don't add info beyond the signals" rule. `notifier.ts` exposes `scanAllTargets()` (the deep-scan loop, factored out of `runAlertScan`) so **one scan feeds both** the high-severity Telegram digest and the summary; the cron prepends a "🧭 Podsumowanie dla Ciebie" section (gated by `PORTFOLIO_SUMMARY`). `scanAllTargets` persists its full result as `lastScan` in `state.json`; `POST /api/summary` **reuses that scan if it's fresher than `SUMMARY_REUSE_MIN` minutes (default 300 = 5 h)** and only re-scans everything otherwise (a full scan is ~a dozen Gemini calls). The UI panel (`frontend/components/PortfolioSummary.tsx`, shown on the GLOBAL view) also loads the last cached summary via `GET /api/summary`.

### Macro calendar ("Nadchodzące wydarzenia")
The Deep research prompt asks (with today's date injected) for a "KALENDARZ" section — upcoming dated events (RPP/FOMC decisions, CPI releases for GLOBAL; earnings/dividend dates for tickers). The structure step maps it to `calendar: EconomicEvent[]`; `sanitizeCalendar` (`geminiService.ts`) drops past/invalid dates (validated against the current date), sorts, caps at 10. Fast phase always returns `calendar: []` (no search → dates would be hallucinated). `scanAllTargets` dedupes events across targets (key: `date|event`). `generatePortfolioSummary` receives the calendar and returns `upcoming[]` — per event, what to expect when results are announced; rendered in the summary panel and in the Telegram digest. Frontend shows the calendar via `components/MacroCalendar.tsx` (rendered for the currently selected target).

### Frontend specifics
- `apiService.ts` owns a **sessionStorage cache** (`CACHE_TTL_MS`, 1h) — only Deep results are cached. It also computes signal `priority` by age and `getSourceCredibility` against the `TRUSTED_SOURCES` map. Google grounding wraps the real URL in a `vertexaisearch` redirect, so the backend (`resolveRedirect` in `marketData.ts`) follows it to the real URL and stores the resolved `domain` on each source; `getSourceCredibility` prefers that `domain`, then falls back to parsing the URI/title and finally the `SOURCE_NAME_ALIASES` map (e.g. "Reuters" → reuters.com).
- **Signal trust markers**: Fast (Faza 1) signals are model-knowledge-only and get a `⚡ Szacunek · niezweryfikowane` badge. Deep high-severity signals are re-checked via `verifyHighSeveritySignals` (`MODEL_VALIDATE` + Google Search, gated by `VALIDATE_SIGNALS`); a failed check sets `verified: false` → `✗ Niepotwierdzone` badge in the UI and the signal is dropped from Telegram alerts.
- `App.tsx` orchestrates: load ETFs/influencers from backend → Fast → Deep, with an AI Studio API-key auth gate (`window.aistudio`).

## Important gotchas

- **`API_BASE_URL` in `frontend/services/apiService.ts:4` is a hardcoded LAN IP** (`http://192.168.88.8:3010`), not the `VITE_API_URL` env var that docker-compose sets. Change it there if the backend host differs.
- **Gemini model IDs live only in `backend/constants.ts`** (`MODEL_FAST` / `MODEL_DEEP` / `MODEL_STRUCTURE` / `MODEL_VALIDATE`) — one place to change.
- **Constants are duplicated**: `TRACKED_ETFS` / `DEFAULT_INFLUENCERS` exist in both `backend/constants.ts` and `frontend/constants.ts` (frontend copies are fallbacks only). Keep them in sync if editing.
- Forcing JSON output disables Gemini search — never add `responseMimeType: 'application/json'` to a call that needs `googleSearch`; use the two-step research→structure pattern instead.
- The Gemini API key env var is **`API_KEY`** on the backend (and `GEMINI_API_KEY` is mapped to `process.env.API_KEY` in `frontend/vite.config.ts`).
- Both compose services set `restart: unless-stopped`. **Production** runs on a home NAS under `docker compose` (V2) at `/compose/market_info`; deploy = `git pull` + `docker compose up -d --force-recreate <svc>` (frontend uses vite with a mounted volume, so no image rebuild needed for code; rebuild only when the Dockerfile changes). The server's `.env` is **separate and git-ignored** — `ALERT_CRON`/secrets must be edited on the server, never committed.

> **Operational context lives in Claude Code memory** (this machine, `~/.claude/`), not in the repo: SSH/deploy access to the NAS, the container inventory, and Docker disk-hygiene rules are in **global memory** (`nas_server_access.md`); market_info-specific deploy notes and gotchas are in **project memory** (`deployment.md`). Check those before asking the user how to reach or deploy to the server.

## Commands

```bash
# Backend (from backend/)
npm install
npm run dev      # ts-node index.ts — dev server
npm run build    # tsc → dist/
npm start        # node dist/index.js

# Frontend (from frontend/)
npm install
npm run dev      # vite dev server
npm run build    # vite build
npm run preview

# Full stack
docker-compose up --build   # frontend :81, backend :3010 (host ports)
```

There is no test suite, linter, or typecheck script configured. `buildDigestMessages` and `formatSignal` in `notifier.ts` were deliberately split out to be testable without sending.

## Useful backend endpoints

- `POST /api/market-intel/fast` · `POST /api/market-intel/deep` — `{ ticker, marketType }`
- `POST /api/validate-ticker` — checks XTB availability via Gemini + search
- `GET|POST|DELETE /api/etfs` · `/api/influencers` (+ `POST /api/influencers/reset`)
- `GET /api/signals/recent` — recent scan history
- `GET|PUT /