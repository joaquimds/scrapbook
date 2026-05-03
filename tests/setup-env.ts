import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";

// Must run before any ~/server/* import. server/env.ts no longer loads
// dotenv, and tests deliberately bypass server/index.ts (the one entrypoint
// that does), so process.env here is the *only* source of test config — no
// .env leakage. The pg.Pool singleton in server/db/connection.ts binds at
// module-load time, which is why DATABASE_URL is set here.

process.env.NODE_ENV = "test";
process.env.ALBUM_DEBOUNCE_MS = "50";

const baseUrl = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/scrapbook_test";
const baseName = new URL(baseUrl).pathname.slice(1);
const templateName = `${baseName}_template`;
const workerId = process.env.VITEST_POOL_ID ?? "0";
const workerDbName = `${baseName}_w${workerId}`;

function urlWithDb(name: string): string {
	const u = new URL(baseUrl);
	u.pathname = `/${name}`;
	return u.toString();
}

const maintenanceUrl = urlWithDb("postgres");

// Clone the per-worker DB from the migrated template. With vitest's default
// isolate=true this re-runs for each test file in the worker, but
// VITEST_POOL_ID is stable for the worker's lifetime so the DB name is
// stable; DROP+CREATE TEMPLATE is fast (schema-only copy).
const client = new pg.Client({ connectionString: maintenanceUrl });
await client.connect();
await client.query(`DROP DATABASE IF EXISTS "${workerDbName}" WITH (FORCE)`);
await client.query(`CREATE DATABASE "${workerDbName}" TEMPLATE "${templateName}"`);
await client.end();

process.env.DATABASE_URL = urlWithDb(workerDbName);

// Fresh temp dir per worker process — each fork gets its own storage root.
const storageRoot = mkdtempSync(join(tmpdir(), "scrapbook-test-"));
process.env.STORAGE_ROOT = storageRoot;

process.env.TELEGRAM_BOT_TOKEN ??= "test-bot-token";
process.env.TELEGRAM_WEBHOOK_SECRET ??= "test-secret";
process.env.SESSION_SECRET ??= "test-session-secret-test-session-secret";
process.env.INVITE_CODE ??= "test-invite-code";
process.env.CLOUDINARY_URL ??= "cloudinary://stub:stub@stub";
