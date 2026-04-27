import { db } from "~/server/db/connection.ts";
import { type Cursor, encodeCursor } from "~/server/utils/pagination.ts";
import type { Person } from "~/shared/models/Person.ts";
import { newId } from "~/shared/utils/id.ts";

export interface PageOfPeople {
	items: Person[];
	nextCursor: string | null;
}

export async function listPeoplePage(opts: {
	cursor?: Cursor;
	limit: number;
}): Promise<PageOfPeople> {
	let q = db
		.selectFrom("people")
		.selectAll()
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
	const items = hasMore ? rows.slice(0, opts.limit) : rows;
	const last = items[items.length - 1];
	const nextCursor =
		hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null;
	return { items, nextCursor };
}

export async function findPersonById(id: string): Promise<Person | undefined> {
	return await db.selectFrom("people").selectAll().where("id", "=", id).executeTakeFirst();
}

export async function findPeopleByNames(names: string[]): Promise<Person[]> {
	if (names.length === 0) return [];
	const lowered = names.map((n) => n.trim().toLowerCase());
	return await db
		.selectFrom("people")
		.selectAll()
		.where((eb) => eb.or(lowered.map((n) => eb(eb.fn("lower", ["name"]), "=", n))))
		.execute();
}

export async function createPerson(input: { name: string }): Promise<Person> {
	const id = newId();
	return await db
		.insertInto("people")
		.values({
			id,
			name: input.name,
			featuredScrapId: null,
			lastContactedAt: null,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
}

export async function setFeaturedScrap(personId: string, scrapId: string | null): Promise<void> {
	await db
		.updateTable("people")
		.set({ featuredScrapId: scrapId })
		.where("id", "=", personId)
		.execute();
}

/**
 * Resolves a list of free-text names into people, creating any that don't exist
 * (case-insensitive match on existing `name`). Returns one person per requested
 * name in input order, deduplicated.
 */
export async function resolveOrCreatePeople(names: string[]): Promise<Person[]> {
	const trimmed = names.map((n) => n.trim()).filter((n) => n.length > 0);
	if (trimmed.length === 0) return [];

	const existing = await findPeopleByNames(trimmed);
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
			const created = await createPerson({ name });
			out.push(created);
		}
	}
	return out;
}
