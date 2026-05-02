import { describe, expect, it } from "vitest";
import { createPerson, setFeaturedScrap } from "~/server/repositories/people.ts";
import { pickReminderScrap } from "~/server/repositories/reminders.ts";
import { addScrapPeople, createScrap } from "~/server/repositories/scraps.ts";

describe("pickReminderScrap", () => {
	it("returns null when person has no scraps", async () => {
		const person = await createPerson({ name: "Lonely" });
		const result = await pickReminderScrap(person.id);
		expect(result).toBeNull();
	});

	it("returns the featured scrap first", async () => {
		const person = await createPerson({ name: "Featured" });
		const scrap1 = await createScrap({ kind: "quote", body: "older", source: "manual" });
		const scrap2 = await createScrap({
			kind: "photo",
			body: null,
			mediaUrl: "file:///tmp/scraps/2024/01/x.jpg",
			source: "manual",
		});
		await addScrapPeople(scrap1.id, [person.id]);
		await addScrapPeople(scrap2.id, [person.id]);
		await setFeaturedScrap(person.id, scrap1.id);

		const result = await pickReminderScrap(person.id);
		expect(result?.id).toBe(scrap1.id);
	});

	it("falls back to most recent photo with mediaUrl", async () => {
		const person = await createPerson({ name: "Photos" });
		const older = await createScrap({
			kind: "photo",
			body: null,
			mediaUrl: "file:///tmp/scraps/2024/01/old.jpg",
			source: "manual",
		});
		const newer = await createScrap({
			kind: "photo",
			body: null,
			mediaUrl: "file:///tmp/scraps/2024/01/new.jpg",
			source: "manual",
		});
		await addScrapPeople(older.id, [person.id]);
		await addScrapPeople(newer.id, [person.id]);

		const result = await pickReminderScrap(person.id);
		expect(result?.id).toBe(newer.id);
	});

	it("returns null when only non-photo scraps are tagged", async () => {
		const person = await createPerson({ name: "Quotes" });
		const scrap = await createScrap({ kind: "quote", body: "text only", source: "manual" });
		await addScrapPeople(scrap.id, [person.id]);

		const result = await pickReminderScrap(person.id);
		expect(result).toBeNull();
	});
});
