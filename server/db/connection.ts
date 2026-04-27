import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { JSONPlugin } from "~/server/db/json-plugin.ts";
import type { Database } from "~/server/db/schema.ts";
import { env } from "~/server/env.ts";

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

// Plugin order: [JSONPlugin, CamelCasePlugin]. Kysely runs plugins in array
// order on transformQuery and reverse on transformResult — so on reads
// CamelCasePlugin renames first, and JSONPlugin sees camelCase keys.
export const db = new Kysely<Database>({
	dialect: new PostgresDialect({ pool }),
	plugins: [new JSONPlugin(), new CamelCasePlugin()],
});
