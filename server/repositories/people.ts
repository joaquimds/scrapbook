import { db } from "~/server/db/connection.ts";
import { type Cursor, encodeCursor } from "~/server/utils/pagination.ts";
import type { Person } from "~/shared/models/Person.ts";
import { newId } from "~/shared/utils/id.ts";

export interface PageOfPeople {
	items: Person[];
	nextCursor: string | null;
}

interface PersonRow {
	id: string;
	userId: string;
	name: string;
	featuredScrapId: string | null;
	lastContactedAt: Date | null;
	createdAt: Date;
	x: number | null;
	y: number | null;
}

function strip(row: PersonRow): Person {
	return {
		id: row.id,
		name: row.name,
		featuredScrapId: row.featuredScrapId,
		lastContactedAt: row.lastContactedAt,
		createdAt: row.createdAt,
		x: row.x,
		y: row.y,
	};
}

export async function listPeoplePage(
	userId: string,
	opts: {
		cursor?: Cursor;
		limit: number;
	},
): Promise<PageOfPeople> {
	let q = db
		.selectFrom("people")
		.selectAll()
		.where("userId", "=", userId)
		.orderBy("createdAt", "desc")
		.orderBy("id", "desc")
		.limit(opts.limit + 1);

	const { cursor } = opts;
	if (cursor) {
		q = q.where((eb) =>
			eb.or([
				eb("createdAt", "<", cursor.createdAt),
				eb.and([eb("createdAt", "=", cursor.createdAt), eb("id", "<", cursor.id)]),
			]),
		);
	}

	const rows = await q.execute();
	const hasMore = rows.length > opts.limit;
	const sliced = hasMore ? rows.slice(0, opts.limit) : rows;
	const items = sliced.map(strip);
	const last = sliced[sliced.length - 1];
	const nextCursor =
		hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null;
	return { items, nextCursor };
}

export async function findPersonById(userId: string, id: string): Promise<Person | undefined> {
	const row = await db
		.selectFrom("people")
		.selectAll()
		.where("id", "=", id)
		.where("userId", "=", userId)
		.executeTakeFirst();
	return row ? strip(row) : undefined;
}

export async function findPeopleByNames(userId: string, names: string[]): Promise<Person[]> {
	if (names.length === 0) return [];
	const lowered = names.map((n) => n.trim().toLowerCase());
	const rows = await db
		.selectFrom("people")
		.selectAll()
		.where("userId", "=", userId)
		.where((eb) => eb.or(lowered.map((n) => eb(eb.fn("lower", ["name"]), "=", n))))
		.execute();
	return rows.map(strip);
}

export async function createPerson(userId: string, input: { name: string }): Promise<Person> {
	const id = newId();
	const row = await db
		.insertInto("people")
		.values({
			id,
			userId,
			name: input.name,
			featuredScrapId: null,
			lastContactedAt: null,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
	return strip(row);
}

export async function setFeaturedScrap(
	userId: string,
	personId: string,
	scrapId: string | null,
): Promise<void> {
	await db
		.updateTable("people")
		.set({ featuredScrapId: scrapId })
		.where("id", "=", personId)
		.where("userId", "=", userId)
		.execute();
}

export async function updatePersonPosition(
	userId: string,
	personId: string,
	x: number,
	y: number,
): Promise<void> {
	await db
		.updateTable("people")
		.set({ x, y })
		.where("id", "=", personId)
		.where("userId", "=", userId)
		.execute();
}

/**
 * Resolves a list of free-text names into people for the given user, creating
 * any that don't exist (case-insensitive match on existing `name`). Returns one
 * person per requested name in input order, deduplicated.
 */
export async function resolveOrCreatePeople(userId: string, names: string[]): Promise<Person[]> {
	const trimmed = names.map((n) => n.trim()).filter((n) => n.length > 0);
	if (trimmed.length === 0) return [];

	const existing = await findPeopleByNames(userId, trimmed);
	const byLower = new Map(existing.map((p) => [p.name.toLowerCase(), p]));
	const out: Person[] = [];
	const seen = new Set<string>();

	for (const name of trimmed) {
		const key = name.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		const found = byLower.get(key);
		if (found) {
			out.push(found);
		} else {
			const created = await createPerson(userId, { name });
			out.push(created);
		}
	}
	return out;
}
