import { createHash, randomBytes } from "node:crypto";
import { db } from "~/server/db/connection.ts";

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 30 * 60 * 1000;

function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

// Issues a fresh setup token for the user, replacing any prior tokens. Returns
// the plaintext token so the caller can embed it in a setup URL delivered via
// the bot.
export async function issueSetupToken(userId: string): Promise<string> {
	const token = randomBytes(TOKEN_BYTES).toString("hex");
	await db.deleteFrom("setupTokens").where("userId", "=", userId).execute();
	await db
		.insertInto("setupTokens")
		.values({
			tokenHash: hashToken(token),
			userId,
			expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
		})
		.execute();
	return token;
}

// Hashed lookup without consumption — used to render the setup page before the
// user submits a password. Returns null on miss/expiry (and cleans expired rows).
export async function findSetupToken(token: string): Promise<{ userId: string } | null> {
	const row = await db
		.selectFrom("setupTokens")
		.select(["userId", "expiresAt"])
		.where("tokenHash", "=", hashToken(token))
		.executeTakeFirst();
	if (!row) return null;
	if (Date.parse(row.expiresAt) < Date.now()) {
		await db.deleteFrom("setupTokens").where("tokenHash", "=", hashToken(token)).execute();
		return null;
	}
	return { userId: row.userId };
}

// Single-use: row is deleted on success.
export async function consumeSetupToken(token: string): Promise<{ userId: string } | null> {
	const found = await findSetupToken(token);
	if (!found) return null;
	const result = await db
		.deleteFrom("setupTokens")
		.where("tokenHash", "=", hashToken(token))
		.executeTakeFirst();
	if (result.numDeletedRows === 0n) return null;
	return found;
}
