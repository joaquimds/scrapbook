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

export const scrapsRoute = new Hono<AuthEnv>();

scrapsRoute.get("/", async (c) => {
	const userId = getCurrentUserId(c);
	const parsed = PageQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
	const { cursor, limit } = parsed.data;
	const page = await listScrapsPage(userId, { cursor: decodeCursor(cursor), limit });
	return c.json(page);
});

scrapsRoute.get("/:id", async (c) => {
	const userId = getCurrentUserId(c);
	const scrap = await findScrapById(userId, c.req.param("id"));
	if (!scrap) return c.json({ error: "not_found" }, 404);
	return c.json(scrap);
});

scrapsRoute.post("/", async (c) => {
	const userId = getCurrentUserId(c);
	const body = await c.req.json();
	const parsed = CreateScrapSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
	const scrap = await createScrap(userId, {
		kind: parsed.data.kind,
		body: parsed.data.body,
		source: "manual",
		peopleIds: parsed.data.peopleIds,
	});
	return c.json(scrap, 201);
});

scrapsRoute.patch("/:id/position", async (c) => {
	const userId = getCurrentUserId(c);
	const id = c.req.param("id");
	const parsed = PositionSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
	const existing = await findScrapById(userId, id);
	if (!existing) return c.json({ error: "not_found" }, 404);
	await updateScrapPosition(userId, id, parsed.data.x, parsed.data.y);
	return c.json({ ok: true });
});
