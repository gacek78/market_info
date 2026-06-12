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

### Frontend specifics
- `apiService.ts` owns a **sessionStorage cache** (`CACHE_TTL_MS`, 1h) — only Deep results are cached. It also computes signal `priority` by age and `getSourceCredibility` against the `TRUSTED_SOURCES` map. Google grounding wraps the real URL in a `vertexaisearch` redirect, so the true domain is parsed from the source **title**, not the URI.
- `App.tsx` orchestrates: load ETFs/influencers from backend → Fast → Deep, with an AI Studio API-key auth gate (`window.aistudio`).

## Important gotchas

- **`API_BASE_URL` in `frontend/services/apiService.ts:4` is a hardcoded LAN IP** (`http://192.168.88.8:3010`), not the `VITE_API_URL` env var that docker-compose sets. Change it there if the backend host differs.
- **Gemini model IDs live only in `backend/constants.ts`** (`MODEL_FAST` / `MODEL_DEEP` / `MODEL_STRUCTURE` / `MODEL_VALIDATE`) — one place to change.
- **Constants are duplicated**: `TRACKED_ETFS` / `DEFAULT_INFLUENCERS` exist in both `backend/constants.ts` and `frontend/constants.ts` (frontend copies are fallbacks only). Keep them in sync if editing.
- Forcing JSON output disables Gemini search — never add `responseMimeType: 'application/json'` to a call that needs `googleSearch`; use the two-step research→structure pattern instead.
- The Gemini API key env var is **`API_KEY`** on the backend (and `GEMINI_API_KEY` is mapped to `process.env.API_KEY` in `frontend/vite.config.ts`).
- Both compose services set `restart: unless-stopped`. **Production** runs on a home NAS under `docker compose` (V2) at `/compose/market_info`; deploy = `git pull` + `docker compose up -d --force-recreate <svc>` (frontend uses vite with a mounted volume, so no image rebuild needed for code; rebuild only when the Dockerfile changes). The server's `.env` is **separate and git-ignored** — `ALERT_CRON`/secrets must be edited on the server, never committed.

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
- `POST /api/alerts/run` — manual scan + Telegram send · `POST /api/alerts/test` — Telegram connectivity check
- `GET /health`

## Environment variables

`API_KEY` (Gemini, required) · `TELEGRAM_BOT_TOKEN` · `TELEGRAM_CHAT_ID` · `ALERT_SEVERITY` (`low|medium|high`, default `high`) · `ALERT_CRON` (default `0 8 * * *`; supports multiple `;`-separated expressions) · `TZ` (set to `Europe/Warsaw` in compose) · `DATA_DIR` · `PORT`. See `.env.example`.
