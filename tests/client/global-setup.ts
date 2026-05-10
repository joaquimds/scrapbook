import { buildTemplateDb, dropAllWorkerDbs, dropTemplateDb } from "~/tests/harness/test-db.ts";

export async function setup(): Promise<void> {
	await dropAllWorkerDbs();
	await buildTemplateDb();
}

export async function teardown(): Promise<void> {
	await dropAllWorkerDbs();
	await dropTemplateDb();
}
