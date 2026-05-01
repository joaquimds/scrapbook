import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { webhook } from "~/tests/harness/app.ts";
import { textUpdate } from "~/tests/harness/fixtures.ts";

describe("Duplicate webhook replay (idempotency)", () => {
	it("ignores replayed text update_id", async () => {
		const update = textUpdate("original quote");
		await webhook(update);

		const before = await db.selectFrom("scraps").selectAll().execute();
		expect(before).toHaveLength(1);

		// Replay the exact same update
		await webhook(update);

		const after = await db.selectFrom("scraps").selectAll().execute();
		expect(after).toHaveLength(1);
	});
});
