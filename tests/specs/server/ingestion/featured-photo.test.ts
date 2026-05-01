import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { upsertSession } from "~/server/repositories/ingestion-sessions.ts";
import { createPerson } from "~/server/repositories/people.ts";
import { addScrapPeople, createScrap } from "~/server/repositories/scraps.ts";
import { webhook } from "~/tests/harness/app.ts";
import { textUpdate } from "~/tests/harness/fixtures.ts";

const CHAT_ID = "12345";

async function makeSinglePhotoWithOnePerson(): Promise<{ scrapId: string; personId: string }> {
	const person = await createPerson({ name: "Featured Person" });
	const scrap = await createScrap({ kind: "photo", body: null, source: "manual" });
	await addScrapPeople(scrap.id, [person.id]);
	await upsertSession({
		chatId: CHAT_ID,
		state: "awaitingFeaturedDecision",
		pendingScrapIds: [scrap.id],
	});
	return { scrapId: scrap.id, personId: person.id };
}

describe("Featured photo decision (awaitingFeaturedDecision state)", () => {
	it("sets featuredScrapId on yes reply", async () => {
		const { personId, scrapId } = await makeSinglePhotoWithOnePerson();
		await webhook(textUpdate("yes"));

		const person = await db
			.selectFrom("people")
			.where("id", "=", personId)
			.selectAll()
			.executeTakeFirstOrThrow();
		expect(person.featuredScrapId).toBe(scrapId);
	});

	it.each(["y", "yeah", "yep", "sure"])('sets featured on "%s" reply', async (reply) => {
		const { personId, scrapId } = await makeSinglePhotoWithOnePerson();
		await webhook(textUpdate(reply));

		const person = await db
			.selectFrom("people")
			.where("id", "=", personId)
			.selectAll()
			.executeTakeFirstOrThrow();
		expect(person.featuredScrapId).toBe(scrapId);
	});

	it("does not set featuredScrapId on no reply", async () => {
		const { personId } = await makeSinglePhotoWithOnePerson();
		await webhook(textUpdate("no"));

		const person = await db
			.selectFrom("people")
			.where("id", "=", personId)
			.selectAll()
			.executeTakeFirstOrThrow();
		expect(person.featuredScrapId).toBeNull();
	});

	it("deletes session after decision", async () => {
		await makeSinglePhotoWithOnePerson();
		await webhook(textUpdate("yes"));

		const sessions = await db.selectFrom("ingestionSessions").selectAll().execute();
		expect(sessions).toHaveLength(0);
	});

	it("triggers awaitingFeaturedDecision when tagging single photo with single person", async () => {
		const scrap = await createScrap({ kind: "photo", body: null, source: "manual" });
		await upsertSession({
			chatId: CHAT_ID,
			state: "awaitingFriends",
			pendingScrapIds: [scrap.id],
		});

		await webhook(textUpdate("OnlyFriend"));

		const sessions = await db.selectFrom("ingestionSessions").selectAll().execute();
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.state).toBe("awaitingFeaturedDecision");
	});

	it("does not trigger awaitingFeaturedDecision for multiple people", async () => {
		const scrap = await createScrap({ kind: "photo", body: null, source: "manual" });
		await upsertSession({
			chatId: CHAT_ID,
			state: "awaitingFriends",
			pendingScrapIds: [scrap.id],
		});

		await webhook(textUpdate("Alice, Bob"));

		const sessions = await db.selectFrom("ingestionSessions").selectAll().execute();
		// Session is deleted (not awaitingFeaturedDecision)
		expect(sessions).toHaveLength(0);
	});
});
