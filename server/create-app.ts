import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { requireAuth } from "~/server/middleware/require-auth.ts";
import { authRoute } from "~/server/routes/auth.ts";
import { mediaRoute } from "~/server/routes/media.ts";
import { peopleRoute } from "~/server/routes/people.ts";
import { scrapsRoute } from "~/server/routes/scraps.ts";
import { telegramWebhookRoute } from "~/server/routes/webhook-telegram.ts";

const app = new Hono()
	.get("/api/health", (c) => c.json({ ok: true as const }))
	.route("/api/auth", authRoute)
	.route("/api/webhooks/telegram", telegramWebhookRoute)
	.use("/api/*", requireAuth)
	.use("/media/*", requireAuth)
	.route("/api/scraps", scrapsRoute)
	.route("/api/people", peopleRoute)
	.route("/media", mediaRoute)
	.use("/*", serveStatic({ root: "./dist" }))
	.use("/*", async (c, next) => {
		if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/media/")) {
			return next();
		}
		return serveStatic({ root: "./dist", path: "index.html" })(c, next);
	});

export type AppType = typeof app;

export function createApp() {
	return app;
}
