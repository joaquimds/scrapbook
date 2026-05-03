import { z } from "zod";

export const UserSchema = z.object({
	id: z.string(),
	username: z.string(),
	telegramChatId: z.string(),
	createdAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;
