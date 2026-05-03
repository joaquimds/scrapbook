import { describe, expect, it } from "vitest";
import { createPerson } from "~/server/repositories/people.ts";
import { pickReminderScrap } from "~/server/repositories/reminders.ts";
import { addScrapPeople, createScrap } from "~/server/repositories/scraps.ts";

describe("pickReminderScrap", () => {
	it("returns null when person has no scraps", async () => {
		const person = await createPerson({ name: "Lonely" });
		const result = await pickReminderScrap(person.id);
		expect(result).toBeNull();
	});

	it("returns a tagged photo with mediaUrl", async () => {
		const person = await createPerson({ name: "Photos" });
		const a = await createScrap({
			kind: "photo",
			body: null,
			mediaUrl: "file:///tmp/scraps/2024/01/a.jpg",
			source: "manual",
		});
		const b = await createScrap({
			kind: "photo",
			body: null,
			mediaUrl: "file:///tmp/scraps/2024/01/b.jpg",
			source: "manual",
		});
		await addScrapPeople(a.id, [person.id]);
		await addScrapPeople(b.id, [person.id]);

		const result = await pickReminderScrap(person.id);
		expect([a.id, b.id]).toContain(result?.id);
	});

	it("returns null when only non-photo scraps are tagged", async () => {
		const person = await createPerson({ name: "Quotes" });
		const scrap = await createScrap({ kind: "quote", body: "text only", source: "manual" });
		await addScrapPeople(scrap.id, [person.id]);

		const result = await pickReminderScrap(person.id);
		expect(result).toBeNull();
	});
});
