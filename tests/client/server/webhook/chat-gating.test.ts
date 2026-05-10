import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { webhook } from "~/tests/client/harness/app.ts";
import { textUpdate } from "~/tests/client/harness/fixtures.ts";
import { lastSentMessage } from "~/tests/client/harness/telegram.ts";

describe("Telegram chat routing", () => {
	it("treats messages from unknown chat IDs as registration attempts (no scraps created)", async () => {
		const update = textUpdate("hello", 99999);
		const res = await webhook(update);
		expect(res.status).toBe(200);

		const scraps = await db.selectFrom("scraps").selectAll().execute();
		expect(scraps).toHaveLength(0);

		// Registration row should be created and the bot should have prompted
		// for the invite code.
		const regs = await db.selectFrom("telegramRegistrations").selectAll().execute();
		expect(regs).toHaveLength(1);
		expect(regs[0]?.step).toBe("awaiting_invite_code");
		expect(lastSentMessage()?.text.toLowerCase()).toMatch(/invite code/);
	});

	it("ingests messages from a known user's chat ID", async () => {
		const update = textUpdate("hello from correct chat", 12345);
		const res = await webhook(update);
		expect(res.status).toBe(200);

		const scraps = await db.selectFrom("scraps").selectAll().execute();
		expect(scraps).toHaveLength(1);
	});
});
