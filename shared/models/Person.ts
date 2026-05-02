import { z } from "zod";

export const PersonSchema = z.object({
	id: z.string(),
	name: z.string(),
	featuredScrapId: z.string().nullable(),
	lastContactedAt: z.date().nullable(),
	createdAt: z.date(),
	x: z.number().nullable(),
	y: z.number().nullable(),
});

export type Person = z.infer<typeof PersonSchema>;
