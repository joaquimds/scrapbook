import { sendSetupLink } from "~/server/app/setup-link.ts";
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

// Drives the bot-side registration flow for an unknown chat. Two steps —
// invite code then username — and then the user is told to finish setup
// (set a password) on the web. Returns true once registration completes.
export async function handleTelegramRegistration(chatId: string, text: string): Promise<boolean> {
	const trimmed = text.trim();
	const existing = await findRegistration(chatId);

	if (!existing) {
		await startRegistration(chatId);
		await sendTelegramMessage(
			chatId,
			"Welcome to Scrapboard. Send the invite code to get started.",
		);
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
		const user = await createUser({ username: candidate, telegramChatId: chatId });
		await deleteRegistration(chatId);
		logger.info({ userId: user.id, username: candidate, chatId }, "user registered via Telegram");
		await sendTelegramMessage(chatId, `You're in, ${candidate}!`);
		await sendSetupLink(user.id, chatId);
		return true;
	}

	return false;
}
