import { createHash, randomBytes, scryptSync } from "node:crypto";
import pg from "pg";
import {
	SIGNIN_PASSWORD,
	SIGNIN_TELEGRAM_CHAT_ID,
	SIGNIN_USER_ID,
	SIGNIN_USERNAME,
	STUB_SETUP_TOKEN,
	STUB_TELEGRAM_CHAT_ID,
	STUB_USER_ID,
	STUB_USERNAME,
} from "~/tests/e2e/constants.ts";

// Mirrors server/repositories/setup-tokens.ts:7-9 — sha256 hex.
function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

// Mirrors server/utils/auth.ts:8-12 — scrypt with a random salt.
function hashPassword(plain: string): string {
	const salt = randomBytes(16);
	const hash = scryptSync(plain, salt, 64);
	return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

// Seeds two users:
//   1. The setup-token user (no password) for the registration spec.
//   2. A credentialed user that every other spec signs in with via the login
//      page, so they don't depend on a single-use token.
export async function seedE2eFixtures(databaseUrl: string): Promise<void> {
	const client = new pg.Client({ connectionString: databaseUrl });
	await client.connect();
	try {
		await client.query(
			`insert into users (id, username, password_hash, telegram_chat_id) values ($1, $2, null, $3)`,
			[STUB_USER_ID, STUB_USERNAME, STUB_TELEGRAM_CHAT_ID],
		);
		const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
		await client.query(
			`insert into setup_tokens (token_hash, user_id, expires_at) values ($1, $2, $3)`,
			[hashToken(STUB_SETUP_TOKEN), STUB_USER_ID, expiresAt],
		);

		await client.query(
			`insert into users (id, username, password_hash, telegram_chat_id) values ($1, $2, $3, $4)`,
			[SIGNIN_USER_ID, SIGNIN_USERNAME, hashPassword(SIGNIN_PASSWORD), SIGNIN_TELEGRAM_CHAT_ID],
		);
	} finally {
		await client.end();
	}
}
