import { z } from "zod";

export const PersonSchema = z.object({
	id: z.string(),
	name: z.string(),
	featuredScrapId: z.string().nullable(),
	lastContactedAt: z.iso.datetime().nullable(),
	createdAt: z.iso.datetime(),
	x: z.number().nullable(),
	y: z.number().nullable(),
});

export type Person = z.infer<typeof PersonSchema>;
