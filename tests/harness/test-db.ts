import { execSync } from "node:child_process";
import pg from "pg";

// Shared test-DB lifecycle used by both the Vitest global-setup (multi-worker
// per-fork DBs) and the Playwright global-setup (a single e2e DB). The
// template DB is migrated once; each spec environment clones it.

const DEFAULT_TEST_DB_URL = "postgres://localhost:5432/scrapboard_test";

export function testDbBaseUrl(): string {
	return process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DB_URL;
}

export function urlWithDb(name: string): string {
	const u = new URL(testDbBaseUrl());
	u.pathname = `/${name}`;
	return u.toString();
}

export function maintenanceUrl(): string {
	return urlWithDb("postgres");
}

export function baseDbName(): string {
	return new URL(testDbBaseUrl()).pathname.slice(1);
}

export function templateDbName(): string {
	return `${baseDbName()}_template`;
}

export function templateDbUrl(): string {
	return urlWithDb(templateDbName());
}

async function withMaintenance<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
	const client = new pg.Client({ connectionString: maintenanceUrl() });
	await client.connect();
	try {
		return await fn(client);
	} finally {
		await client.end();
	}
}

// Drops any DBs left over from previous runs that match the test DB prefix
// (Vitest worker DBs `_w<n>` and the e2e DB).
export async function dropAllWorkerDbs(): Promise<void> {
	await withMaintenance(async (client) => {
		const rows = await client.query<{ datname: string }>(
			"SELECT datname FROM pg_database WHERE datname LIKE $1 OR datname LIKE $2",
			[`${baseDbName()}_w%`, `${baseDbName()}_e2e%`],
		);
		for (const row of rows.rows) {
			await client.query(`DROP DATABASE IF EXISTS "${row.datname}" WITH (FORCE)`);
		}
	});
}

// Builds (or rebuilds) the migrated template DB. Idempotent.
export async function buildTemplateDb(): Promise<void> {
	const tmpl = templateDbName();
	await withMaintenance(async (client) => {
		await client.query(`DROP DATABASE IF EXISTS "${tmpl}" WITH (FORCE)`);
		await client.query(`CREATE DATABASE "${tmpl}"`);
	});
	execSync("npm run db:migrate", {
		env: { ...process.env, DATABASE_URL: templateDbUrl() },
		stdio: "inherit",
	});
}

// Drops + recreates a worker DB from the template. Returns the connection URL.
export async function cloneFromTemplate(workerDbName: string): Promise<string> {
	await withMaintenance(async (client) => {
		await client.query(`DROP DATABASE IF EXISTS "${workerDbName}" WITH (FORCE)`);
		await client.query(`CREATE DATABASE "${workerDbName}" TEMPLATE "${templateDbName()}"`);
	});
	return urlWithDb(workerDbName);
}

export async function dropDb(name: string): Promise<void> {
	await withMaintenance(async (client) => {
		await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
	});
}

export async function dropTemplateDb(): Promise<void> {
	await dropDb(templateDbName());
}
