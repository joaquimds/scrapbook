import "dotenv/config";
import { serve } from "@hono/node-server";
import { getPublicBaseUrl, startPublicTunnel } from "~/server/app/public-url.ts";
import { createApp } from "~/server/create-app.ts";
import { env } from "~/server/env.ts";
import { startScheduler } from "~/server/services/scheduler.ts";
import { setTelegramWebhook } from "~/server/services/telegram.ts";
import { logger } from "~/server/utils/logger.ts";

const app = createApp();
serve(
	{
		hostname: env.HOST,
		port: env.PORT,
		fetch: app.fetch,
	},
	async (info) => {
		logger.info({ host: env.HOST, port: info.port }, "scrapboard server listening");
		await startPublicTunnel(info.port);
		try {
			await setTelegramWebhook(`${getPublicBaseUrl()}/api/webhooks/telegram`);
		} catch (err) {
			logger.error({ err }, "failed to register Telegram webhook");
		}
		startScheduler();
	},
);
