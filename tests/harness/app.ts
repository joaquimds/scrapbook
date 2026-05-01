import type { Hono } from "hono";
import { createApp } from "~/server/create-app.ts";

let _app: Hono | undefined;

function getApp(): Hono {
	if (!_app) _app = createApp();
	return _app;
}

export async function req(
	method: string,
	path: string,
	options?: {
		body?: unknown;
		headers?: Record<string, string>;
	},
): Promise<Response> {
	const url = `http://localhost${path}`;
	const init: RequestInit = {
		method,
		headers: { "Content-Type": "application/json", ...options?.headers },
	};
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
