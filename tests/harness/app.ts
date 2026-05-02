import type { Hono } from "hono";
import { createApp } from "~/server/create-app.ts";
import { AUTH_COOKIE } from "~/server/middleware/require-auth.ts";
import { expectedToken } from "~/server/utils/auth.ts";

let _app: Hono | undefined;

function getApp(): Hono {
	if (!_app) _app = createApp();
	return _app;
}

export function authCookieHeader(): string {
	return `${AUTH_COOKIE}=${expectedToken()}`;
}

export async function req(
	method: string,
	path: string,
	options?: {
		body?: unknown;
		headers?: Record<string, string>;
		authed?: boolean;
	},
): Promise<Response> {
	const url = `http://localhost${path}`;
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...(options?.authed === false ? {} : { Cookie: authCookieHeader() }),
		...options?.headers,
	};
	const init: RequestInit = { method, headers };
	if (options?.body !== undefined) {
		init.body = JSON.stringify(options.body);
	}
	return getApp().fetch(new Request(url, init));
}

export async function webhook(update: unknown, secret = "test-secret"): Promise<Response> {
	return req("POST", "/api/webhooks/telegram", {
		body: update,
		headers: { "x-telegram-bot-api-secret-token": secret },
	});
}
