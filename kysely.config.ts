import "dotenv/config";
import { Kysely, PostgresDialect } from "kysely";
import { defineConfig } from "kysely-ctl";
import pg from "pg";

// kysely-ctl loads this file via jiti, which doesn't read tsconfig path
// aliases — so this config is self-contained rather than reusing the runtime
// `db` instance from `~/server/db/connection.ts`. Migrations only run DDL,
// so the app's CamelCasePlugin and JSONPlugin are not needed here.

const connectionString = process.env.DATABASE_URL ?? "postgres://localhost:5432/scrapboard";

export default defineConfig({
	kysely: new Kysely({
		dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString }) }),
	}),
	migrations: {
		migrationFolder: "./server/db/migrations",
	},
});
