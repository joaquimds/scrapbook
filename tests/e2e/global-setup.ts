import { mkdirSync, rmSync } from "node:fs";
import { seedE2eFixtures } from "~/tests/e2e/harness/seed.ts";
import { buildTemplateDb, cloneFromTemplate, dropDb } from "~/tests/harness/test-db.ts";

const E2E_DB_NAME = "scrapboard_test_e2e";
const E2E_STORAGE_ROOT = "./tests/.tmp-e2e-storage";

export default async function globalSetup(): Promise<void> {
	rmSync(E2E_STORAGE_ROOT, { recursive: true, force: true });
	mkdirSync(E2E_STORAGE_ROOT, { recursive: true });
	await dropDb(E2E_DB_NAME);
	await buildTemplateDb();
	const dbUrl = await cloneFromTemplate(E2E_DB_NAME);
	await seedE2eFixtures(dbUrl);
}
