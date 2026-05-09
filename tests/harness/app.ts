import { createApp } from "~/server/create-app.ts";
import { AUTH_COOKIE } from "~/server/middleware/require-auth.ts";
import { signSessionToken } from "~/server/utils/auth.ts";
import { TEST_USER_ID } from "~/tests/harness/db.ts";

let _app: ReturnType<typeof createApp> | undefined;

function getApp(): ReturnType<typeof createApp> {
	if (!_app) _app = createApp();
	return _app;
}

export function authCookieHeader(userId: string = TEST_USER_ID): string {
	return `${AUTH_COOKIE}=${signSessionToken(userId)}`;
}

export async function req(
	method: string,
	path: string,
	options?: {
		body?: unknown;
		headers?: Record<string, string>;
		authed?: boolean;
		userId?: string;
	},
): Promise<Response> {
	const url = `http://localhost${path}`;
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...(options?.authed === false ? {} : { Cookie: authCookieHeader(options?.userId) }),
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
		authed: false,
	});
}
