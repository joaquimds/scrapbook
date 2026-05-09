import { db } from "~/server/db/connection.ts";
import type { IngestionSession, IngestionState } from "~/shared/models/IngestionSession.ts";
import { newId } from "~/shared/utils/id.ts";

const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;

interface SessionRow {
	id: string;
	userId: string;
	chatId: string;
	state: IngestionState;
	pendingScrapIds: string[];
	pendingPersonIds: string[];
	createdAt: string;
	updatedAt: string;
}

function strip(row: SessionRow): IngestionSession {
	return {
		id: row.id,
		chatId: row.chatId,
		state: row.state,
		pendingScrapIds: row.pendingScrapIds,
		pendingPersonIds: row.pendingPersonIds,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export async function findActiveSession(
	userId: string,
	chatId: string,
): Promise<IngestionSession | undefined> {
	const row = await db
		.selectFrom("ingestionSessions")
		.selectAll()
		.where("userId", "=", userId)
		.where("chatId", "=", chatId)
		.executeTakeFirst();
	if (!row) return undefined;
	if (Date.now() - Date.parse(row.updatedAt) > SESSION_TIMEOUT_MS) {
		await deleteSession(row.id);
		return undefined;
	}
	return strip(row);
}

export async function upsertSession(input: {
	userId: string;
	chatId: string;
	state: IngestionState;
	pendingScrapIds: string[];
	pendingPersonIds?: string[];
}): Promise<IngestionSession> {
	const pendingPersonIds = input.pendingPersonIds ?? [];
	const existing = await db
		.selectFrom("ingestionSessions")
		.selectAll()
		.where("userId", "=", input.userId)
		.where("chatId", "=", input.chatId)
		.executeTakeFirst();
	if (existing) {
		const row = await db
			.updateTable("ingestionSessions")
			.set({
				state: input.state,
				pendingScrapIds: input.pendingScrapIds,
				pendingPersonIds,
			})
			.where("id", "=", existing.id)
			.returningAll()
			.executeTakeFirstOrThrow();
		return strip(row);
	}
	const row = await db
		.insertInto("ingestionSessions")
		.values({
			id: newId(),
			userId: input.userId,
			chatId: input.chatId,
			state: input.state,
			pendingScrapIds: input.pendingScrapIds,
			pendingPersonIds,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
	return strip(row);
}

export async function deleteSession(id: string): Promise<void> {
	await db.deleteFrom("ingestionSessions").where("id", "=", id).execute();
}
