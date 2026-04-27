import { z } from "zod";

export const IngestionStateSchema = z.enum([
	"idle",
	"awaitingImageKind",
	"awaitingFriends",
	"awaitingFeaturedDecision",
]);
export type IngestionState = z.infer<typeof IngestionStateSchema>;

export const IngestionSessionSchema = z.object({
	id: z.string(),
	chatId: z.string(),
	state: IngestionStateSchema,
	pendingScrapIds: z.array(z.string()),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type IngestionSession = z.infer<typeof IngestionSessionSchema>;
