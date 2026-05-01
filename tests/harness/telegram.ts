import { vi } from "vitest";
import * as tg from "~/server/services/telegram.ts";

export function sentMessages(): Array<{ chatId: string; text: string }> {
	return vi.mocked(tg.sendTelegramMessage).mock.calls.map(([chatId, text]) => ({ chatId, text }));
}

export function sentPhotos(): Array<{ chatId: string; path: string; caption: string | undefined }> {
	return vi.mocked(tg.sendTelegramPhoto).mock.calls.map(([chatId, path, caption]) => ({
		chatId,
		path,
		caption,
	}));
}

export function lastSentMessage(): { chatId: string; text: string } | undefined {
	const calls = sentMessages();
	return calls[calls.length - 1];
}
