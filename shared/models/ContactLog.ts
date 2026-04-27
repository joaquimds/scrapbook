import { z } from "zod";

export const ContactLogSchema = z.object({
	id: z.string(),
	personId: z.string(),
	contactedAt: z.date(),
	note: z.string().nullable(),
});

export type ContactLog = z.infer<typeof ContactLogSchema>;
