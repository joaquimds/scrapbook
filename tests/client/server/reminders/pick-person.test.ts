import { sql } from "kysely";
import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { createPerson } from "~/server/repositories/people.ts";
import { pickPersonDueForReminder, recordContact } from "~/server/repositories/reminders.ts";
import { TEST_USER_ID } from "~/tests/client/harness/db.ts";

describe("pickPersonDueForReminder", () => {
	it("returns undefined when no people", async () => {
		const person = await pickPersonDueForReminder(TEST_USER_ID, { cooldownDays: 14 });
		expect(person).toBeUndefined();
	});

	it("returns an untouched person regardless of how recently they were created", async () => {
		const p = await createPerson(TEST_USER_ID, { name: "Alice" });

		const result = await pickPersonDueForReminder(TEST_USER_ID, { cooldownDays: 14 });
		expect(result?.id).toBe(p.id);
	});

	it("excludes people touched within the cooldown window", async () => {
		const p = await createPerson(TEST_USER_ID, { name: "Bob" });
		await recordContact(TEST_USER_ID, p.id);

		const result = await pickPersonDueForReminder(TEST_USER_ID, { cooldownDays: 14 });
		expect(result).toBeUndefined();
	});

	it("includes people touched outside the cooldown window", async () => {
		const p = await createPerson(TEST_USER_ID, { name: "Carol" });
		await recordContact(TEST_USER_ID, p.id);
		// Backdate the contact so it falls outside the cooldown.
		await sql`update people set last_contacted_at = now() - interval '30 days' where id = ${p.id}`.execute(
			db,
		);

		const result = await pickPersonDueForReminder(TEST_USER_ID, { cooldownDays: 14 });
		expect(result?.id).toBe(p.id);
	});

	it("picks the person with the oldest last-touch date", async () => {
		const older = await createPerson(TEST_USER_ID, { name: "Older" });
		const newer = await createPerson(TEST_USER_ID, { name: "Newer" });
		await recordContact(TEST_USER_ID, older.id);
		await recordContact(TEST_USER_ID, newer.id);

		await sql`update people set last_contacted_at = now() - interval '60 days' where id = ${older.id}`.execute(
			db,
		);
		await sql`update people set last_contacted_at = now() - interval '30 days' where id = ${newer.id}`.execute(
			db,
		);

		const result = await pickPersonDueForReminder(TEST_USER_ID, { cooldownDays: 14 });
		expect(result?.id).toBe(older.id);
	});
});
