import { Hono } from "hono";
import { mediaRoute } from "~/server/routes/media.ts";
import { peopleRoute } from "~/server/routes/people.ts";
import { scrapsRoute } from "~/server/routes/scraps.ts";
import { telegramWebhookRoute } from "~/server/routes/webhook-telegram.ts";

export function createApp(): Hono {
	const app = new Hono();
	app.get("/api/health", (c) => c.json({ ok: true }));
	app.route("/api/scraps", scrapsRoute);
	app.route("/api/people", peopleRoute);
	app.route("/api/webhooks/telegram", telegramWebhookRoute);
	app.route("/media", mediaRoute);
	return app;
}
