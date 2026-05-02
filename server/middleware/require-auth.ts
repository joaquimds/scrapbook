import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { verifyToken } from "~/server/utils/auth.ts";

export const AUTH_COOKIE = "scrapbook_auth";

export const requireAuth: MiddlewareHandler = async (c, next) => {
	const token = getCookie(c, AUTH_COOKIE);
	if (!verifyToken(token)) return c.json({ error: "unauthorized" }, 401);
	return next();
};
