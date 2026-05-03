import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { findUserById } from "~/server/repositories/users.ts";
import { verifySessionToken } from "~/server/utils/auth.ts";
import type { User } from "~/shared/models/User.ts";

export const AUTH_COOKIE = "scrapbook_auth";

interface AuthVariables {
	userId: string;
	user: User;
}

export type AuthEnv = { Variables: AuthVariables };

export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
	const token = getCookie(c, AUTH_COOKIE);
	const userId = verifySessionToken(token);
	if (!userId) return c.json({ error: "unauthorized" }, 401);
	const user = await findUserById(userId);
	if (!user) return c.json({ error: "unauthorized" }, 401);
	c.set("userId", user.id);
	c.set("user", user);
	return next();
};

export function getCurrentUser(c: Context<AuthEnv>): User {
	return c.get("user");
}

export function getCurrentUserId(c: Context<AuthEnv>): string {
	return c.get("userId");
}
