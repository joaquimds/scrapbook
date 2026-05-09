import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { JSONPlugin } from "~/server/db/json-plugin.ts";
import type { Database } from "~/server/db/schema.ts";
import { env } from "~/server/env.ts";

// Coerce timestamp/timestamptz to strict ISO 8601 strings instead of JS Dates.
// Postgres's native text format (`2024-01-15 12:34:56+00`) isn't strict ISO,
// so we round-trip through Date to get `T` and `Z` separators. This makes the
// wire format and the in-memory format identical end-to-end.
pg.types.setTypeParser(1114, (v) => new Date(`${v}Z`).toISOString()); // timestamp (no tz, treat as UTC)
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString()); // timestamptz

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

// Plugin order: [JSONPlugin, CamelCasePlugin]. Kysely runs plugins in array
// order on transformQuery and reverse on transformResult — so on reads
// CamelCasePlugin renames first, and JSONPlugin sees camelCase keys.
export const db = new Kysely<Database>({
	dialect: new PostgresDialect({ pool }),
	plugins: [new JSONPlugin(), new CamelCasePlugin()],
});
