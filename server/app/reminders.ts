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

// Selects the friend most overdue for a touch and DMs the user about them.
// At most one reminder per run; safe to invoke repeatedly (no-op if there's
// an outstanding reminder waiting on a reply).
export async function runDailyReminder(): Promise<void> {
	const chatId = env.TELEGRAM_ALLOWED_CHAT_ID;
	if (!chatId) {
		logger.warn("runDailyReminder: TELEGRAM_ALLOWED_CHAT_ID not set — skipping");
		return;
	}

	const person = await pickPersonDueForReminder({ cooldownDays: env.REMINDER_COOLDOWN_DAYS });
	if (!person) {
		logger.info("runDailyReminder: no person due — skipping");
		return;
	}

	if (await hasUnackedReminder(person.id, ACK_WINDOW_HOURS)) {
		logger.info(
			{ personId: person.id, name: person.name },
			"runDailyReminder: outstanding reminder for person — skipping",
		);
		return;
	}

	const scrap = await pickReminderScrap(person.id);
	const caption = `Reach out to ${person.name}?`;
	logger.info(
		{ personId: person.id, name: person.name, scrapId: scrap?.id ?? null },
		"runDailyReminder: sending reminder",
	);

	if (scrap?.mediaPath) {
		try {
			await sendTelegramPhoto(chatId, scrap.mediaPath, caption);
		} catch (err) {
			logger.error({ err, personId: person.id }, "photo send failed — falling back to text");
			await sendTelegramMessage(chatId, caption);
		}
	} else {
		await sendTelegramMessage(chatId, caption);
	}

	await recordReminderSent(person.id, scrap?.id ?? null);
	await upsertSession({
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
			await recordContact(personId);
			logger.info({ personId }, "logged contact via reminder reply");
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
