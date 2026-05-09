import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { sql } from "kysely";
import { db } from "~/server/db/connection.ts";

const CODE_DIGITS = 6;
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
	return createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
	return String(randomInt(0, 10 ** CODE_DIGITS)).padStart(CODE_DIGITS, "0");
}

// Issues a fresh reset code for the user, replacing any existing one. Returns
// the plain-text code so the caller can send it through whatever side channel
// (currently the Telegram bot).
export async function issueResetCode(userId: string): Promise<string> {
	const code = generateCode();
	await db
		.insertInto("passwordResetCodes")
		.values({
			userId,
			codeHash: hashCode(code),
			expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
			attempts: 0,
		})
		.onConflict((oc) =>
			oc.column("userId").doUpdateSet({
				codeHash: hashCode(code),
				expiresAt: new Date(Date.now() + CODE_TTL_MS).toISOString(),
				attempts: 0,
			}),
		)
		.execute();
	return code;
}

// Verifies (and consumes) a reset code. On success the row is deleted; on
// miss attempts is incremented and the row is deleted once it hits the cap so
// the user has to request a fresh code.
export async function verifyResetCode(userId: string, code: string): Promise<boolean> {
	const row = await db
		.selectFrom("passwordResetCodes")
		.selectAll()
		.where("userId", "=", userId)
		.executeTakeFirst();
	if (!row) return false;
	if (Date.parse(row.expiresAt) < Date.now()) {
		await deleteResetCode(userId);
		return false;
	}
	const provided = Buffer.from(hashCode(code), "hex");
	const expected = Buffer.from(row.codeHash, "hex");
	const match = provided.length === expected.length && timingSafeEqual(provided, expected);
	if (match) {
		await deleteResetCode(userId);
		return true;
	}
	const nextAttempts = row.attempts + 1;
	if (nextAttempts >= MAX_ATTEMPTS) {
		await deleteResetCode(userId);
	} else {
		await db
			.updateTable("passwordResetCodes")
			.set({ attempts: sql<number>`attempts + 1` })
			.where("userId", "=", userId)
			.execute();
	}
	return false;
}

export async function deleteResetCode(userId: string): Promise<void> {
	await db.deleteFrom("passwordResetCodes").where("userId", "=", userId).execute();
}
