# Scrapbook — agent rules

## Import boundaries

There is a single root `tsconfig.json` covering `client/`, `server/`, and `shared/`. The compiler does not enforce a client/server split, so the boundary is enforced by convention:

- **`client/**` and `shared/**` MUST NOT import from `~/server/...`.** Server code uses Node-only APIs (`pg`, native modules, secrets) and must never end up in the browser bundle. The single exception is `shared/types.d.ts`, which re-exports server types (e.g. the Hono RPC `AppType`) for the client. Because it's a `.d.ts`, the compiler refuses any runtime import from it, so the type-only contract is enforced at the file-extension level. **This is the only sanctioned way to share types between server and client** — do not add `import type { ... } from "~/server/..."` anywhere else under `client/` or `shared/`; route the type through `shared/types.d.ts` instead.
- `server/**` MAY import from `~/shared/...` and `~/server/...`.
- `client/**` MAY import from `~/shared/...` and `~/client/...`.
- `shared/**` MAY only import from `~/shared/...` and third-party packages — nothing layer-specific.

## Filename style

- **TitleCamelCase** for models and components (one primary export per file): `shared/models/Scrap.ts`, `client/src/components/Canvas.tsx`.
- **kebab-case** for everything else: `server/db/json-plugin.ts`, `server/services/media-storage.ts`, `client/src/app/force-simulation.ts`.
- **snake_case** is allowed only for migration files (`0001_initial.ts`, `0002_add_contact_log.ts`) — matches `kysely-ctl`'s convention.
- No camelCase or other styles for filenames anywhere else.

## Module conventions

- Pure functions → `utils.ts` / `utils/<thing>.ts`.
- Service interactions (DB, external APIs) → `services.ts` / `services/<thing>.ts`.
- Reusable complex DB queries → `repositories/<thing>.ts`.
- Complex async/side-effecting business logic → `app/<thing>.ts` per layer.
- Shared Zod models → `shared/models/<PascalName>.ts`.
- **Never create `helpers.ts` / `helpers/`.**

## Logging

- Server: always import `logger` from `~/server/utils/logger.ts` (pino). **Never use `console.log` / `console.warn` / `console.info`** in server code.
- Client: `console.error` is permitted for ad-hoc debugging. `console.log` / `console.warn` / `console.info` are not.

## Database

- Kysely table types are derived from Zod models with `Omit<Model, divergent fields> & { ... }`. Override only fields whose storage shape differs (timestamps wrapped in `ColumnType`, denormalised joins).
- The `JSONPlugin` auto-serialises objects/arrays to JSON and casts them to `jsonb` on write. Declare JSON columns as `jsonb` in migrations. No manual JSON serialisation in repositories.
- Timestamp columns (`timestamp`, `timestamptz`) come back as **ISO 8601 strings**, not JS `Date` objects. `connection.ts` registers a pg type parser that round-trips them through `Date` to produce strict ISO (`2024-01-15T12:34:56.789Z`) — this matches the wire format so types are honest end-to-end. Shared models use `z.iso.datetime()` for these fields. If you need date arithmetic, do `Date.parse(s)` or `new Date(s)` at the point of use.
- Migrations run via `kysely-ctl` (`npm run db:migrate`). Never run migrations from application code.

## Imports

- Always use the `~/*` alias rooted at the project root. No `../../` cross-folder imports.
- Imports include the explicit `.ts` / `.tsx` extension (`allowImportingTsExtensions` is enabled).
- Type-only imports use `import type { ... }` — Biome's `style/useImportType` enforces this.
