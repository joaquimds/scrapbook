import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { requireAuth } from "~/server/middleware/require-auth.ts";
import { authRoute } from "~/server/routes/auth.ts";
import { mediaRoute } from "~/server/routes/media.ts";
import { peopleRoute } from "~/server/routes/people.ts";
import { scrapsRoute } from "~/server/routes/scraps.ts";
import { telegramWebhookRoute } from "~/server/routes/webhook-telegram.ts";

export function createApp(): Hono {
	const app = new Hono();
	app.get("/api/health", (c) => c.json({ ok: true }));
	app.route("/api/auth", authRoute);
	app.route("/api/webhooks/telegram", telegramWebhookRoute);
	app.use("/api/*", requireAuth);
	app.route("/api/scraps", scrapsRoute);
	app.route("/api/people", peopleRoute);
	app.route("/media", mediaRoute);
	app.use("/*", serveStatic({ root: "./dist" }));
	app.use("/*", async (c, next) => {
		if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/media/")) {
			return next();
		}
		return serveStatic({ root: "./dist", path: "index.html" })(c, next);
	});
	return app;
}
