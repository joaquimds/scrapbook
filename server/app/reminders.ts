import { db } from "~/server/db/connection.ts";
import { env } from "~/server/env.ts";
import { deleteSession, upsertSession } from "~/server/repositories/ingestion-sessions.ts";
import {
	hasUnackedReminder,
	pickPersonDueForReminder,
	pickReminderScrap,
	recordContact,
	recordReminderSent,
} from "~/server/repositories/reminders.ts";
import { sendTelegramMessage, sendTelegramPhoto } from "~/server/services/telegram.ts";
import { logger } from "~/server/utils/logger.ts";
import type { IngestionSession } from "~/shared/models/IngestionSession.ts";

const ACK_WINDOW_HOURS = 24;

// Iterates every user and runs one reminder pass for each. At most one reminder
// is sent per user per call; safe to invoke repeatedly.
export async function runDailyReminder(): Promise<void> {
	const users = await db.selectFrom("users").select(["id", "telegramChatId"]).execute();
	logger.info({ userCount: users.length }, "runDailyReminder: iterating users");
	for (const user of users) {
		try {
			await runDailyReminderForUser(user.id, user.telegramChatId);
		} catch (err) {
			logger.error({ err, userId: user.id }, "runDailyReminder: user run failed");
		}
	}
}

async function runDailyReminderForUser(userId: string, chatId: string): Promise<void> {
	const person = await pickPersonDueForReminder(userId, {
		cooldownDays: env.REMINDER_COOLDOWN_DAYS,
	});
	if (!person) {
		logger.info({ userId }, "runDailyReminder: no person due for user — skipping");
		return;
	}

	if (await hasUnackedReminder(userId, person.id, ACK_WINDOW_HOURS)) {
		logger.info(
			{ userId, personId: person.id, name: person.name },
			"runDailyReminder: outstanding reminder for person — skipping",
		);
		return;
	}

	const scrap = await pickReminderScrap(userId, person.id);
	const prompt = `Reach out to ${person.name}?`;
	const body = scrap?.body?.trim();
	const message = body ? `${body}\n\n${prompt}` : prompt;
	logger.info(
		{ userId, personId: person.id, name: person.name, scrapId: scrap?.id ?? null },
		"runDailyReminder: sending reminder",
	);

	if (scrap?.mediaUrl) {
		try {
			await sendTelegramPhoto(chatId, scrap.mediaUrl, message);
		} catch (err) {
			logger.error({ err, personId: person.id }, "photo send failed — falling back to text");
			await sendTelegramMessage(chatId, message);
		}
	} else {
		await sendTelegramMessage(chatId, message);
	}

	await recordReminderSent(userId, person.id, scrap?.id ?? null);
	await upsertSession({
		userId,
		chatId,
		state: "awaitingContactReply",
		pendingScrapIds: [],
		pendingPersonIds: [person.id],
	});
	await sendTelegramMessage(
		chatId,
		`Reply "yes" once you've reached out, or "skip" to be reminded later.`,
	);
}

// Returns true if it handled the reply (caller should return early).
export async function handleContactReply(
	userId: string,
	session: IngestionSession,
	chatId: string,
	text: string,
): Promise<boolean> {
	const t = text.trim().toLowerCase();
	if (t === "" || session.pendingPersonIds.length === 0) {
		await deleteSession(session.id);
		return false;
	}

	if (/^(y|yes|yeah|yep|done|ok|okay|✓)$/.test(t)) {
		for (const personId of session.pendingPersonIds) {
			await recordContact(userId, personId);
			logger.info({ userId, personId }, "logged contact via reminder reply");
		}
		await deleteSession(session.id);
		await sendTelegramMessage(chatId, "Logged. ✓");
		return true;
	}

	if (/^(n|no|skip|later|nope)$/.test(t)) {
		await deleteSession(session.id);
		await sendTelegramMessage(chatId, "OK, I'll ask again later.");
		return true;
	}

	// Unrecognised reply: clear the reminder state and tell the user. They can
	// resend their message — it'll be ingested as a normal scrap.
	logger.info({ chatId, text: t }, "unrecognised contact reply — clearing state");
	await deleteSession(session.id);
	await sendTelegramMessage(
		chatId,
		`Didn't catch that — say "yes" or "skip" next time. Send your scrap again to save it.`,
	);
	return true;
}
