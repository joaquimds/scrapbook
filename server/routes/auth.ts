import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { env } from "~/server/env.ts";
import { AUTH_COOKIE } from "~/server/middleware/require-auth.ts";
import { issueResetCode, verifyResetCode } from "~/server/repositories/password-reset-codes.ts";
import { findUserById, findUserByUsername, setUserPassword } from "~/server/repositories/users.ts";
import { sendTelegramMessage } from "~/server/services/telegram.ts";
import { signSessionToken, verifyPassword, verifySessionToken } from "~/server/utils/auth.ts";
import { logger } from "~/server/utils/logger.ts";

const ONE_YEAR_S = 60 * 60 * 24 * 365;
const MIN_PASSWORD_LEN = 8;

const UsernameSchema = z.object({ username: z.string().min(1) });
const LoginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });
const SetupSchema = z.object({
	username: z.string().min(1),
	code: z.string().min(1),
	newPassword: z.string().min(MIN_PASSWORD_LEN),
});

function setSessionCookie(c: Context, userId: string): void {
	setCookie(c, AUTH_COOKIE, signSessionToken(userId), {
		httpOnly: true,
		sameSite: "Lax",
		path: "/",
		maxAge: ONE_YEAR_S,
		secure: env.NODE_ENV === "production",
	});
}

async function issueAndSend(userId: string, chatId: string): Promise<void> {
	const code = await issueResetCode(userId);
	await sendTelegramMessage(chatId, `Your Scrapbook code is ${code}. It expires in 10 minutes.`);
}

export const authRoute = new Hono()
	// Step 1 of the two-step login form. Tells the client whether the user has a
	// password set yet; if not, kicks off the OTP flow by sending a code via the
	// bot. Always returns 200 and never reveals whether the username exists.
	.post("/lookup", zValidator("json", UsernameSchema), async (c) => {
		const { username } = c.req.valid("json");
		const user = await findUserByUsername(username);
		if (!user) {
			return c.json({ passwordSet: false });
		}
		if (user.passwordHash) {
			return c.json({ passwordSet: true });
		}
		await issueAndSend(user.id, user.telegramChatId);
		return c.json({ passwordSet: false });
	})
	.post("/login", zValidator("json", LoginSchema), async (c) => {
		const { username, password } = c.req.valid("json");
		const user = await findUserByUsername(username);
		if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
			return c.json({ error: "unauthorized" as const }, 401);
		}
		setSessionCookie(c, user.id);
		return c.json({ user: { id: user.id, username: user.username } });
	})
	// Issues a reset code but does NOT clear the existing password — that only
	// happens once /setup successfully consumes the code, otherwise anyone who
	// knows a username could lock that user out by spamming this endpoint. Always
	// returns 200 to avoid leaking whether the username exists.
	.post("/forgot", zValidator("json", UsernameSchema), async (c) => {
		const { username } = c.req.valid("json");
		const user = await findUserByUsername(username);
		if (user) {
			await issueAndSend(user.id, user.telegramChatId);
		} else {
			logger.info({ username }, "/forgot for unknown username — silent");
		}
		return c.json({ ok: true as const });
	})
	.post("/setup", zValidator("json", SetupSchema), async (c) => {
		const { username, code, newPassword } = c.req.valid("json");
		const user = await findUserByUsername(username);
		if (!user) return c.json({ error: "invalid_code" as const }, 401);
		const ok = await verifyResetCode(user.id, code);
		if (!ok) return c.json({ error: "invalid_code" as const }, 401);
		await setUserPassword(user.id, newPassword);
		setSessionCookie(c, user.id);
		return c.json({ user: { id: user.id, username: user.username } });
	})
	.post("/logout", (c) => {
		deleteCookie(c, AUTH_COOKIE, { path: "/" });
		return c.json({ ok: true as const });
	})
	.get("/check", async (c) => {
		const userId = verifySessionToken(getCookie(c, AUTH_COOKIE));
		if (!userId) return c.json({ error: "unauthorized" as const }, 401);
		const user = await findUserById(userId);
		if (!user) return c.json({ error: "unauthorized" as const }, 401);
		return c.json({ user: { id: user.id, username: user.username } });
	});
