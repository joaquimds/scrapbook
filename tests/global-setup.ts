import { execSync } from "node:child_process";
import pg from "pg";

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/scrapboard_test";

function maintenanceUrl(): string {
	const u = new URL(TEST_DB_URL);
	u.pathname = "/postgres";
	return u.toString();
}

function baseDbName(): string {
	return new URL(TEST_DB_URL).pathname.slice(1);
}

function templateDbName(): string {
	return `${baseDbName()}_template`;
}

function templateDbUrl(): string {
	const u = new URL(TEST_DB_URL);
	u.pathname = `/${templateDbName()}`;
	return u.toString();
}

async function dropLeftoverWorkerDbs(client: pg.Client): Promise<void> {
	const leftovers = await client.query<{ datname: string }>(
		"SELECT datname FROM pg_database WHERE datname LIKE $1",
		[`${baseDbName()}_w%`],
	);
	for (const row of leftovers.rows) {
		await client.query(`DROP DATABASE IF EXISTS "${row.datname}" WITH (FORCE)`);
	}
}

export async function setup(): Promise<void> {
	const client = new pg.Client({ connectionString: maintenanceUrl() });
	await client.connect();
	await dropLeftoverWorkerDbs(client);
	const tmpl = templateDbName();
	await client.query(`DROP DATABASE IF EXISTS "${tmpl}" WITH (FORCE)`);
	await client.query(`CREATE DATABASE "${tmpl}"`);
	await client.end();

	execSync("npm run db:migrate", {
		env: { ...process.env, DATABASE_URL: templateDbUrl() },
		stdio: "inherit",
	});
}

export async function teardown(): Promise<void> {
	const client = new pg.Client({ connectionString: maintenanceUrl() });
	await client.connect();
	await dropLeftoverWorkerDbs(client);
	await client.query(`DROP DATABASE IF EXISTS "${templateDbName()}" WITH (FORCE)`);
	await client.end();
}
