import { sql } from "kysely";
import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { createPerson } from "~/server/repositories/people.ts";
import { pickPersonDueForReminder } from "~/server/repositories/reminders.ts";

describe("pickPersonDueForReminder", () => {
	it("returns undefined when no people", async () => {
		const person = await pickPersonDueForReminder({ cooldownDays: 14 });
		expect(person).toBeUndefined();
	});

	it("returns a person whose created_at is beyond cooldown", async () => {
		const p = await createPerson({ name: "Alice" });
		// Age the person beyond cooldown
		await sql`update people set created_at = now() - interval '30 days' where id = ${p.id}`.execute(
			db,
		);

		const result = await pickPersonDueForReminder({ cooldownDays: 14 });
		expect(result?.id).toBe(p.id);
	});

	it("excludes people touched within the cooldown window", async () => {
		const p = await createPerson({ name: "Bob" });
		// Age person beyond cooldown but record recent contact
		await sql`update people set created_at = now() - interval '30 days' where id = ${p.id}`.execute(
			db,
		);
		await db.insertInto("contactLog").values({ id: "cl1", personId: p.id, note: null }).execute();

		const result = await pickPersonDueForReminder({ cooldownDays: 14 });
		expect(result).toBeUndefined();
	});

	it("picks the person with the oldest last-touch date", async () => {
		const older = await createPerson({ name: "Older" });
		const newer = await createPerson({ name: "Newer" });

		await sql`update people set created_at = now() - interval '60 days' where id = ${older.id}`.execute(
			db,
		);
		await sql`update people set created_at = now() - interval '30 days' where id = ${newer.id}`.execute(
			db,
		);

		const result = await pickPersonDueForReminder({ cooldownDays: 14 });
		expect(result?.id).toBe(older.id);
	});
});
