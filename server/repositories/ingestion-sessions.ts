import { db } from "~/server/db/connection.ts";
import type { IngestionSession, IngestionState } from "~/shared/models/IngestionSession.ts";
import { newId } from "~/shared/utils/id.ts";

const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export async function findActiveSession(chatId: string): Promise<IngestionSession | undefined> {
	const row = await db
		.selectFrom("ingestionSessions")
		.selectAll()
		.where("chatId", "=", chatId)
		.executeTakeFirst();
	if (!row) return undefined;
	if (Date.now() - row.updatedAt.getTime() > SESSION_TIMEOUT_MS) {
		await deleteSession(row.id);
		return undefined;
	}
	return row;
}

export async function upsertSession(input: {
	chatId: string;
	state: IngestionState;
	pendingScrapIds: string[];
	pendingPersonIds?: string[];
}): Promise<IngestionSession> {
	const pendingPersonIds = input.pendingPersonIds ?? [];
	const existing = await db
		.selectFrom("ingestionSessions")
		.selectAll()
		.where("chatId", "=", input.chatId)
		.executeTakeFirst();
	if (existing) {
		return await db
			.updateTable("ingestionSessions")
			.set({
				state: input.state,
				pendingScrapIds: input.pendingScrapIds,
				pendingPersonIds,
			})
			.where("id", "=", existing.id)
			.returningAll()
			.executeTakeFirstOrThrow();
	}
	return await db
		.insertInto("ingestionSessions")
		.values({
			id: newId(),
			chatId: input.chatId,
			state: input.state,
			pendingScrapIds: input.pendingScrapIds,
			pendingPersonIds,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
}

export async function deleteSession(id: string): Promise<void> {
	await db.deleteFrom("ingestionSessions").where("id", "=", id).execute();
}
