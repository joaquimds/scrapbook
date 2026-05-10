import pg from "pg";
import { db } from "~/server/db/connection.ts";
import { hashPassword } from "~/server/utils/auth.ts";

export const TEST_USER_ID = "test-user-1";
export const TEST_USERNAME = "testuser";
export const TEST_PASSWORD = "test-password";
export const TEST_TELEGRAM_CHAT_ID = "12345";

export async function truncateAll(): Promise<void> {
	const client = new pg.Client({
		connectionString: process.env.DATABASE_URL,
	});
	await client.connect();
	try {
		await client.query(`
			truncate users, telegram_registrations, scraps, people, ingestion_sessions, contact_log, reminders_sent
			restart identity cascade
		`);
	} finally {
		await client.end();
	}
}

// Seeds the canonical test user used by every spec. Tests reference
// TEST_USER_ID directly when calling repository functions.
export async function seedTestUser(): Promise<void> {
	await db
		.insertInto("users")
		.values({
			id: TEST_USER_ID,
			username: TEST_USERNAME,
			passwordHash: hashPassword(TEST_PASSWORD),
			telegramChatId: TEST_TELEGRAM_CHAT_ID,
		})
		.execute();
}
