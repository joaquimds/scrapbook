import { db } from "~/server/db/connection.ts";
import { type Cursor, encodeCursor } from "~/server/utils/pagination.ts";
import type { Scrap, ScrapKind, ScrapSource } from "~/shared/models/Scrap.ts";
import { newId } from "~/shared/utils/id.ts";

export interface PageOfScraps {
	items: Scrap[];
	nextCursor: string | null;
}

interface CreateScrapInput {
	id?: string;
	kind: ScrapKind;
	body: string | null;
	mediaPath?: string | null;
	thumbnailPath?: string | null;
	source: ScrapSource;
	externalMessageId?: string | null;
	peopleIds?: string[];
}

export async function createScrap(input: CreateScrapInput): Promise<Scrap> {
	const id = input.id ?? newId();
	const peopleIds = input.peopleIds ?? [];

	const row = await db.transaction().execute(async (trx) => {
		const inserted = await trx
			.insertInto("scraps")
			.values({
				id,
				kind: input.kind,
				body: input.body,
				mediaPath: input.mediaPath ?? null,
				thumbnailPath: input.thumbnailPath ?? null,
				source: input.source,
				externalMessageId: input.externalMessageId ?? null,
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		if (peopleIds.length > 0) {
			await trx
				.insertInto("scrapPeople")
				.values(peopleIds.map((personId) => ({ scrapId: id, personId })))
				.execute();
		}
		return inserted;
	});

	return { ...row, peopleIds };
}

export async function updateScrapKind(scrapId: string, kind: ScrapKind): Promise<void> {
	await db.updateTable("scraps").set({ kind }).where("id", "=", scrapId).execute();
}

export async function setScrapPeople(scrapId: string, peopleIds: string[]): Promise<void> {
	await db.transaction().execute(async (trx) => {
		await trx.deleteFrom("scrapPeople").where("scrapId", "=", scrapId).execute();
		if (peopleIds.length > 0) {
			await trx
				.insertInto("scrapPeople")
				.values(peopleIds.map((personId) => ({ scrapId, personId })))
				.execute();
		}
	});
}

export async function addScrapPeople(scrapId: string, peopleIds: string[]): Promise<void> {
	if (peopleIds.length === 0) return;
	await db
		.insertInto("scrapPeople")
		.values(peopleIds.map((personId) => ({ scrapId, personId })))
		.onConflict((oc) => oc.doNothing())
		.execute();
}

export async function findScrapByExternalMessageId(messageId: string): Promise<Scrap | undefined> {
	const row = await db
		.selectFrom("scraps")
		.selectAll()
		.where("externalMessageId", "=", messageId)
		.executeTakeFirst();
	if (!row) return undefined;
	return await hydrate(row);
}

export async function findScrapById(id: string): Promise<Scrap | undefined> {
	const row = await db.selectFrom("scraps").selectAll().where("id", "=", id).executeTakeFirst();
	if (!row) return undefined;
	return await hydrate(row);
}

export async function listScrapsPage(opts: {
	cursor?: Cursor;
	limit: number;
}): Promise<PageOfScraps> {
	let q = db
		.selectFrom("scraps")
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
	const sliced = hasMore ? rows.slice(0, opts.limit) : rows;
	const items = await Promise.all(sliced.map(hydrate));
	const last = sliced[sliced.length - 1];
	const nextCursor =
		hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null;
	return { items, nextCursor };
}

async function hydrate(row: Omit<Scrap, "peopleIds">): Promise<Scrap> {
	const links = await db
		.selectFrom("scrapPeople")
		.select("personId")
		.where("scrapId", "=", row.id)
		.execute();
	return { ...row, peopleIds: links.map((l) => l.personId) };
}
