import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "~/server/env.ts";

const TOKEN_PURPOSE = "scrapbook-auth-v1";

export function expectedToken(): string {
	return createHmac("sha256", env.AUTH_PASSWORD).update(TOKEN_PURPOSE).digest("hex");
}

export function verifyToken(value: string | undefined): boolean {
	if (!value) return false;
	const expected = expectedToken();
	if (value.length !== expected.length) return false;
	return timingSafeEqual(Buffer.from(value, "hex"), Buffer.from(expected, "hex"));
}

export function verifyPassword(password: string | undefined): boolean {
	if (!password) return false;
	const expected = Buffer.from(env.AUTH_PASSWORD);
	const provided = Buffer.from(password);
	if (provided.length !== expected.length) return false;
	return timingSafeEqual(provided, expected);
}
