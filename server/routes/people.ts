import { Hono } from "hono";
import { z } from "zod";
import {
	createPerson,
	findPersonById,
	listPeoplePage,
	setFeaturedScrap,
} from "~/server/repositories/people.ts";
import { decodeCursor, PageQuerySchema } from "~/server/utils/pagination.ts";

const CreatePersonSchema = z.object({ name: z.string().min(1) });
const PatchPersonSchema = z.object({
	featuredScrapId: z.string().nullable().optional(),
});

export const peopleRoute = new Hono();

peopleRoute.get("/", async (c) => {
	const parsed = PageQuerySchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
	const { cursor, limit } = parsed.data;
	const page = await listPeoplePage({ cursor: decodeCursor(cursor), limit });
	return c.json(page);
});

peopleRoute.get("/:id", async (c) => {
	const person = await findPersonById(c.req.param("id"));
	if (!person) return c.json({ error: "not_found" }, 404);
	return c.json(person);
});

peopleRoute.post("/", async (c) => {
	const parsed = CreatePersonSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
	const person = await createPerson(parsed.data);
	return c.json(person, 201);
});

peopleRoute.patch("/:id", async (c) => {
	const id = c.req.param("id");
	const parsed = PatchPersonSchema.safeParse(await c.req.json());
	if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
	if (parsed.data.featuredScrapId !== undefined) {
		await setFeaturedScrap(id, parsed.data.featuredScrapId);
	}
	const person = await findPersonById(id);
	if (!person) return c.json({ error: "not_found" }, 404);
	return c.json(person);
});
