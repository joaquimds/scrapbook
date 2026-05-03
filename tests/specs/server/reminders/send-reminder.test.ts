import { sql } from "kysely";
import { describe, expect, it, vi } from "vitest";
import { runDailyReminder } from "~/server/app/reminders.ts";
import { db } from "~/server/db/connection.ts";
import { createPerson } from "~/server/repositories/people.ts";
import { addScrapPeople, createScrap } from "~/server/repositories/scraps.ts";
import * as tg from "~/server/services/telegram.ts";
import { TEST_USER_ID } from "~/tests/harness/db.ts";
import { sentMessages, sentPhotos } from "~/tests/harness/telegram.ts";

async function createPersonDue(name: string): Promise<string> {
	const p = await createPerson(TEST_USER_ID, { name });
	await sql`update people set created_at = now() - interval '30 days' where id = ${p.id}`.execute(
		db,
	);
	return p.id;
}

describe("runDailyReminder", () => {
	it("is a no-op when no person is due", async () => {
		await runDailyReminder();
		expect(sentMessages()).toHaveLength(0);
		expect(sentPhotos()).toHaveLength(0);
	});

	it("sends a text message when person has no photo", async () => {
		await createPersonDue("TextPerson");
		await runDailyReminder();

		const messages = sentMessages();
		expect(messages.length).toBeGreaterThanOrEqual(1);
		expect(messages.some((m) => m.text.includes("TextPerson"))).toBe(true);
	});

	it("sends a photo when person has a mediaUrl scrap", async () => {
		const personId = await createPersonDue("PhotoPerson");
		const scrap = await createScrap(TEST_USER_ID, {
			kind: "photo",
			body: null,
			mediaUrl: "file:///tmp/scraps/2024/01/photo.jpg",
			source: "manual",
		});
		await addScrapPeople(scrap.id, [personId]);

		await runDailyReminder();

		const photos = sentPhotos();
		expect(photos.length).toBeGreaterThanOrEqual(1);
		expect(photos.some((p) => p.mediaUrl.endsWith("/scraps/2024/01/photo.jpg"))).toBe(true);
	});

	it("falls back to text when sendTelegramPhoto throws", async () => {
		const personId = await createPersonDue("FallbackPerson");
		const scrap = await createScrap(TEST_USER_ID, {
			kind: "photo",
			body: null,
			mediaUrl: "file:///tmp/scraps/2024/01/photo.jpg",
			source: "manual",
		});
		await addScrapPeople(scrap.id, [personId]);

		vi.mocked(tg.sendTelegramPhoto).mockRejectedValueOnce(new Error("upload failed"));

		await runDailyReminder();

		const messages = sentMessages();
		expect(messages.some((m) => m.text.includes("FallbackPerson"))).toBe(true);
	});

	it("records a remindersSent row", async () => {
		await createPersonDue("RecordedPerson");
		await runDailyReminder();

		const rows = await db.selectFrom("remindersSent").selectAll().execute();
		expect(rows).toHaveLength(1);
	});

	it("creates an awaitingContactReply session with pendingPersonIds", async () => {
		const personId = await createPersonDue("SessionPerson");
		await runDailyReminder();

		const sessions = await db.selectFrom("ingestionSessions").selectAll().execute();
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.state).toBe("awaitingContactReply");
		expect(sessions[0]?.pendingPersonIds).toContain(personId);
	});
});
