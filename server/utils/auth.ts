import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { env } from "~/server/env.ts";

const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;
const TOKEN_PURPOSE = "scrapboard-session-v1";

export function hashPassword(plain: string): string {
	const salt = randomBytes(SCRYPT_SALT_BYTES);
	const hash = scryptSync(plain, salt, SCRYPT_KEYLEN);
	return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
	const [saltHex, hashHex] = stored.split(":");
	if (!saltHex || !hashHex) return false;
	const salt = Buffer.from(saltHex, "hex");
	const expected = Buffer.from(hashHex, "hex");
	if (expected.length !== SCRYPT_KEYLEN) return false;
	const candidate = scryptSync(plain, salt, SCRYPT_KEYLEN);
	return timingSafeEqual(candidate, expected);
}

function signUserId(userId: string): string {
	return createHmac("sha256", `${env.SESSION_SECRET}:${TOKEN_PURPOSE}`)
		.update(userId)
		.digest("hex");
}

export function signSessionToken(userId: string): string {
	return `${userId}.${signUserId(userId)}`;
}

export function verifySessionToken(token: string | undefined): string | null {
	if (!token) return null;
	const dot = token.indexOf(".");
	if (dot <= 0 || dot === token.length - 1) return null;
	const userId = token.slice(0, dot);
	const provided = token.slice(dot + 1);
	const expected = signUserId(userId);
	if (provided.length !== expected.length) return null;
	const a = Buffer.from(provided, "hex");
	const b = Buffer.from(expected, "hex");
	if (a.length !== b.length || a.length === 0) return null;
	return timingSafeEqual(a, b) ? userId : null;
}
