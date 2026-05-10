import { describe, expect, it } from "vitest";
import { createPerson } from "~/server/repositories/people.ts";
import { pickReminderScrap } from "~/server/repositories/reminders.ts";
import { addScrapPeople, createScrap } from "~/server/repositories/scraps.ts";
import { TEST_USER_ID } from "~/tests/client/harness/db.ts";

describe("pickReminderScrap", () => {
	it("returns null when person has no scraps", async () => {
		const person = await createPerson(TEST_USER_ID, { name: "Lonely" });
		const result = await pickReminderScrap(TEST_USER_ID, person.id);
		expect(result).toBeNull();
	});

	it("returns a tagged scrap with mediaUrl", async () => {
		const person = await createPerson(TEST_USER_ID, { name: "Photos" });
		const a = await createScrap(TEST_USER_ID, {
			body: null,
			mediaUrl: "file:///tmp/scraps/2024/01/a.jpg",
			source: "manual",
		});
		const b = await createScrap(TEST_USER_ID, {
			body: null,
			mediaUrl: "file:///tmp/scraps/2024/01/b.jpg",
			source: "manual",
		});
		await addScrapPeople(a.id, [person.id]);
		await addScrapPeople(b.id, [person.id]);

		const result = await pickReminderScrap(TEST_USER_ID, person.id);
		expect([a.id, b.id]).toContain(result?.id);
	});

	it("falls back to a non-media scrap when no media-bearing scraps are tagged", async () => {
		const person = await createPerson(TEST_USER_ID, { name: "Quotes" });
		const scrap = await createScrap(TEST_USER_ID, {
			body: "text only",
			source: "manual",
		});
		await addScrapPeople(scrap.id, [person.id]);

		const result = await pickReminderScrap(TEST_USER_ID, person.id);
		expect(result?.id).toBe(scrap.id);
		expect(result?.mediaUrl).toBeNull();
		expect(result?.body).toBe("text only");
	});

	it("prefers a media-bearing scrap when both kinds are tagged", async () => {
		const person = await createPerson(TEST_USER_ID, { name: "Mixed" });
		const text = await createScrap(TEST_USER_ID, {
			body: "no media",
			source: "manual",
		});
		const media = await createScrap(TEST_USER_ID, {
			body: null,
			mediaUrl: "file:///tmp/scraps/2024/01/m.jpg",
			source: "manual",
		});
		await addScrapPeople(text.id, [person.id]);
		await addScrapPeople(media.id, [person.id]);

		const result = await pickReminderScrap(TEST_USER_ID, person.id);
		expect(result?.id).toBe(media.id);
	});
});
