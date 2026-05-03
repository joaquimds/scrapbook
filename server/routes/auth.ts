import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { env } from "~/server/env.ts";
import { AUTH_COOKIE } from "~/server/middleware/require-auth.ts";
import { findUserById, findUserByUsername } from "~/server/repositories/users.ts";
import { signSessionToken, verifyPassword, verifySessionToken } from "~/server/utils/auth.ts";

const ONE_YEAR_S = 60 * 60 * 24 * 365;

const LoginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

export const authRoute = new Hono();

authRoute.post("/login", async (c) => {
	const parsed = LoginSchema.safeParse(await c.req.json().catch(() => ({})));
	if (!parsed.success) return c.json({ error: "bad_request" }, 400);
	const user = await findUserByUsername(parsed.data.username);
	if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
		return c.json({ error: "unauthorized" }, 401);
	}
	setCookie(c, AUTH_COOKIE, signSessionToken(user.id), {
		httpOnly: true,
		sameSite: "Lax",
		path: "/",
		maxAge: ONE_YEAR_S,
		secure: env.NODE_ENV === "production",
	});
	return c.json({ user: { id: user.id, username: user.username } });
});

authRoute.post("/logout", (c) => {
	deleteCookie(c, AUTH_COOKIE, { path: "/" });
	return c.json({ ok: true });
});

authRoute.get("/check", async (c) => {
	const userId = verifySessionToken(getCookie(c, AUTH_COOKIE));
	if (!userId) return c.json({ error: "unauthorized" }, 401);
	const user = await findUserById(userId);
	if (!user) return c.json({ error: "unauthorized" }, 401);
	return c.json({ user: { id: user.id, username: user.username } });
});
