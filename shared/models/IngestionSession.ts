import { z } from "zod";

export const IngestionStateSchema = z.enum([
	"idle",
	"awaitingImageCaption",
	"awaitingImageKind",
	"awaitingFriends",
	"awaitingFeaturedDecision",
	"awaitingContactReply",
]);
export type IngestionState = z.infer<typeof IngestionStateSchema>;

export const IngestionSessionSchema = z.object({
	id: z.string(),
	chatId: z.string(),
	state: IngestionStateSchema,
	pendingScrapIds: z.array(z.string()),
	pendingPersonIds: z.array(z.string()),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type IngestionSession = z.infer<typeof IngestionSessionSchema>;
