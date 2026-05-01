import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { upsertSession } from "~/server/repositories/ingestion-sessions.ts";
import { createScrap } from "~/server/repositories/scraps.ts";
import { webhook } from "~/tests/harness/app.ts";
import { textUpdate } from "~/tests/harness/fixtures.ts";
import { lastSentMessage } from "~/tests/harness/telegram.ts";

const CHAT_ID = "12345";

async function makePhotoSession(): Promise<string> {
	const scrap = await createScrap({ kind: "photo", body: null, source: "manual" });
	await upsertSession({ chatId: CHAT_ID, state: "awaitingImageKind", pendingScrapIds: [scrap.id] });
	return scrap.id;
}

describe("Image kind parsing (awaitingImageKind state)", () => {
	it.each([
		["p", "photo"],
		["photo", "photo"],
		["m", "meme"],
		["meme", "meme"],
		["t", "text_content"],
		["text", "text_content"],
		["screenshot", "text_content"],
	])('parses "%s" as kind "%s"', async (input, expectedKind) => {
		const scrapId = await makePhotoSession();
		await webhook(textUpdate(input));

		const scrap = await db
			.selectFrom("scraps")
			.where("id", "=", scrapId)
			.selectAll()
			.executeTakeFirstOrThrow();
		expect(scrap.kind).toBe(expectedKind);
	});

	it("reprompts on unrecognised input", async () => {
		await makePhotoSession();
		await webhook(textUpdate("banana"));

		const sessions = await db.selectFrom("ingestionSessions").selectAll().execute();
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.state).toBe("awaitingImageKind");

		const msg = lastSentMessage();
		expect(msg?.text).toMatch(/photo|meme|text/i);
	});

	it("transitions to awaitingFriends after valid kind", async () => {
		await makePhotoSession();
		await webhook(textUpdate("photo"));

		const sessions = await db.selectFrom("ingestionSessions").selectAll().execute();
		expect(sessions[0]?.state).toBe("awaitingFriends");
	});

	it("updates kind for all pending scrap ids", async () => {
		const scrap1 = await createScrap({ kind: "photo", body: null, source: "manual" });
		const scrap2 = await createScrap({ kind: "photo", body: null, source: "manual" });
		await upsertSession({
			chatId: CHAT_ID,
			state: "awaitingImageKind",
			pendingScrapIds: [scrap1.id, scrap2.id],
		});

		await webhook(textUpdate("meme"));

		const scraps = await db
			.selectFrom("scraps")
			.where("id", "in", [scrap1.id, scrap2.id])
			.selectAll()
			.execute();
		expect(scraps.every((s) => s.kind === "meme")).toBe(true);
	});
});
