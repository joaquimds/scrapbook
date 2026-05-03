import { sql } from "kysely";
import { db } from "~/server/db/connection.ts";
import { toClientMediaUrl } from "~/server/utils/media-urls.ts";
import type { Person } from "~/shared/models/Person.ts";
import { newId } from "~/shared/utils/id.ts";

// Picks the person we've gone longest without touching, where "touch" =
// people.last_contacted_at (atomically updated alongside contactLog inserts)
// or a sent reminder. People who have never been touched sort first (treated
// as -infinity). Anyone touched inside the cooldown window is excluded so we
// don't pester the user about the same friend on consecutive days.
export async function pickPersonDueForReminder(
	userId: string,
	opts: {
		cooldownDays: number;
	},
): Promise<Person | undefined> {
	const cooldown = sql.lit(`${opts.cooldownDays} days`);
	const lastTouched = sql<Date>`coalesce(greatest(
		p.last_contacted_at,
		r.last_reminder
	), '-infinity'::timestamptz)`;

	const row = await db
		.selectFrom("people as p")
		.leftJoin(
			(eb) =>
				eb
					.selectFrom("remindersSent")
					.select((q) => ["personId", q.fn.max("sentAt").as("lastReminder")])
					.where("userId", "=", userId)
					.groupBy("personId")
					.as("r"),
			(join) => join.onRef("r.personId", "=", "p.id"),
		)
		.select([
			"p.id",
			"p.name",
			"p.featuredScrapId",
			"p.lastContactedAt",
			"p.createdAt",
			"p.x",
			"p.y",
		])
		.where("p.userId", "=", userId)
		.where(sql<boolean>`${lastTouched} < now() - ${cooldown}::interval`)
		.orderBy(lastTouched, "asc")
		.limit(1)
		.executeTakeFirst();

	return row;
}

// A random photo tagged with the person, scoped to the user; null if none exists.
export async function pickReminderScrap(
	userId: string,
	personId: string,
): Promise<{
	id: string;
	mediaUrl: string | null;
	body: string | null;
} | null> {
	const photo = await db
		.selectFrom("scraps as s")
		.innerJoin("scrapPeople as sp", "sp.scrapId", "s.id")
		.where("sp.personId", "=", personId)
		.where("s.userId", "=", userId)
		.where("s.kind", "=", "photo")
		.where("s.mediaUrl", "is not", null)
		.select(["s.id", "s.mediaUrl", "s.body"])
		.orderBy(sql`random()`)
		.limit(1)
		.executeTakeFirst();

	return photo ? shapeMedia(photo) : null;
}

function shapeMedia<T extends { mediaUrl: string | null }>(row: T): T {
	return { ...row, mediaUrl: row.mediaUrl ? toClientMediaUrl(row.mediaUrl) : null };
}

export async function recordReminderSent(
	userId: string,
	personId: string,
	scrapId: string | null,
): Promise<void> {
	await db.insertInto("remindersSent").values({ id: newId(), userId, personId, scrapId }).execute();
}

export async function recordContact(
	userId: string,
	personId: string,
	note: string | null = null,
): Promise<void> {
	await db.transaction().execute(async (trx) => {
		await trx.insertInto("contactLog").values({ id: newId(), userId, personId, note }).execute();
		await trx
			.updateTable("people")
			.set({ lastContactedAt: sql<Date>`now()` })
			.where("id", "=", personId)
			.where("userId", "=", userId)
			.execute();
	});
}

// Was a reminder sent in the last `withinHours` hours that hasn't been
// acknowledged via contactLog? Used to avoid re-sending in the same window.
export async function hasUnackedReminder(
	userId: string,
	personId: string,
	withinHours: number,
): Promise<boolean> {
	const row = await db
		.selectFrom("remindersSent as r")
		.leftJoin("contactLog as c", (join) =>
			join.onRef("c.personId", "=", "r.personId").on(sql<boolean>`c.contacted_at >= r.sent_at`),
		)
		.select(["r.id"])
		.where("r.personId", "=", personId)
		.where("r.userId", "=", userId)
		.where(sql<boolean>`r.sent_at >= now() - ${sql.lit(`${withinHours} hours`)}::interval`)
		.where("c.id", "is", null)
		.limit(1)
		.executeTakeFirst();
	return Boolean(row);
}
