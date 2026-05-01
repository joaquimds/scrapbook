import { sql } from "kysely";
import { db } from "~/server/db/connection.ts";
import type { Person } from "~/shared/models/Person.ts";
import { newId } from "~/shared/utils/id.ts";

// Picks the person we've gone longest without touching, where "touch" =
// contactLog entry, sent reminder, or the row's own createdAt. Anyone touched
// inside the cooldown window is excluded so we don't pester the user about
// the same friend on consecutive days.
export async function pickPersonDueForReminder(opts: {
	cooldownDays: number;
}): Promise<Person | undefined> {
	const cooldown = sql.lit(`${opts.cooldownDays} days`);
	const lastTouched = sql<Date>`greatest(
		coalesce(p.last_contacted_at, p.created_at),
		coalesce(c.last_contact,      p.created_at),
		coalesce(r.last_reminder,     p.created_at)
	)`;

	const row = await db
		.selectFrom("people as p")
		.leftJoin(
			(eb) =>
				eb
					.selectFrom("contactLog")
					.select((q) => ["personId", q.fn.max("contactedAt").as("lastContact")])
					.groupBy("personId")
					.as("c"),
			(join) => join.onRef("c.personId", "=", "p.id"),
		)
		.leftJoin(
			(eb) =>
				eb
					.selectFrom("remindersSent")
					.select((q) => ["personId", q.fn.max("sentAt").as("lastReminder")])
					.groupBy("personId")
					.as("r"),
			(join) => join.onRef("r.personId", "=", "p.id"),
		)
		.select(["p.id", "p.name", "p.featuredScrapId", "p.lastContactedAt", "p.createdAt"])
		.where(sql<boolean>`${lastTouched} < now() - ${cooldown}::interval`)
		.orderBy(lastTouched, "asc")
		.limit(1)
		.executeTakeFirst();

	return row;
}

// Featured first; otherwise the most recent photo tagged with the person; null if neither exists.
export async function pickReminderScrap(personId: string): Promise<{
	id: string;
	mediaPath: string | null;
	thumbnailPath: string | null;
	body: string | null;
} | null> {
	const person = await db
		.selectFrom("people")
		.select(["featuredScrapId"])
		.where("id", "=", personId)
		.executeTakeFirst();

	if (person?.featuredScrapId) {
		const scrap = await db
			.selectFrom("scraps")
			.select(["id", "mediaPath", "thumbnailPath", "body"])
			.where("id", "=", person.featuredScrapId)
			.executeTakeFirst();
		if (scrap) return scrap;
	}

	const photo = await db
		.selectFrom("scraps as s")
		.innerJoin("scrapPeople as sp", "sp.scrapId", "s.id")
		.where("sp.personId", "=", personId)
		.where("s.kind", "=", "photo")
		.where("s.mediaPath", "is not", null)
		.select(["s.id", "s.mediaPath", "s.thumbnailPath", "s.body"])
		.orderBy("s.createdAt", "desc")
		.limit(1)
		.executeTakeFirst();

	return photo ?? null;
}

export async function recordReminderSent(personId: string, scrapId: string | null): Promise<void> {
	await db.insertInto("remindersSent").values({ id: newId(), personId, scrapId }).execute();
}

export async function recordContact(personId: string, note: string | null = null): Promise<void> {
	await db.transaction().execute(async (trx) => {
		await trx.insertInto("contactLog").values({ id: newId(), personId, note }).execute();
		await trx
			.updateTable("people")
			.set({ lastContactedAt: sql<Date>`now()` })
			.where("id", "=", personId)
			.execute();
	});
}

// Was a reminder sent in the last `withinHours` hours that hasn't been
// acknowledged via contactLog? Used to avoid re-sending in the same window.
export async function hasUnackedReminder(personId: string, withinHours: number): Promise<boolean> {
	const row = await db
		.selectFrom("remindersSent as r")
		.leftJoin("contactLog as c", (join) =>
			join.onRef("c.personId", "=", "r.personId").on(sql<boolean>`c.contacted_at >= r.sent_at`),
		)
		.select(["r.id"])
		.where("r.personId", "=", personId)
		.where(sql<boolean>`r.sent_at >= now() - ${sql.lit(`${withinHours} hours`)}::interval`)
		.where("c.id", "is", null)
		.limit(1)
		.executeTakeFirst();
	return !!row;
}
