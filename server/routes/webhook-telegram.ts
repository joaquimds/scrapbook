import { Hono } from "hono";
import { handleIncoming } from "~/server/app/ingestion.ts";
import { env } from "~/server/env.ts";
import { logger } from "~/server/utils/logger.ts";

interface TelegramPhotoSize {
	file_id: string;
	file_unique_id: string;
	width: number;
	height: number;
	file_size?: number;
}

interface TelegramMessage {
	message_id: number;
	chat: { id: number };
	text?: string;
	caption?: string;
	photo?: TelegramPhotoSize[];
}

interface TelegramUpdate {
	update_id: number;
	message?: TelegramMessage;
}

export const telegramWebhookRoute = new Hono();

telegramWebhookRoute.post("/", async (c) => {
	if (env.TELEGRAM_WEBHOOK_SECRET) {
		const provided = c.req.header("x-telegram-bot-api-secret-token");
		if (provided !== env.TELEGRAM_WEBHOOK_SECRET) {
			logger.warn("invalid Telegram webhook secret");
			return c.text("forbidden", 403);
		}
	} else {
		logger.warn("TELEGRAM_WEBHOOK_SECRET not set — accepting webhook without verification");
	}

	const update = (await c.req.json()) as TelegramUpdate;
	const message = update.message;
	if (!message) {
		// Edits, channel posts, callback queries — ignored for now.
		return c.json({ ok: true });
	}

	const chatId = String(message.chat.id);
	if (env.TELEGRAM_ALLOWED_CHAT_ID && chatId !== env.TELEGRAM_ALLOWED_CHAT_ID) {
		logger.warn({ chatId }, "Telegram message from non-allowed chat — ignored");
		return c.json({ ok: true });
	}

	// Telegram delivers photos as an array of size variants of the same image.
	// Pick the largest by file_size; for multi-photo messages each photo arrives
	// as its own update, so the array here represents one logical image.
	const media = message.photo
		? [
				{
					fileId:
						[...message.photo].sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))[0]
							?.file_id ?? "",
					contentType: "image/jpeg",
				},
			].filter((m) => m.fileId)
		: [];

	await handleIncoming({
		from: chatId,
		text: message.text ?? message.caption ?? "",
		media: media.map((m) => ({ url: m.fileId, contentType: m.contentType })),
		messageSid: String(update.update_id),
	});

	return c.json({ ok: true });
});
