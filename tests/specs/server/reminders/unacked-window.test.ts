import { sql } from "kysely";
import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { createPerson } from "~/server/repositories/people.ts";
import {
	hasUnackedReminder,
	recordContact,
	recordReminderSent,
} from "~/server/repositories/reminders.ts";

describe("hasUnackedReminder", () => {
	it("returns false when no reminders sent", async () => {
		const p = await createPerson({ name: "Fresh" });
		expect(await hasUnackedReminder(p.id, 24)).toBe(false);
	});

	it("returns true for a recent unacknowledged reminder", async () => {
		const p = await createPerson({ name: "Pending" });
		await recordReminderSent(p.id, null);

		expect(await hasUnackedReminder(p.id, 24)).toBe(true);
	});

	it("returns false after contact is recorded", async () => {
		const p = await createPerson({ name: "Acked" });
		await recordReminderSent(p.id, null);
		await recordContact(p.id);

		expect(await hasUnackedReminder(p.id, 24)).toBe(false);
	});

	it("returns false for a reminder older than the window", async () => {
		const p = await createPerson({ name: "Old" });
		await recordReminderSent(p.id, null);

		// Age the reminder beyond 24h
		await sql`update reminders_sent set sent_at = now() - interval '25 hours' where person_id = ${p.id}`.execute(
			db,
		);

		expect(await hasUnackedReminder(p.id, 24)).toBe(false);
	});
});
