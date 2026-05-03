import { readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { env } from "~/server/env.ts";
import { logger } from "~/server/utils/logger.ts";

// Resolves an app-shaped media URL to a publicly-reachable URL or local file.
// - https://… → Telegram fetches it directly.
// - /media/<rel> → local-driver path; we read from STORAGE_ROOT and upload as multipart.

// Telegram Bot API — direct fetch. Single REST call per send; the SDK isn't
// worth pulling in for the surface area we use.

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
	if (!env.TELEGRAM_BOT_TOKEN) {
		logger.warn({ chatId, text }, "TELEGRAM_BOT_TOKEN not set — skipping Telegram send");
		return;
	}
	logger.info(
		{ chatId, textLength: text.length, preview: text.slice(0, 80) },
		"sending Telegram message",
	);
	const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ chat_id: chatId, text }),
	});
	if (!res.ok) {
		const body = await res.text();
		logger.error({ status: res.status, body }, "Telegram send failed");
		throw new Error(`Telegram send failed: ${res.status}`);
	}
	logger.info({ chatId }, "Telegram message sent");
}

// Registers (overwriting any existing registration) the Telegram webhook for
// this bot. `drop_pending_updates` ensures we don't replay a queue of updates
// from a previous tunnel URL.
export async function setTelegramWebhook(url: string): Promise<void> {
	if (!env.TELEGRAM_BOT_TOKEN) {
		logger.warn("TELEGRAM_BOT_TOKEN not set — skipping webhook registration");
		return;
	}
	const body: Record<string, unknown> = {
		url,
		drop_pending_updates: true,
	};
	if (env.TELEGRAM_WEBHOOK_SECRET) {
		body.secret_token = env.TELEGRAM_WEBHOOK_SECRET;
	}
	const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const text = await res.text();
		logger.error({ status: res.status, text, url }, "Telegram setWebhook failed");
		throw new Error(`Telegram setWebhook failed: ${res.status}`);
	}
	logger.info({ url }, "Telegram webhook registered");
}

// Sends a photo by URL. For https:// URLs, Telegram fetches it server-side.
// For app-internal /media/<rel> paths (local driver), reads from STORAGE_ROOT
// and uploads as multipart/form-data.
export async function sendTelegramPhoto(
	chatId: string,
	mediaUrl: string,
	caption?: string,
): Promise<void> {
	if (!env.TELEGRAM_BOT_TOKEN) {
		logger.warn({ chatId, mediaUrl }, "TELEGRAM_BOT_TOKEN not set — skipping Telegram photo");
		return;
	}
	const apiUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`;

	if (/^https?:\/\//.test(mediaUrl)) {
		logger.info(
			{ chatId, mediaUrl, hasCaption: Boolean(caption) },
			"sending Telegram photo by URL",
		);
		const res = await fetch(apiUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ chat_id: chatId, photo: mediaUrl, caption }),
		});
		if (!res.ok) {
			const body = await res.text();
			logger.error({ status: res.status, body }, "Telegram sendPhoto failed");
			throw new Error(`Telegram sendPhoto failed: ${res.status}`);
		}
		logger.info({ chatId, mediaUrl }, "Telegram photo sent");
		return;
	}

	const relativePath = mediaUrl.replace(/^\/media\//, "");
	const absolute = join(env.STORAGE_ROOT, relativePath);
	const buffer = await readFile(absolute);
	const filename = basename(absolute);
	const form = new FormData();
	form.set("chat_id", chatId);
	if (caption) form.set("caption", caption);
	form.set("photo", new Blob([new Uint8Array(buffer)]), filename);

	logger.info(
		{ chatId, relativePath, bytes: buffer.length, hasCaption: Boolean(caption) },
		"sending Telegram photo (multipart)",
	);
	const res = await fetch(apiUrl, { method: "POST", body: form });
	if (!res.ok) {
		const body = await res.text();
		logger.error({ status: res.status, body }, "Telegram sendPhoto failed");
		throw new Error(`Telegram sendPhoto failed: ${res.status}`);
	}
	logger.info({ chatId, relativePath }, "Telegram photo sent");
}

interface TelegramFile {
	file_path?: string;
}

// Telegram delivers files in two steps: getFile resolves a file_id to a
// `file_path`, then we download from /file/bot<token>/<file_path>. The download
// URL is unauthenticated but expires; always re-resolve before each download.
export async function downloadTelegramFile(
	fileId: string,
): Promise<{ buffer: Buffer; ext: string }> {
	if (!env.TELEGRAM_BOT_TOKEN) {
		throw new Error("TELEGRAM_BOT_TOKEN not set — cannot download file");
	}
	logger.info({ fileId }, "resolving Telegram file path");
	const metaRes = await fetch(
		`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
	);
	if (!metaRes.ok) {
		throw new Error(`Telegram getFile failed: ${metaRes.status}`);
	}
	const meta = (await metaRes.json()) as { ok: boolean; result?: TelegramFile };
	const filePath = meta.result?.file_path;
	if (!filePath) {
		throw new Error("Telegram getFile returned no file_path");
	}
	logger.info({ fileId, filePath }, "downloading Telegram file");
	const fileRes = await fetch(
		`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`,
	);
	if (!fileRes.ok) {
		throw new Error(`Telegram file download failed: ${fileRes.status}`);
	}
	const buffer = Buffer.from(await fileRes.arrayBuffer());
	const ext = extname(filePath).replace(/^\./, "").toLowerCase() || "jpg";
	logger.info({ fileId, bytes: buffer.length, ext }, "Telegram file downloaded");
	return { buffer, ext };
}
