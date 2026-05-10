import { rmSync } from "node:fs";

// Note: we deliberately do NOT drop the e2e DB here. Playwright tears down the
// webServer *after* globalTeardown, so a DROP DATABASE WITH (FORCE) at this
// point kills the dev server's still-open pg.Pool and surfaces a noisy
// "terminating connection due to administrator command" stack trace. The DB
// is dropped at the start of the next run by globalSetup, which is where it
// matters anyway (we want a fresh DB before the next suite, not after).

export default async function globalTeardown(): Promise<void> {
	rmSync("./tests/.tmp-e2e-storage", { recursive: true, force: true });
}
