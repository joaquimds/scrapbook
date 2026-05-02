import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { upsertSession } from "~/server/repositories/ingestion-sessions.ts";
import { createScrap } from "~/server/repositories/scraps.ts";
import { webhook } from "~/tests/harness/app.ts";
import { textUpdate } from "~/tests/harness/fixtures.ts";
import { lastSentMessage } from "~/tests/harness/telegram.ts";

const CHAT_ID = "12345";

describe('"cancel" command', () => {
	it.each([
		"cancel",
		"/cancel",
		"Cancel",
		"CANCEL",
	])("%s aborts the awaitingImageKind flow and deletes pending scraps", async (input) => {
		const scrap = await createScrap({ kind: "photo", body: null, source: "manual" });
		await upsertSession({
			chatId: CHAT_ID,
			state: "awaitingImageKind",
			pendingScrapIds: [scrap.id],
		});

		await webhook(textUpdate(input));

		const remaining = await db.selectFrom("scraps").selectAll().execute();
		expect(remaining).toHaveLength(0);
		const sessions = await db.selectFrom("ingestionSessions").selectAll().execute();
		expect(sessions).toHaveLength(0);
		expect(lastSentMessage()?.text).toMatch(/cancelled/i);
	});

	it("aborts the awaitingFriends flow", async () => {
		const scrap = await createScrap({ kind: "quote", body: "hi", source: "telegram" });
		await upsertSession({
			chatId: CHAT_ID,
			state: "awaitingFriends",
			pendingScrapIds: [scrap.id],
		});

		await webhook(textUpdate("cancel"));

		const remaining = await db.selectFrom("scraps").selectAll().execute();
		expect(remaining).toHaveLength(0);
	});

	it("does nothing harmful when there is no active session", async () => {
		await webhook(textUpdate("cancel"));

		const scraps = await db.selectFrom("scraps").selectAll().execute();
		expect(scraps).toHaveLength(0);
		expect(lastSentMessage()?.text).toMatch(/nothing to cancel/i);
	});
});
