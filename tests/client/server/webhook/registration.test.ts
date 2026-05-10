import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { webhook } from "~/tests/client/harness/app.ts";
import { textUpdate } from "~/tests/client/harness/fixtures.ts";
import { sentMessages } from "~/tests/client/harness/telegram.ts";

const INVITE_CODE = "test-invite-code";
const NEW_CHAT_ID = 424242;

describe("Telegram registration flow", () => {
	it("walks invite code → username and DMs a setup link on completion", async () => {
		await webhook(textUpdate("hi", NEW_CHAT_ID));
		await webhook(textUpdate(INVITE_CODE, NEW_CHAT_ID));
		await webhook(textUpdate("alice", NEW_CHAT_ID));

		const users = await db
			.selectFrom("users")
			.selectAll()
			.where("username", "=", "alice")
			.execute();
		const user = users[0];
		expect(user).toBeDefined();
		if (!user) throw new Error("unreachable");
		expect(user.telegramChatId).toBe(String(NEW_CHAT_ID));
		expect(user.passwordHash).toBeNull();

		const tokens = await db
			.selectFrom("setupTokens")
			.selectAll()
			.where("userId", "=", user.id)
			.execute();
		expect(tokens).toHaveLength(1);

		const messages = sentMessages().filter((m) => m.chatId === String(NEW_CHAT_ID));
		const setupMessage = messages.find((m) => m.text.includes("/setup?token="));
		expect(setupMessage).toBeDefined();
		expect(setupMessage?.text).toMatch(/\/setup\?token=[0-9a-f]+/);

		const regs = await db.selectFrom("telegramRegistrations").selectAll().execute();
		expect(regs).toHaveLength(0);
	});
});
