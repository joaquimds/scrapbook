import { Hono } from "hono";
import { handleIncoming, type IncomingMessage } from "~/server/app/ingestion.ts";
import { env } from "~/server/env.ts";
import { logger } from "~/server/utils/logger.ts";

interface TelegramPhotoSize {
	file_id: string;
	file_unique_id: string;
	width: number;
	height: number;
	file_size?: number;
}

interface TelegramDocument {
	file_id: string;
	file_unique_id: string;
	mime_type?: string;
	file_name?: string;
	file_size?: number;
}

interface TelegramMessage {
	message_id: number;
	chat: { id: number };
	text?: string;
	caption?: string;
	photo?: TelegramPhotoSize[];
	document?: TelegramDocument;
	media_group_id?: string;
}

interface TelegramUpdate {
	update_id: number;
	message?: TelegramMessage;
}

// Telegram delivers an album as N separate updates that share a media_group_id.
// We buffer them in memory for a short window, then dispatch as a single
// IncomingMessage so the user is only prompted once for kind + tags.
const ALBUM_DEBOUNCE_MS = env.ALBUM_DEBOUNCE_MS;

interface AlbumBuffer {
	chatId: string;
	media: { fileId: string; messageSid: string }[];
	caption: string;
	timer: NodeJS.Timeout;
}

const albumBuffers = new Map<string, AlbumBuffer>();

export function resetAlbumBuffers(): void {
	albumBuffers.clear();
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
	logger.info(
		{ updateId: update.update_id, hasMessage: !!update.message },
		"Telegram webhook received",
	);
	const message = update.message;
	if (!message) {
		logger.info({ updateId: update.update_id }, "Telegram update has no message — ignored");
		return c.json({ ok: true });
	}

	const chatId = String(message.chat.id);
	if (env.TELEGRAM_ALLOWED_CHAT_ID && chatId !== env.TELEGRAM_ALLOWED_CHAT_ID) {
		logger.warn({ chatId }, "Telegram message from non-allowed chat — ignored");
		return c.json({ ok: true });
	}

	const updateId = String(update.update_id);
	logger.info(
		{
			updateId,
			chatId,
			messageId: message.message_id,
			textLength: (message.text ?? message.caption ?? "").length,
			photoVariants: message.photo?.length ?? 0,
			documentMime: message.document?.mime_type,
			mediaGroupId: message.media_group_id,
		},
		"Telegram message accepted",
	);

	// "Send as file" delivers an image as `document` (no compression / no
	// thumbnails array). Treat image-mime documents the same as a single photo.
	const imageFileId = pickImageFileId(message);
	if (imageFileId) {
		const caption = message.caption ?? "";

		if (message.media_group_id) {
			logger.info(
				{ updateId, mediaGroupId: message.media_group_id, fileId: imageFileId },
				"buffering album photo",
			);
			bufferAlbumPhoto(message.media_group_id, {
				chatId,
				fileId: imageFileId,
				messageSid: updateId,
				caption,
			});
			return c.json({ ok: true });
		}

		// Single photo — dispatch immediately.
		logger.info({ updateId, fileId: imageFileId }, "dispatching single photo");
		await dispatch({
			from: chatId,
			text: caption,
			media: [{ fileId: imageFileId, messageSid: updateId }],
			messageSid: updateId,
		});
		return c.json({ ok: true });
	}

	const text = message.text ?? message.caption ?? "";
	logger.info({ updateId, textLength: text.length }, "dispatching text message");
	await dispatch({
		from: chatId,
		text,
		media: [],
		messageSid: updateId,
	});
	return c.json({ ok: true });
});

function pickImageFileId(message: TelegramMessage): string | null {
	if (message.photo && message.photo.length > 0) {
		const largest = [...message.photo].sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))[0];
		if (largest) return largest.file_id;
	}
	if (message.document?.mime_type?.startsWith("image/")) {
		return message.document.file_id;
	}
	return null;
}

function bufferAlbumPhoto(
	groupId: string,
	item: { chatId: string; fileId: string; messageSid: string; caption: string },
): void {
	const existing = albumBuffers.get(groupId);
	if (existing) {
		clearTimeout(existing.timer);
		existing.media.push({ fileId: item.fileId, messageSid: item.messageSid });
		if (!existing.caption && item.caption) existing.caption = item.caption;
		existing.timer = setTimeout(async () => {
			await flushAlbum(groupId);
		}, ALBUM_DEBOUNCE_MS);
		return;
	}
	const buffer: AlbumBuffer = {
		chatId: item.chatId,
		media: [{ fileId: item.fileId, messageSid: item.messageSid }],
		caption: item.caption,
		timer: setTimeout(async () => {
			await flushAlbum(groupId);
		}, ALBUM_DEBOUNCE_MS),
	};
	albumBuffers.set(groupId, buffer);
}

async function flushAlbum(groupId: string): Promise<void> {
	const buffer = albumBuffers.get(groupId);
	if (!buffer) return;
	albumBuffers.delete(groupId);
	const firstSid = buffer.media[0]?.messageSid ?? "";
	logger.info(
		{ groupId, photoCount: buffer.media.length, chatId: buffer.chatId },
		"flushing album buffer",
	);
	await dispatch({
		from: buffer.chatId,
		text: buffer.caption,
		media: buffer.media,
		messageSid: firstSid,
	});
}

async function dispatch(msg: IncomingMessage): Promise<void> {
	logger.info(
		{ from: msg.from, mediaCount: msg.media.length, messageSid: msg.messageSid },
		"dispatching to ingestion",
	);
	try {
		await handleIncoming(msg);
	} catch (err) {
		logger.error({ err, from: msg.from }, "ingestion failed");
	}
}
