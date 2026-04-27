import {
	deleteSession,
	findActiveSession,
	upsertSession,
} from "~/server/repositories/ingestion-sessions.ts";
import { resolveOrCreatePeople, setFeaturedScrap } from "~/server/repositories/people.ts";
import {
	addScrapPeople,
	createScrap,
	findScrapByExternalMessageId,
	findScrapById,
} from "~/server/repositories/scraps.ts";
import { sendTelegramMessage } from "~/server/services/telegram.ts";
import { logger } from "~/server/utils/logger.ts";

interface IncomingMedia {
	url: string;
	contentType: string;
}

export interface IncomingMessage {
	from: string; // Telegram chat id (numeric, stringified)
	text: string;
	media: IncomingMedia[];
	messageSid: string; // Telegram update_id (stringified) — used for idempotency
}

// Phase 1 scope: text-only ingestion. Image branches will be added in phase 2.
export async function handleIncoming(msg: IncomingMessage): Promise<void> {
	if (msg.media.length > 0) {
		await sendTelegramMessage(
			msg.from,
			"Got an image! Image ingestion is coming soon — for now I can only handle text quotes.",
		);
		return;
	}

	// Idempotency on Telegram update_id.
	const existing = await findScrapByExternalMessageId(msg.messageSid);
	if (existing) {
		logger.info({ messageSid: msg.messageSid }, "duplicate webhook ignored");
		return;
	}

	const session = await findActiveSession(msg.from);
	const text = msg.text.trim();

	if (!session) {
		if (!text) {
			await sendTelegramMessage(msg.from, "Send me a quote, image, or song to scrap.");
			return;
		}
		const scrap = await createScrap({
			kind: "quote",
			body: text,
			source: "telegram",
			externalMessageId: msg.messageSid,
		});
		await upsertSession({
			chatId: msg.from,
			state: "awaitingFriends",
			pendingScrapIds: [scrap.id],
		});
		await sendTelegramMessage(
			msg.from,
			`Saved! Who is this scrap related to? Reply with friend names (comma-separated), or "skip" to leave it untagged.`,
		);
		return;
	}

	if (session.state === "awaitingFriends") {
		if (text.toLowerCase() === "skip" || text === "") {
			await deleteSession(session.id);
			await sendTelegramMessage(msg.from, "Skipped tagging. Send another scrap any time.");
			return;
		}
		const names = parseFriendNames(text);
		const people = await resolveOrCreatePeople(names);
		for (const scrapId of session.pendingScrapIds) {
			await addScrapPeople(
				scrapId,
				people.map((p) => p.id),
			);
		}

		// Featured-photo branch only fires when exactly one scrap is pending,
		// it's a photo, and exactly one friend was tagged. Phase 2.
		const onlyScrapId =
			session.pendingScrapIds.length === 1 ? session.pendingScrapIds[0] : undefined;
		const onlyPerson = people.length === 1 ? people[0] : undefined;
		if (onlyScrapId && onlyPerson) {
			const scrap = await findScrapById(onlyScrapId);
			if (scrap?.kind === "photo") {
				await upsertSession({
					chatId: msg.from,
					state: "awaitingFeaturedDecision",
					pendingScrapIds: [onlyScrapId],
				});
				await sendTelegramMessage(
					msg.from,
					`Should this be ${onlyPerson.name}'s featured photo? Reply yes / no.`,
				);
				return;
			}
		}

		await deleteSession(session.id);
		const namesList = people.map((p) => p.name).join(", ");
		await sendTelegramMessage(msg.from, `Tagged with ${namesList}. Send another any time.`);
		return;
	}

	if (session.state === "awaitingFeaturedDecision") {
		const yes = /^(y|yes|yeah|yep|sure)/i.test(text);
		const onlyScrapId = session.pendingScrapIds[0];
		if (yes && onlyScrapId) {
			const scrap = await findScrapById(onlyScrapId);
			const personId = scrap?.peopleIds[0];
			if (scrap && personId) {
				await setFeaturedScrap(personId, scrap.id);
			}
			await sendTelegramMessage(msg.from, "Set as featured photo. ✨");
		} else {
			await sendTelegramMessage(msg.from, "OK, leaving featured photo unchanged.");
		}
		await deleteSession(session.id);
		return;
	}

	// awaitingImageKind branch handled in phase 2.
	logger.warn({ state: session.state }, "unhandled ingestion state");
	await deleteSession(session.id);
}

function parseFriendNames(text: string): string[] {
	return text
		.split(/,| and /i)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}
