# Scrapbook — Implementation Plan & Progress

A personal scrapbook web app. Content is ingested via a Telegram bot; scraps and tagged friends render as a force-directed "detective board" graph.

## Decisions (confirmed)

- **Runtime**: Node.js 22+ via `tsx watch server/index.ts`. Hono runs on Node via `@hono/node-server`.
- **Frontend**: Solid.js + Vite, strict TypeScript, no SSR.
- **Server**: Node + Hono. TypeScript executed directly by `tsx`.
- **DB**: Postgres (local instance — connection via `DATABASE_URL`, default `postgres://localhost:5432/scrapbook`). Driver: `pg` + Kysely's built-in `PostgresDialect`.
  - Same Kysely instance for runtime and migrations (`kysely.config.ts` constructs a separate `pg.Pool` because `kysely-ctl` loads via `jiti` and can't resolve the `~/*` alias).
  - **Plugins** (runtime only) in order: `JSONPlugin` then `CamelCasePlugin`. `JSONPlugin` (`server/db/json-plugin.ts`) auto-serialises objects/arrays and casts them to `jsonb`; declare JSON columns as `jsonb` in migrations. `CamelCasePlugin` maps snake_case columns to camelCase identifiers.
  - **Timestamps**: `timestamptz` columns with `default current_timestamp`. The Kysely schema types them as `GeneratedAlways<Date>` so callers can never write them. `pg` parses `timestamptz` to JS `Date` natively. `updated_at` on `ingestion_sessions` is kept honest by a `set_updated_at` trigger (Postgres defaults only fire on INSERT). Zod models use `z.date()`.
- **Models**: Zod schemas in `shared/models/`. Type names already PascalCase (`Scrap`, `Person`, …). **Kysely table types are derived from the Zod model types** via `Omit<Model, divergent fields> & { ... }` — only fields whose storage shape differs from the model (timestamps wrapped in `ColumnType`, JSON-serialised arrays, denormalised joined fields like `peopleIds`) are overridden; everything else flows through automatically.
- **File naming (only two patterns allowed)**:
  - **TitleCamelCase** (`PascalCase`) for models and components — anything that exports a single primary class/type/component, e.g. `shared/models/Scrap.ts`, `client/src/components/Canvas.tsx`.
  - **kebab-case** for everything else (services, repositories, utils, app modules, configs, plugins) — e.g. `server/db/json-plugin.ts`, `server/services/media-storage.ts`, `client/src/app/force-simulation.ts`.
  - **Exception**: migration files use `snake_case` (e.g. `0001_initial.ts`, `0002_add_contact_log.ts`) — this is the convention `kysely-ctl` generates with and matches typical SQL migration tooling.
  - No camelCase or other styles for filenames anywhere else.
- **Path aliases**: every cross-folder import uses the `~/*` alias rooted at the project root (e.g. `~/shared/models/Scrap.ts`, `~/server/db/connection.ts`). No `../../` imports anywhere. Configured via `baseUrl: "."` + `paths` in the single root `tsconfig.json` and matching `resolve.alias` in `vite.config.ts`.
- **Layer boundary (Claude rule, not compiler-enforced)**: `client/**` and `shared/**` must never import from `~/server/...`. The single tsconfig means TypeScript will not catch this — the rule lives in `CLAUDE.md` and is enforced by review/agent discipline.
- **Storage**: local disk, `STORAGE_ROOT` env var (default `./storage` in dev).
- **Messaging**: Telegram bot (created via @BotFather). Webhook `/api/webhooks/telegram` verified via the `X-Telegram-Bot-Api-Secret-Token` header (set when registering the webhook). Single-user gating via `TELEGRAM_ALLOWED_CHAT_ID`: the bot ignores any update whose `message.chat.id` doesn't match. Telegram chose over WhatsApp/Twilio because it has no 24h session window, no template approvals, no business verification, and a flat REST + JSON-webhook surface that doesn't require an SDK.
- **Public tunnel (dev)**: `@ngrok/ngrok` is a runtime dependency. When `NODE_ENV === "development"` the server starts an ngrok tunnel against the local HTTP port at startup, logs the public URL, and uses that URL as `PUBLIC_BASE_URL`. The Telegram webhook URL is registered manually against this URL — re-register on each ngrok restart unless using a reserved domain. Lives in `server/app/public-url.ts`; `getPublicBaseUrl()` is the only consumer-facing accessor. Requires `NGROK_AUTHTOKEN` in `.env`.
- **Logging**: `pino` (with `pino-pretty` in dev) via `server/utils/logger.ts`. **Never use `console.log` anywhere.** Server code always imports `logger` from `~/server/utils/logger.ts`. On the frontend, `console.error` is permitted for ad-hoc debugging; `console.log` / `console.warn` / `console.info` are not.
- **Web UI auth**: none — server binds to `127.0.0.1` (LAN-only). Webhook is the only public surface, exposed via the auto-started ngrok tunnel in dev.
- **Multi-photo messages**: one scrap per image, sharing the friend tags collected at the end.
- **Lint/format**: Biome with `style/useImportType` + `style/useExportType` at error level. Paired with `verbatimModuleSyntax: true`.
- **No `helpers.ts` / `helpers/` anywhere.**

## File-type conventions

- Pure functions → `utils.ts` / `utils/thing.ts`.
- Service interactions (DB, external APIs) → `services.ts` / `services/thing.ts`.
- Reusable complex DB queries → `repositories/thing.ts`.
- Complex async/side-effecting business logic → `app/thing.ts` per layer.
- Shared Zod models → `shared/models/<PascalName>.ts`.

## Folder skeleton

```
scrapbook/
├── .env.example
├── .gitignore
├── biome.json
├── package.json
├── tsconfig.json                  (single root config; no per-folder tsconfigs)
├── vite.config.ts                 (root; build output goes to ./dist)
├── kysely.config.ts
├── CLAUDE.md
├── PLAN.md
│
├── shared/
│   ├── models/
│   │   ├── Scrap.ts
│   │   ├── Person.ts
│   │   ├── IngestionSession.ts
│   │   └── ContactLog.ts
│   └── utils/
│       └── id.ts
│
├── server/
│   ├── index.ts
│   ├── env.ts
│   ├── db/
│   │   ├── connection.ts          (Kysely + bun:sqlite + CamelCasePlugin)
│   │   ├── schema.ts              (Database interface, table types — camelCase)
│   │   └── migrations/
│   │       └── 0001_initial.ts
│   ├── repositories/
│   │   ├── scraps.ts
│   │   ├── people.ts
│   │   └── ingestion-sessions.ts
│   ├── services/
│   │   ├── telegram.ts
│   │   ├── media-storage.ts
│   │   ├── thumbnails.ts
│   │   └── scheduler.ts            (phase 4)
│   ├── app/
│   │   ├── ingestion.ts
│   │   ├── graph-export.ts
│   │   ├── public-url.ts           (ngrok tunnel + PUBLIC_BASE_URL accessor)
│   │   └── reminders.ts            (phase 4)
│   ├── routes/
│   │   ├── scraps.ts
│   │   ├── people.ts
│   │   └── webhook-telegram.ts
│   └── utils/
│       ├── logger.ts                (shared pino instance)
│       └── pagination.ts
│
└── client/
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/
        │   └── services.ts
        ├── stores/
        │   ├── scraps.ts
        │   ├── people.ts
        │   └── graph.ts
        ├── app/
        │   ├── incremental-load.ts
        │   └── force-simulation.ts
        ├── components/
        │   ├── Canvas.tsx
        │   ├── ScrapNode.tsx
        │   ├── PersonNode.tsx
        │   └── Edge.tsx
        └── utils/
            ├── viewport.ts
            └── geometry.ts
```

## Data model

SQLite columns are snake_case; Kysely's `CamelCasePlugin` exposes camelCase property names that match the Zod models exactly.

- `scraps`: id (text PK, nanoid), kind (`quote` | `photo` | `meme` | `text_content` | `song`), body (nullable), mediaPath (nullable, relative to `STORAGE_ROOT`), thumbnailPath (nullable), source (`whatsapp` | `manual`), externalMessageId (nullable), createdAt (integer, ms).
- `people`: id, name, featuredScrapId (FK → scraps, nullable), lastContactedAt (nullable), createdAt.
- `scrapPeople`: scrapId, personId, PK (scrapId, personId).
- `ingestionSessions`: id, chatId (unique — Telegram chat id, stringified), state (JSON text), pendingScrapIds (JSON text), createdAt, updatedAt.
- `contactLog` (phase 4): id, personId, contactedAt, note.
- `remindersSent` (phase 4): id, personId, scrapId (nullable), sentAt.

Storage paths:
- Originals: `STORAGE_ROOT/scraps/<YYYY>/<MM>/<scrap_id>.<ext>`
- Thumbnails: `STORAGE_ROOT/thumbnails/<scrap_id>.webp` (sharp, 600px max edge)

## Telegram ingestion state machine (`server/app/ingestion.ts`)

States: `idle` → `awaitingImageKind` (only for image messages) → `awaitingFriends` → `awaitingFeaturedDecision` (only when single image + single tag + kind=photo) → cleared on completion.

Idle session timeout: 24h. Idempotency: dedupe on Telegram `update_id` (stored in `scraps.externalMessageId`).

## Backend API

All under `/api`, JSON, Zod-validated.

- `GET /api/scraps?cursor=&limit=200`
- `GET /api/scraps/:id`, `POST /api/scraps`, `PATCH /api/scraps/:id`, `DELETE /api/scraps/:id`
- `GET /api/people?cursor=&limit=200`, `POST /api/people`, `PATCH /api/people/:id`
- `POST /api/webhooks/telegram`
- `GET /media/*` (Hono static serve from `STORAGE_ROOT`)

## Frontend

- Solid stores: `scraps`, `people`, derived `graph` (nodes + edges via `createMemo`).
- `d3-force` standalone in `client/src/app/forceSimulation.ts`. Positions stored separately from data.
- SVG overlay for "red string" edges; absolute-positioned DOM nodes for scraps/people.
- `client/src/app/incrementalLoad.ts` paginates both scraps and people, calls `simulation.nodes(...).alpha(0.3).restart()` between pages.

## Phased delivery & progress

- [x] **Phase 0 — bootstrap (scaffolded, awaiting `bun install` + run-time verification)**: repo, single root `tsconfig.json` with `~/*` alias and combined Bun + DOM lib/types, Biome with `useImportType`, Vite + Solid, Hono on Bun, Kysely + `kysely-bun-sqlite` + `CamelCasePlugin` + custom `JSONPlugin` (auto-detects `json` columns), `kysely-ctl` for migrations, ngrok auto-tunnel in dev, pino logger, `.env.example`, dev scripts (`bun run dev` via `concurrently`).
- [x] **Phase 1 — minimum viable slice**: manual `POST /api/scraps` + `POST/PATCH /api/people`, paginated `GET /api/scraps` and `GET /api/people` (cursor-based), repositories for scraps / people / ingestion-sessions, ingestion state machine (text-only branches: idle → awaitingFriends → optional awaitingFeaturedDecision), Telegram bot send + webhook with secret-token verification and single-chat allow-list, frontend api wrapper + Solid stores + derived graph memo + idle-scheduled paginator + d3-force simulation + minimal SVG canvas with scrap/person nodes and red-string edges.
- [ ] **Phase 2 — images**: image messages, kind disambiguation, multi-image splitting, sharp thumbnails, `/media` serving.
- [ ] **Phase 3 — featured photos**: featured-photo prompt branch, person-node uses featured scrap.
- [ ] **Phase 4 — reminders**: contactLog, scheduler, selection algorithm, reminder messages.
- [ ] **Phase 5 — polish**: detective-board aesthetic, pan/zoom, edit affordances, person-merge UI.

### Current status

**Phase 1 complete.** Server end-to-end smoke-tested via `curl POST /api/scraps` → `GET /api/scraps`. Lint + typecheck (`bun run lint`) clean. Frontend not yet manually verified in the browser — open `http://localhost:5173` and confirm the test scrap appears as a yellow rect node. After that, start **Phase 2 — images**: image messages, kind disambiguation (photo / meme / text-content), multi-image splitting (one scrap per image with shared tags), `sharp` thumbnails, `/media` static serving, image rendering on scrap nodes.

## Verification (when phases land)

- `bun run dev` boots both servers; Vite HMR + `bun --watch` reload both work.
- `bun run lint` (`biome check --write . && tsc` — single command: applies Biome fixes and formatting, then typechecks the whole tree from the root `tsconfig.json`) leaves the tree clean. Intentionally write a non-type-only `import { Scrap }` for a type usage and confirm `style/useImportType` rewrites it to `import type`.
- `bun run db:migrate` (uses `kysely-ctl` via `kysely.config.ts`, which reuses the runtime `db` instance) creates the SQLite file with all tables. New migrations via `bun run db:migrate:make <name>`.
- Telegram end-to-end: send a message to the bot, see a scrap created and a reply prompting for friend tags.
- Image flow end-to-end including featured-photo branch.
- Multi-image: two images in one message → two scrap rows sharing tags.
- Idempotency: replaying a webhook with the same `update_id` does not duplicate.
- Pagination of >200 scraps streams via `requestIdleCallback`; simulation re-stabilises without full re-layout.
