import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { upsertSession } from "~/server/repositories/ingestion-sessions.ts";
import { createPerson } from "~/server/repositories/people.ts";
import { webhook } from "~/tests/client/harness/app.ts";
import { TEST_TELEGRAM_CHAT_ID, TEST_USER_ID } from "~/tests/client/harness/db.ts";
import { textUpdate } from "~/tests/client/harness/fixtures.ts";
import { lastSentMessage } from "~/tests/client/harness/telegram.ts";

const CHAT_ID = TEST_TELEGRAM_CHAT_ID;

async function makeContactReplySession(personName: string): Promise<string> {
	const person = await createPerson(TEST_USER_ID, { name: personName });
	await upsertSession({
		userId: TEST_USER_ID,
		chatId: CHAT_ID,
		state: "awaitingContactReply",
		pendingScrapIds: [],
		pendingPersonIds: [person.id],
	});
	return person.id;
}

describe("Contact reply handling (awaitingContactReply state)", () => {
	it.each([
		"yes",
		"y",
		"yeah",
		"yep",
		"done",
		"ok",
		"okay",
		"✓",
	])('"%s" records contact and deletes session', async (reply) => {
		const personId = await makeContactReplySession("Contactee");
		await webhook(textUpdate(reply));

		const logs = await db.selectFrom("contactLog").selectAll().execute();
		expect(logs).toHaveLength(1);
		expect(logs[0]?.personId).toBe(personId);

		const sessions = await db.selectFrom("ingestionSessions").selectAll().execute();
		expect(sessions).toHaveLength(0);

		const msg = lastSentMessage();
		expect(msg?.text).toMatch(/logged|✓/i);
	});

	it('updates last_contacted_at on "yes" reply', async () => {
		const personId = await makeContactReplySession("TimedPerson");
		await webhook(textUpdate("yes"));

		const person = await db
			.selectFrom("people")
			.where("id", "=", personId)
			.selectAll()
			.executeTakeFirstOrThrow();
		expect(person.lastContactedAt).not.toBeNull();
	});

	it.each([
		"no",
		"n",
		"skip",
		"later",
		"nope",
	])('"%s" skips without recording contact', async (reply) => {
		await makeContactReplySession("Skipped");
		await webhook(textUpdate(reply));

		const logs = await db.selectFrom("contactLog").selectAll().execute();
		expect(logs).toHaveLength(0);

		const sessions = await db.selectFrom("ingestionSessions").selectAll().execute();
		expect(sessions).toHaveLength(0);
	});

	it("clears session on unrecognised reply", async () => {
		await makeContactReplySession("Confused");
		await webhook(textUpdate("maybe tomorrow perhaps"));

		const sessions = await db.selectFrom("ingestionSessions").selectAll().execute();
		expect(sessions).toHaveLength(0);

		const msg = lastSentMessage();
		expect(msg?.text).toMatch(/yes|skip/i);
	});
});
