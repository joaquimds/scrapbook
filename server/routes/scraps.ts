import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { type AuthEnv, getCurrentUserId } from "~/server/middleware/require-auth.ts";
import {
	createScrap,
	findScrapById,
	listScrapsPage,
	setScrapPeople,
	updateScrapBody,
	updateScrapKind,
	updateScrapMediaUrl,
	updateScrapPosition,
} from "~/server/repositories/scraps.ts";
import { saveOriginal } from "~/server/services/media-storage/index.ts";
import { decodeCursor, PageQuerySchema } from "~/server/utils/pagination.ts";
import { ScrapKindSchema } from "~/shared/models/Scrap.ts";

const CreateScrapSchema = z.object({
	kind: ScrapKindSchema.default("quote"),
	body: z.string().nullable(),
	peopleIds: z.array(z.string()).default([]),
});

const PatchScrapSchema = z.object({
	body: z.string().nullable().optional(),
	kind: ScrapKindSchema.optional(),
	peopleIds: z.array(z.string()).optional(),
});

const PositionSchema = z.object({
	x: z.number().finite(),
	y: z.number().finite(),
});

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/jpg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
};

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
	.patch("/:id", zValidator("json", PatchScrapSchema), async (c) => {
		const userId = getCurrentUserId(c);
		const id = c.req.param("id");
		const existing = await findScrapById(userId, id);
		if (!existing) return c.json({ error: "not_found" as const }, 404);
		const data = c.req.valid("json");
		if (data.body !== undefined) await updateScrapBody(userId, id, data.body);
		if (data.kind !== undefined) await updateScrapKind(userId, id, data.kind);
		if (data.peopleIds !== undefined) await setScrapPeople(id, data.peopleIds);
		const updated = await findScrapById(userId, id);
		if (!updated) return c.json({ error: "not_found" as const }, 404);
		return c.json(updated);
	})
	.patch("/:id/position", zValidator("json", PositionSchema), async (c) => {
		const userId = getCurrentUserId(c);
		const id = c.req.param("id");
		const { x, y } = c.req.valid("json");
		const existing = await findScrapById(userId, id);
		if (!existing) return c.json({ error: "not_found" as const }, 404);
		await updateScrapPosition(userId, id, x, y);
		return c.json({ ok: true as const });
	})
	.post("/:id/media", async (c) => {
		const userId = getCurrentUserId(c);
		const id = c.req.param("id");
		const existing = await findScrapById(userId, id);
		if (!existing) return c.json({ error: "not_found" as const }, 404);
		const body = await c.req.parseBody();
		const file = body.file;
		if (!(file instanceof File)) return c.json({ error: "invalid_file" as const }, 400);
		const ext = ALLOWED_MIME[file.type];
		if (!ext) return c.json({ error: "unsupported_media_type" as const }, 415);
		if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: "payload_too_large" as const }, 413);
		const buffer = Buffer.from(await file.arrayBuffer());
		const { mediaUrl } = await saveOriginal({ id, buffer, ext });
		await updateScrapMediaUrl(userId, id, mediaUrl);
		const updated = await findScrapById(userId, id);
		if (!updated) return c.json({ error: "not_found" as const }, 404);
		return c.json(updated);
	});
