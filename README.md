# Jnayen Trading Journal — v2 (no-AI)

A self-hosted trading journal for MetaTrader 5 traders.

This is the **no-AI** variant of the original Jnayen Trading project: same
backend, same frontend, same MT5 bridge, **without** the OpenAI integration
or the `AI Analysis` page.

## Stack

- **Monorepo**: pnpm workspaces, TypeScript 5.9
- **Backend**: Express 5, Drizzle ORM, PostgreSQL, Zod, pino
- **Frontend**: React 18, Vite, Tailwind CSS, shadcn-style components,
  Recharts, TanStack Query, Wouter, Framer Motion, lucide-react
- **MT5 Bridge**: Python script (served by the API and stored in
  `artifacts/api-server/src/bridge/tradj_bridge.py`)

## Layout

```
artifacts/
  api-server/        # Express 5 REST API
  trading-journal/   # React + Vite SPA
lib/
  db/                # Drizzle schema + migrations
docs/
  openapi.yaml       # API contract (reference only)
scripts/
  post-merge.sh
```

## Quick start

```bash
# 1. Install
pnpm install

# 2. Postgres (any PG ≥ 14 works)
createdb tradej
export DATABASE_URL="postgres://tradej:tradej@localhost:5432/tradej"

# 3. Push the schema
pnpm db:push

# 4. Seed the demo account (demo / demo1234) + 20 sample trades
pnpm seed

# 5. Run the API (default :3000)
pnpm dev:api

# 6. Run the web UI (default :5173, proxies /api to :3000)
pnpm dev:web
```

Open <http://localhost:5173> and sign in with **demo / demo1234**.

### Environment variables

See `.env.example`. The API and seed scripts both read `DATABASE_URL`.

## Pages

- `/login` and `/register`
- `/` — Dashboard (P&L, win rate, profit factor, equity curve, by-symbol)
- `/trades` — CRUD + JSON bulk import
- `/calendar` — Daily P&L heatmap
- `/analytics` — Trader score, insights, per-symbol breakdown
- `/bridge` — Download the MT5 bridge script
- `/settings` — Token management

## API

REST endpoints under `/api/*`. See [`docs/openapi.yaml`](./docs/openapi.yaml).

## MT5 Bridge

The bridge is a single Python file. Download it from the **Bridge** page in
the app, then on the same machine as MetaTrader 5:

```bash
pip install MetaTrader5 requests

# One-shot
python tradj_bridge.py --api-url https://YOUR_DOMAIN/api \
    --api-token YOUR_TOKEN --days 30

# Daemon
python tradj_bridge.py --api-url https://YOUR_DOMAIN/api \
    --api-token YOUR_TOKEN --watch --interval 15
```

State is persisted in `~/.tradj_bridge.json`. Server-side, the
`UNIQUE (user_id, ticket)` constraint blocks duplicates.

## Scripts

- `pnpm typecheck` — TypeScript across all packages
- `pnpm build` — Build the frontend (and esbuild bundle the API)
- `pnpm db:push` — Push the Drizzle schema to your `DATABASE_URL`
- `pnpm seed` — Create the `demo` user + 20 sample trades

## License

Built by jnayzn. Personal use.
