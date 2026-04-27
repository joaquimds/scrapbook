import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { env } from "~/server/env.ts";

export const mediaRoute = new Hono();

mediaRoute.use(
	"/*",
	serveStatic({
		root: env.STORAGE_ROOT,
		rewriteRequestPath: (path) => path.replace(/^\/media/, ""),
	}),
);
