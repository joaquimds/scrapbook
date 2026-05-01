import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { webhook } from "~/tests/harness/app.ts";
import { textUpdate } from "~/tests/harness/fixtures.ts";

describe("Telegram chat gating", () => {
	it("ignores messages from non-allowed chat IDs", async () => {
		const update = textUpdate("hello", 99999);
		const res = await webhook(update);
		expect(res.status).toBe(200);

		const scraps = await db.selectFrom("scraps").selectAll().execute();
		expect(scraps).toHaveLength(0);
	});

	it("ingests messages from the allowed chat ID", async () => {
		const update = textUpdate("hello from correct chat", 12345);
		const res = await webhook(update);
		expect(res.status).toBe(200);

		const scraps = await db.selectFrom("scraps").selectAll().execute();
		expect(scraps).toHaveLength(1);
	});
});
