import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { type AuthEnv, getCurrentUserId } from "~/server/middleware/require-auth.ts";
import {
	createPerson,
	findPersonById,
	listPeoplePage,
	setFeaturedScrap,
	updatePersonPosition,
} from "~/server/repositories/people.ts";
import { decodeCursor, PageQuerySchema } from "~/server/utils/pagination.ts";

const CreatePersonSchema = z.object({ name: z.string().min(1) });
const PatchPersonSchema = z.object({
	featuredScrapId: z.string().nullable().optional(),
});
const PositionSchema = z.object({
	x: z.number().finite(),
	y: z.number().finite(),
});

export const peopleRoute = new Hono<AuthEnv>()
	.get("/", zValidator("query", PageQuerySchema), async (c) => {
		const userId = getCurrentUserId(c);
		const { cursor, limit } = c.req.valid("query");
		const page = await listPeoplePage(userId, { cursor: decodeCursor(cursor), limit });
		return c.json(page);
	})
	.get("/:id", async (c) => {
		const userId = getCurrentUserId(c);
		const person = await findPersonById(userId, c.req.param("id"));
		if (!person) return c.json({ error: "not_found" as const }, 404);
		return c.json(person);
	})
	.post("/", zValidator("json", CreatePersonSchema), async (c) => {
		const userId = getCurrentUserId(c);
		const person = await createPerson(userId, c.req.valid("json"));
		return c.json(person, 201);
	})
	.patch("/:id", zValidator("json", PatchPersonSchema), async (c) => {
		const userId = getCurrentUserId(c);
		const id = c.req.param("id");
		const data = c.req.valid("json");
		if (data.featuredScrapId !== undefined) {
			await setFeaturedScrap(userId, id, data.featuredScrapId);
		}
		const person = await findPersonById(userId, id);
		if (!person) return c.json({ error: "not_found" as const }, 404);
		return c.json(person);
	})
	.patch("/:id/position", zValidator("json", PositionSchema), async (c) => {
		const userId = getCurrentUserId(c);
		const id = c.req.param("id");
		const { x, y } = c.req.valid("json");
		const existing = await findPersonById(userId, id);
		if (!existing) return c.json({ error: "not_found" as const }, 404);
		await updatePersonPosition(userId, id, x, y);
		return c.json({ ok: true as const });
	});
