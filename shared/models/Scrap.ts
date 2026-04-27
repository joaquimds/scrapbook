import { z } from "zod";

export const ScrapKindSchema = z.enum(["quote", "photo", "meme", "text_content", "song"]);
export type ScrapKind = z.infer<typeof ScrapKindSchema>;

export const ScrapSourceSchema = z.enum(["telegram", "manual"]);
export type ScrapSource = z.infer<typeof ScrapSourceSchema>;

export const ScrapSchema = z.object({
	id: z.string(),
	kind: ScrapKindSchema,
	body: z.string().nullable(),
	mediaPath: z.string().nullable(),
	thumbnailPath: z.string().nullable(),
	source: ScrapSourceSchema,
	externalMessageId: z.string().nullable(),
	createdAt: z.date(),
	peopleIds: z.array(z.string()),
});

export type Scrap = z.infer<typeof ScrapSchema>;
