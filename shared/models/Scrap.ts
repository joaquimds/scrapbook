import { z } from "zod";

export const ScrapSourceSchema = z.enum(["telegram", "manual"]);
export type ScrapSource = z.infer<typeof ScrapSourceSchema>;

export const ScrapSchema = z.object({
	id: z.string(),
	body: z.string().nullable(),
	mediaUrl: z.string().nullable(),
	thumbnailUrl: z.string().nullable(),
	source: ScrapSourceSchema,
	externalMessageId: z.string().nullable(),
	createdAt: z.iso.datetime(),
	x: z.number().nullable(),
	y: z.number().nullable(),
	peopleIds: z.array(z.string()),
});

export type Scrap = z.infer<typeof ScrapSchema>;
