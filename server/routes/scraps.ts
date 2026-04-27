import { Hono } from "hono";
import { z } from "zod";
import { createScrap, findScrapById, listScrapsPage } from "~/server/repositories/scraps.ts";
import { decodeCursor, PageQuerySchema } from "~/server/utils/pagination.ts";
import { ScrapKindSchema } from "~/shared/models/Scrap.ts";

const CreateScrapSchema = z.object({
	kind: ScrapKindSchema.default("quote"),
	body: z.string().nullable(),
	peopleIds: z.array(z.string()).default([]),
});

export const scrapsRoute = new Hono();

scrapsRoute.get("/", async (c) => {
	const parsed = PageQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
	const { cursor, limit } = parsed.data;
	const page = await listScrapsPage({ cursor: decodeCursor(cursor), limit });
	return c.json(page);
});

scrapsRoute.get("/:id", async (c) => {
	const scrap = await findScrapById(c.req.param("id"));
	if (!scrap) return c.json({ error: "not_found" }, 404);
	return c.json(scrap);
});

scrapsRoute.post("/", async (c) => {
	const body = await c.req.json();
	const parsed = CreateScrapSchema.safeParse(body);
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
	const scrap = await createScrap({
		kind: parsed.data.kind,
		body: parsed.data.body,
		source: "manual",
		peopleIds: parsed.data.peopleIds,
	});
	return c.json(scrap, 201);
});
