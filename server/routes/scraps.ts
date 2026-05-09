import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { type AuthEnv, getCurrentUserId } from "~/server/middleware/require-auth.ts";
import {
	createScrap,
	findScrapById,
	listScrapsPage,
	updateScrapPosition,
} from "~/server/repositories/scraps.ts";
import { decodeCursor, PageQuerySchema } from "~/server/utils/pagination.ts";
import { ScrapKindSchema } from "~/shared/models/Scrap.ts";

const CreateScrapSchema = z.object({
	kind: ScrapKindSchema.default("quote"),
	body: z.string().nullable(),
	peopleIds: z.array(z.string()).default([]),
});

const PositionSchema = z.object({
	x: z.number().finite(),
	y: z.number().finite(),
});

export const scrapsRoute = new Hono<AuthEnv>()
	.get("/", zValidator("query", PageQuerySchema), async (c) => {
		const userId = getCurrentUserId(c);
		const { cursor, limit } = c.req.valid("query");
		const page = await listScrapsPage(userId, { cursor: decodeCursor(cursor), limit });
		return c.json(page);
	})
	.get("/:id", async (c) => {
		const userId = getCurrentUserId(c);
		const scrap = await findScrapById(userId, c.req.param("id"));
		if (!scrap) return c.json({ error: "not_found" as const }, 404);
		return c.json(scrap);
	})
	.post("/", zValidator("json", CreateScrapSchema), async (c) => {
		const userId = getCurrentUserId(c);
		const data = c.req.valid("json");
		const scrap = await createScrap(userId, {
			kind: data.kind,
			body: data.body,
			source: "manual",
			peopleIds: data.peopleIds,
		});
		return c.json(scrap, 201);
	})
	.patch("/:id/position", zValidator("json", PositionSchema), async (c) => {
		const userId = getCurrentUserId(c);
		const id = c.req.param("id");
		const { x, y } = c.req.valid("json");
		const existing = await findScrapById(userId, id);
		if (!existing) return c.json({ error: "not_found" as const }, 404);
		await updateScrapPosition(userId, id, x, y);
		return c.json({ ok: true as const });
	});
