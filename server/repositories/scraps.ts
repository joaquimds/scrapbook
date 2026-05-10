import { db } from "~/server/db/connection.ts";
import { toClientMediaUrl, toClientThumbnailUrl } from "~/server/utils/media-urls.ts";
import { type Cursor, encodeCursor } from "~/server/utils/pagination.ts";
import type { Scrap, ScrapSource } from "~/shared/models/Scrap.ts";
import { newId } from "~/shared/utils/id.ts";

export interface PageOfScraps {
	items: Scrap[];
	nextCursor: string | null;
}

interface CreateScrapInput {
	id?: string;
	body: string | null;
	mediaUrl?: string | null;
	source: ScrapSource;
	externalMessageId?: string | null;
	peopleIds?: string[];
}

interface ScrapRow {
	id: string;
	userId: string;
	body: string | null;
	mediaUrl: string | null;
	source: ScrapSource;
	externalMessageId: string | null;
	createdAt: string;
	x: number | null;
	y: number | null;
}

export async function createScrap(userId: string, input: CreateScrapInput): Promise<Scrap> {
	const id = input.id ?? newId();
	const peopleIds = input.peopleIds ?? [];

	const row = await db.transaction().execute(async (trx) => {
		const inserted = await trx
			.insertInto("scraps")
			.values({
				id,
				userId,
				body: input.body,
				mediaUrl: input.mediaUrl ?? null,
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

	return shape(row, peopleIds);
}

export async function updateScrapBody(
	userId: string,
	scrapId: string,
	body: string | null,
): Promise<void> {
	await db
		.updateTable("scraps")
		.set({ body })
		.where("id", "=", scrapId)
		.where("userId", "=", userId)
		.execute();
}

export async function updateScrapMediaUrl(
	userId: string,
	scrapId: string,
	mediaUrl: string | null,
): Promise<void> {
	await db
		.updateTable("scraps")
		.set({ mediaUrl })
		.where("id", "=", scrapId)
		.where("userId", "=", userId)
		.execute();
}

export async function updateScrapPosition(
	userId: string,
	scrapId: string,
	x: number,
	y: number,
): Promise<void> {
	await db
		.updateTable("scraps")
		.set({ x, y })
		.where("id", "=", scrapId)
		.where("userId", "=", userId)
		.execute();
}

export async function deleteScraps(userId: string, ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	await db.deleteFrom("scraps").where("id", "in", ids).where("userId", "=", userId).execute();
}

// Returns raw stored mediaUrls (un-shaped — file:// or https:// as written by
// the driver) for the given scrap ids belonging to the user.
export async function getRawMediaUrls(userId: string, ids: string[]): Promise<string[]> {
	if (ids.length === 0) return [];
	const rows = await db
		.selectFrom("scraps")
		.select("mediaUrl")
		.where("id", "in", ids)
		.where("userId", "=", userId)
		.where("mediaUrl", "is not", null)
		.execute();
	return rows.map((r) => r.mediaUrl).filter((u): u is string => u !== null);
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

export async function findScrapByExternalMessageId(
	userId: string,
	messageId: string,
): Promise<Scrap | undefined> {
	const row = await db
		.selectFrom("scraps")
		.selectAll()
		.where("externalMessageId", "=", messageId)
		.where("userId", "=", userId)
		.executeTakeFirst();
	if (!row) return undefined;
	return await hydrate(row);
}

export async function findScrapById(userId: string, id: string): Promise<Scrap | undefined> {
	const row = await db
		.selectFrom("scraps")
		.selectAll()
		.where("id", "=", id)
		.where("userId", "=", userId)
		.executeTakeFirst();
	if (!row) return undefined;
	return await hydrate(row);
}

// Loads a scrap by id without a user filter. Use only for media access checks
// where you need to know the owning user; never returns the row to the client.
export async function findScrapOwner(id: string): Promise<{ userId: string } | undefined> {
	const row = await db
		.selectFrom("scraps")
		.select("userId")
		.where("id", "=", id)
		.executeTakeFirst();
	return row ?? undefined;
}

export async function listScrapsPage(
	userId: string,
	opts: {
		cursor?: Cursor;
		limit: number;
	},
): Promise<PageOfScraps> {
	let q = db
		.selectFrom("scraps")
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
	const items = await Promise.all(sliced.map(hydrate));
	const last = sliced[sliced.length - 1];
	const nextCursor =
		hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null;
	return { items, nextCursor };
}

async function hydrate(row: ScrapRow): Promise<Scrap> {
	const links = await db
		.selectFrom("scrapPeople")
		.select("personId")
		.where("scrapId", "=", row.id)
		.execute();
	return shape(
		row,
		links.map((l) => l.personId),
	);
}

function shape(row: ScrapRow, peopleIds: string[]): Scrap {
	return {
		id: row.id,
		body: row.body,
		mediaUrl: row.mediaUrl ? toClientMediaUrl(row.mediaUrl) : null,
		thumbnailUrl: row.mediaUrl ? toClientThumbnailUrl(row.mediaUrl) : null,
		source: row.source,
		externalMessageId: row.externalMessageId,
		createdAt: row.createdAt,
		x: row.x,
		y: row.y,
		peopleIds,
	};
}
