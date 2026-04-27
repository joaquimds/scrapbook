import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { startPublicTunnel } from "~/server/app/public-url.ts";
import { env } from "~/server/env.ts";
import { mediaRoute } from "~/server/routes/media.ts";
import { peopleRoute } from "~/server/routes/people.ts";
import { scrapsRoute } from "~/server/routes/scraps.ts";
import { telegramWebhookRoute } from "~/server/routes/webhook-telegram.ts";
import { logger } from "~/server/utils/logger.ts";

const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/api/scraps", scrapsRoute);
app.route("/api/people", peopleRoute);
app.route("/api/webhooks/telegram", telegramWebhookRoute);
app.route("/media", mediaRoute);

serve(
	{
		hostname: env.HOST,
		port: env.PORT,
		fetch: app.fetch,
	},
	async (info) => {
		logger.info({ host: env.HOST, port: info.port }, "scrapbook server listening");
		await startPublicTunnel(info.port);
	},
);
