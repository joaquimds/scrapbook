import { db } from "~/server/db/connection.ts";

export type RegistrationStep = "awaiting_invite_code" | "awaiting_username";

export interface Registration {
	chatId: string;
	step: RegistrationStep;
	username: string | null;
	createdAt: string;
	updatedAt: string;
}

export async function findRegistration(chatId: string): Promise<Registration | undefined> {
	const row = await db
		.selectFrom("telegramRegistrations")
		.selectAll()
		.where("chatId", "=", chatId)
		.executeTakeFirst();
	return row ?? undefined;
}

export async function startRegistration(chatId: string): Promise<Registration> {
	return await db
		.insertInto("telegramRegistrations")
		.values({ chatId, step: "awaiting_invite_code", username: null })
		.onConflict((oc) =>
			oc.column("chatId").doUpdateSet({ step: "awaiting_invite_code", username: null }),
		)
		.returningAll()
		.executeTakeFirstOrThrow();
}

export async function advanceRegistration(
	chatId: string,
	patch: { step: RegistrationStep; username?: string | null },
): Promise<void> {
	await db
		.updateTable("telegramRegistrations")
		.set({
			step: patch.step,
			...(patch.username !== undefined ? { username: patch.username } : {}),
		})
		.where("chatId", "=", chatId)
		.execute();
}

export async function deleteRegistration(chatId: string): Promise<void> {
	await db.deleteFrom("telegramRegistrations").where("chatId", "=", chatId).execute();
}
