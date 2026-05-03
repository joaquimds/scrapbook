import { basename, extname } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { env } from "~/server/env.ts";
import { type AuthEnv, getCurrentUserId } from "~/server/middleware/require-auth.ts";
import { findScrapOwner } from "~/server/repositories/scraps.ts";

export const mediaRoute = new Hono<AuthEnv>();

// Local-driver media files are named <scrapId>.<ext> (originals) or
// <scrapId>.webp (thumbnails). Resolve the scrap id from the path and 404 if
// it doesn't belong to the requesting user, before delegating to serveStatic.
mediaRoute.use("/*", async (c, next) => {
	const userId = getCurrentUserId(c);
	const path = c.req.path.replace(/^\/media\//, "");
	const id = basename(path, extname(path));
	if (!id) return c.json({ error: "not_found" }, 404);
	const owner = await findScrapOwner(id);
	if (!owner || owner.userId !== userId) return c.json({ error: "not_found" }, 404);
	return next();
});

mediaRoute.use(
	"/*",
	serveStatic({
		root: env.STORAGE_ROOT,
		rewriteRequestPath: (path) => path.replace(/^\/media/, ""),
	}),
);
