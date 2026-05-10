import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { upsertSession } from "~/server/repositories/ingestion-sessions.ts";
import { createPerson } from "~/server/repositories/people.ts";
import { createScrap } from "~/server/repositories/scraps.ts";
import { webhook } from "~/tests/client/harness/app.ts";
import { TEST_TELEGRAM_CHAT_ID, TEST_USER_ID } from "~/tests/client/harness/db.ts";
import { textUpdate } from "~/tests/client/harness/fixtures.ts";
import { lastSentMessage } from "~/tests/client/harness/telegram.ts";

const CHAT_ID = TEST_TELEGRAM_CHAT_ID;

async function makeSessionWithScrap(): Promise<string> {
	const scrap = await createScrap(TEST_USER_ID, { body: "test", source: "manual" });
	await upsertSession({
		userId: TEST_USER_ID,
		chatId: CHAT_ID,
		state: "awaitingFriends",
		pendingScrapIds: [scrap.id],
	});
	return scrap.id;
}

describe("Friend tagging (awaitingFriends state)", () => {
	it('skips tagging on "skip" reply', async () => {
		await makeSessionWithScrap();
		await webhook(textUpdate("skip"));

		const sessions = await db.selectFrom("ingestionSessions").selectAll().execute();
		expect(sessions).toHaveLength(0);

		const msg = lastSentMessage();
		expect(msg?.text).toMatch(/skip/i);
	});

	it("skips tagging on empty reply", async () => {
		await makeSessionWithScrap();
		await webhook(textUpdate(""));

		const sessions = await db.selectFrom("ingestionSessions").selectAll().execute();
		expect(sessions).toHaveLength(0);
	});

	it("creates new people who don't exist", async () => {
		await makeSessionWithScrap();
		await webhook(textUpdate("Zara"));

		const people = await db.selectFrom("people").selectAll().execute();
		expect(people.some((p) => p.name === "Zara")).toBe(true);
	});

	it("matches existing people case-insensitively", async () => {
		const existing = await createPerson(TEST_USER_ID, { name: "Alice" });
		await makeSessionWithScrap();
		await webhook(textUpdate("alice"));

		const people = await db.selectFrom("people").selectAll().execute();
		expect(people).toHaveLength(1);
		expect(people[0]?.id).toBe(existing.id);
	});

	it("parses comma-separated names", async () => {
		const scrapId = await makeSessionWithScrap();
		await webhook(textUpdate("Alice, Bob, Charlie"));

		const people = await db.selectFrom("people").selectAll().execute();
		expect(people).toHaveLength(3);

		const links = await db
			.selectFrom("scrapPeople")
			.where("scrapId", "=", scrapId)
			.selectAll()
			.execute();
		expect(links).toHaveLength(3);
	});

	it('parses names separated by " and "', async () => {
		await makeSessionWithScrap();
		await webhook(textUpdate("Alice and Bob"));

		const people = await db.selectFrom("people").selectAll().execute();
		expect(people).toHaveLength(2);
	});

	it("deduplicates repeated names", async () => {
		await makeSessionWithScrap();
		await webhook(textUpdate("Alice, alice, ALICE"));

		const people = await db.selectFrom("people").selectAll().execute();
		expect(people).toHaveLength(1);
	});

	it("sends tagged confirmation and deletes session", async () => {
		await makeSessionWithScrap();
		await webhook(textUpdate("Dave"));

		const sessions = await db.selectFrom("ingestionSessions").selectAll().execute();
		expect(sessions).toHaveLength(0);

		const msg = lastSentMessage();
		expect(msg?.text).toMatch(/Dave/);
	});

	it("adds scrap_people rows for each pending scrap id", async () => {
		const scrap1 = await createScrap(TEST_USER_ID, { body: "a", source: "manual" });
		const scrap2 = await createScrap(TEST_USER_ID, { body: "b", source: "manual" });
		await upsertSession({
			userId: TEST_USER_ID,
			chatId: CHAT_ID,
			state: "awaitingFriends",
			pendingScrapIds: [scrap1.id, scrap2.id],
		});
		await webhook(textUpdate("Eve"));

		const links = await db.selectFrom("scrapPeople").selectAll().execute();
		expect(links).toHaveLength(2);
	});
});
