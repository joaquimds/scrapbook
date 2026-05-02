import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { env } from "~/server/env.ts";
import { AUTH_COOKIE } from "~/server/middleware/require-auth.ts";
import { expectedToken, verifyPassword, verifyToken } from "~/server/utils/auth.ts";

const ONE_YEAR_S = 60 * 60 * 24 * 365;

const LoginSchema = z.object({ password: z.string() });

export const authRoute = new Hono();

authRoute.post("/login", async (c) => {
	const parsed = LoginSchema.safeParse(await c.req.json().catch(() => ({})));
	if (!parsed.success) return c.json({ error: "bad_request" }, 400);
	if (!verifyPassword(parsed.data.password)) {
		return c.json({ error: "unauthorized" }, 401);
	}
	setCookie(c, AUTH_COOKIE, expectedToken(), {
		httpOnly: true,
		sameSite: "Lax",
		path: "/",
		maxAge: ONE_YEAR_S,
		secure: env.NODE_ENV === "production",
	});
	return c.json({ ok: true });
});

authRoute.post("/logout", (c) => {
	deleteCookie(c, AUTH_COOKIE, { path: "/" });
	return c.json({ ok: true });
});

authRoute.get("/check", (c) => {
	if (!verifyToken(getCookie(c, AUTH_COOKIE))) return c.json({ error: "unauthorized" }, 401);
	return c.json({ ok: true });
});
