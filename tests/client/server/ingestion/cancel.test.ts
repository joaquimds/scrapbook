import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { upsertSession } from "~/server/repositories/ingestion-sessions.ts";
import { createScrap } from "~/server/repositories/scraps.ts";
import { saveOriginal } from "~/server/services/media-storage/index.ts";
import { webhook } from "~/tests/client/harness/app.ts";
import { TEST_TELEGRAM_CHAT_ID, TEST_USER_ID } from "~/tests/client/harness/db.ts";
import { textUpdate } from "~/tests/client/harness/fixtures.ts";
import { lastSentMessage } from "~/tests/client/harness/telegram.ts";

const CHAT_ID = TEST_TELEGRAM_CHAT_ID;

describe('"cancel" command', () => {
	it.each([
		"cancel",
		"/cancel",
		"Cancel",
		"CANCEL",
	])("%s aborts the awaitingImageCaption flow and deletes pending scraps", async (input) => {
		const scrap = await createScrap(TEST_USER_ID, { body: null, source: "manual" });
		await upsertSession({
			userId: TEST_USER_ID,
			chatId: CHAT_ID,
			state: "awaitingImageCaption",
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
		const scrap = await createScrap(TEST_USER_ID, {
			body: "hi",
			source: "telegram",
		});
		await upsertSession({
			userId: TEST_USER_ID,
			chatId: CHAT_ID,
			state: "awaitingFriends",
			pendingScrapIds: [scrap.id],
		});

		await webhook(textUpdate("cancel"));

		const remaining = await db.selectFrom("scraps").selectAll().execute();
		expect(remaining).toHaveLength(0);
	});

	it("deletes the underlying media asset (local driver)", async () => {
		const sharp = (await import("sharp")).default;
		const buffer = await sharp({
			create: { width: 16, height: 16, channels: 3, background: { r: 0, g: 0, b: 0 } },
		})
			.jpeg()
			.toBuffer();
		const id = "cancel-asset";
		const { mediaUrl } = await saveOriginal({ id, buffer, ext: "jpg" });
		const absolute = fileURLToPath(mediaUrl);
		expect(existsSync(absolute)).toBe(true);

		const scrap = await createScrap(TEST_USER_ID, {
			id,
			body: null,
			mediaUrl,
			source: "telegram",
		});
		await upsertSession({
			userId: TEST_USER_ID,
			chatId: CHAT_ID,
			state: "awaitingImageCaption",
			pendingScrapIds: [scrap.id],
		});

		await webhook(textUpdate("cancel"));

		expect(existsSync(absolute)).toBe(false);
	});

	it("does nothing harmful when there is no active session", async () => {
		await webhook(textUpdate("cancel"));

		const scraps = await db.selectFrom("scraps").selectAll().execute();
		expect(scraps).toHaveLength(0);
		expect(lastSentMessage()?.text).toMatch(/nothing to cancel/i);
	});
});
