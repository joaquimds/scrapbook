import { sql } from "kysely";
import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { createPerson } from "~/server/repositories/people.ts";
import { pickPersonDueForReminder, recordContact } from "~/server/repositories/reminders.ts";

describe("pickPersonDueForReminder", () => {
	it("returns undefined when no people", async () => {
		const person = await pickPersonDueForReminder({ cooldownDays: 14 });
		expect(person).toBeUndefined();
	});

	it("returns an untouched person regardless of how recently they were created", async () => {
		const p = await createPerson({ name: "Alice" });

		const result = await pickPersonDueForReminder({ cooldownDays: 14 });
		expect(result?.id).toBe(p.id);
	});

	it("excludes people touched within the cooldown window", async () => {
		const p = await createPerson({ name: "Bob" });
		await recordContact(p.id);

		const result = await pickPersonDueForReminder({ cooldownDays: 14 });
		expect(result).toBeUndefined();
	});

	it("includes people touched outside the cooldown window", async () => {
		const p = await createPerson({ name: "Carol" });
		await recordContact(p.id);
		// Backdate the contact so it falls outside the cooldown.
		await sql`update people set last_contacted_at = now() - interval '30 days' where id = ${p.id}`.execute(
			db,
		);

		const result = await pickPersonDueForReminder({ cooldownDays: 14 });
		expect(result?.id).toBe(p.id);
	});

	it("picks the person with the oldest last-touch date", async () => {
		const older = await createPerson({ name: "Older" });
		const newer = await createPerson({ name: "Newer" });
		await recordContact(older.id);
		await recordContact(newer.id);

		await sql`update people set last_contacted_at = now() - interval '60 days' where id = ${older.id}`.execute(
			db,
		);
		await sql`update people set last_contacted_at = now() - interval '30 days' where id = ${newer.id}`.execute(
			db,
		);

		const result = await pickPersonDueForReminder({ cooldownDays: 14 });
		expect(result?.id).toBe(older.id);
	});
});
