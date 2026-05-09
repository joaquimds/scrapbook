import { db } from "~/server/db/connection.ts";
import { hashPassword } from "~/server/utils/auth.ts";
import type { User } from "~/shared/models/User.ts";
import { newId } from "~/shared/utils/id.ts";

interface UserRow {
	id: string;
	username: string;
	passwordHash: string | null;
	telegramChatId: string;
	createdAt: string;
}

export interface UserWithHash extends User {
	passwordHash: string | null;
}

function shape(row: UserRow): UserWithHash {
	return {
		id: row.id,
		username: row.username,
		telegramChatId: row.telegramChatId,
		createdAt: row.createdAt,
		passwordHash: row.passwordHash,
	};
}

function strip(user: UserWithHash): User {
	return {
		id: user.id,
		username: user.username,
		telegramChatId: user.telegramChatId,
		createdAt: user.createdAt,
	};
}

export async function findUserById(id: string): Promise<User | undefined> {
	const row = await db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst();
	return row ? strip(shape(row)) : undefined;
}

export async function findUserByUsername(username: string): Promise<UserWithHash | undefined> {
	const row = await db
		.selectFrom("users")
		.selectAll()
		.where("username", "=", username)
		.executeTakeFirst();
	return row ? shape(row) : undefined;
}

export async function findUserByTelegramChatId(chatId: string): Promise<User | undefined> {
	const row = await db
		.selectFrom("users")
		.selectAll()
		.where("telegramChatId", "=", chatId)
		.executeTakeFirst();
	return row ? strip(shape(row)) : undefined;
}

export async function isUsernameTaken(username: string): Promise<boolean> {
	const row = await db
		.selectFrom("users")
		.select("id")
		.where("username", "=", username)
		.executeTakeFirst();
	return Boolean(row);
}

export async function createUser(input: {
	username: string;
	telegramChatId: string;
}): Promise<User> {
	const id = newId();
	const row = await db
		.insertInto("users")
		.values({
			id,
			username: input.username,
			passwordHash: null,
			telegramChatId: input.telegramChatId,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
	return strip(shape(row));
}

export async function setUserPassword(userId: string, plain: string): Promise<void> {
	await db
		.updateTable("users")
		.set({ passwordHash: hashPassword(plain) })
		.where("id", "=", userId)
		.execute();
}
