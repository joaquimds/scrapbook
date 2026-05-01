import { z } from "zod";

export const RemindersSentSchema = z.object({
	id: z.string(),
	personId: z.string(),
	scrapId: z.string().nullable(),
	sentAt: z.date(),
});

export type RemindersSent = z.infer<typeof RemindersSentSchema>;
