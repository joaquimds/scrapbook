import { env } from "~/server/env.ts";
import { logger } from "~/server/utils/logger.ts";

// Telegram Bot API — direct fetch. Single REST call per send; the SDK isn't
// worth pulling in for the surface area we use.

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
	if (!env.TELEGRAM_BOT_TOKEN) {
		logger.warn({ chatId, text }, "TELEGRAM_BOT_TOKEN not set — skipping Telegram send");
		return;
	}
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
}
