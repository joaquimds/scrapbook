import { env } from "~/server/env.ts";
import {
	advanceRegistration,
	deleteRegistration,
	findRegistration,
	startRegistration,
} from "~/server/repositories/telegram-registrations.ts";
import { createUser, isUsernameTaken } from "~/server/repositories/users.ts";
import { sendTelegramMessage } from "~/server/services/telegram.ts";
import { logger } from "~/server/utils/logger.ts";

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;
const MIN_PASSWORD_LEN = 8;

// Drives the bot-side registration flow for an unknown chat. Returns true once
// the user finishes registering (caller should then treat the same chat as a
// known user on subsequent messages); returns false while still mid-flow.
export async function handleTelegramRegistration(chatId: string, text: string): Promise<boolean> {
	const trimmed = text.trim();
	const existing = await findRegistration(chatId);

	if (!existing) {
		await startRegistration(chatId);
		await sendTelegramMessage(chatId, "Welcome to Scrapbook. Send the invite code to get started.");
		return false;
	}

	if (existing.step === "awaiting_invite_code") {
		if (trimmed !== env.INVITE_CODE) {
			await sendTelegramMessage(chatId, "That's not the right invite code. Try again.");
			return false;
		}
		await advanceRegistration(chatId, { step: "awaiting_username" });
		await sendTelegramMessage(
			chatId,
			"Pick a username (3–32 chars, lowercase letters, numbers, underscores).",
		);
		return false;
	}

	if (existing.step === "awaiting_username") {
		const candidate = trimmed.toLowerCase();
		if (!USERNAME_RE.test(candidate)) {
			await sendTelegramMessage(
				chatId,
				"Usernames must be 3–32 characters, lowercase letters, numbers, or underscores.",
			);
			return false;
		}
		if (await isUsernameTaken(candidate)) {
			await sendTelegramMessage(chatId, "That username is taken. Try another.");
			return false;
		}
		await advanceRegistration(chatId, { step: "awaiting_password", username: candidate });
		await sendTelegramMessage(chatId, `Pick a password (at least ${MIN_PASSWORD_LEN} characters).`);
		return false;
	}

	if (existing.step === "awaiting_password") {
		if (trimmed.length < MIN_PASSWORD_LEN) {
			await sendTelegramMessage(
				chatId,
				`Password must be at least ${MIN_PASSWORD_LEN} characters. Try again.`,
			);
			return false;
		}
		const username = existing.username;
		if (!username) {
			logger.warn({ chatId }, "registration in awaiting_password without username — restarting");
			await deleteRegistration(chatId);
			return false;
		}
		const user = await createUser({ username, password: trimmed, telegramChatId: chatId });
		await deleteRegistration(chatId);
		logger.info({ userId: user.id, username, chatId }, "user registered via Telegram");
		await sendTelegramMessage(
			chatId,
			`Welcome, ${username}. Send a quote, photo, or song to start your scrapbook.`,
		);
		return true;
	}

	return false;
}
