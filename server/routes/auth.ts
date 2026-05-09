import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { sendSetupLink } from "~/server/app/setup-link.ts";
import { env } from "~/server/env.ts";
import { AUTH_COOKIE } from "~/server/middleware/require-auth.ts";
import { consumeSetupToken, findSetupToken } from "~/server/repositories/setup-tokens.ts";
import { findUserById, findUserByUsername, setUserPassword } from "~/server/repositories/users.ts";
import { signSessionToken, verifyPassword, verifySessionToken } from "~/server/utils/auth.ts";
import { logger } from "~/server/utils/logger.ts";

const ONE_YEAR_S = 60 * 60 * 24 * 365;
const MIN_PASSWORD_LEN = 8;

const UsernameSchema = z.object({ username: z.string().min(1) });
const LoginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });
const SetupSchema = z.object({
	token: z.string().min(1),
	password: z.string().min(MIN_PASSWORD_LEN),
});
const TokenParamSchema = z.object({ token: z.string().min(1) });

function setSessionCookie(c: Context, userId: string): void {
	setCookie(c, AUTH_COOKIE, signSessionToken(userId), {
		httpOnly: true,
		sameSite: "Lax",
		path: "/",
		maxAge: ONE_YEAR_S,
		secure: env.NODE_ENV === "production",
	});
}

export const authRoute = new Hono()
	.post("/login", zValidator("json", LoginSchema), async (c) => {
		const { username, password } = c.req.valid("json");
		const user = await findUserByUsername(username);
		if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
			return c.json({ error: "invalid_credentials" as const }, 401);
		}
		setSessionCookie(c, user.id);
		return c.json({ user: { id: user.id, username: user.username } });
	})
	// Issues a setup token and DMs a link via Telegram. Doesn't touch the
	// existing password; that only changes once /setup consumes the token.
	// Always 200 so callers can't enumerate usernames.
	.post("/forgot", zValidator("json", UsernameSchema), async (c) => {
		const { username } = c.req.valid("json");
		const user = await findUserByUsername(username);
		if (user) {
			await sendSetupLink(user.id, user.telegramChatId);
		} else {
			logger.info({ username }, "/forgot for unknown username — silent");
		}
		return c.json({ ok: true as const });
	})
	.get("/setup-token/:token", zValidator("param", TokenParamSchema), async (c) => {
		const { token } = c.req.valid("param");
		const found = await findSetupToken(token);
		if (!found) return c.json({ error: "invalid_token" as const }, 401);
		const user = await findUserById(found.userId);
		if (!user) return c.json({ error: "invalid_token" as const }, 401);
		return c.json({ ok: true as const, username: user.username });
	})
	.post("/setup", zValidator("json", SetupSchema), async (c) => {
		const { token, password } = c.req.valid("json");
		const found = await consumeSetupToken(token);
		if (!found) return c.json({ error: "invalid_token" as const }, 401);
		const user = await findUserById(found.userId);
		if (!user) return c.json({ error: "invalid_token" as const }, 401);
		await setUserPassword(user.id, password);
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
