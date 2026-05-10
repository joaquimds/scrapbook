import { handleContactReply } from "~/server/app/reminders.ts";
import { deleteScrapsWithMedia } from "~/server/app/scraps.ts";
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
	updateScrapBody,
} from "~/server/repositories/scraps.ts";
import { saveOriginal } from "~/server/services/media-storage/index.ts";
import { downloadTelegramFile, sendTelegramMessage } from "~/server/services/telegram.ts";
import { logger } from "~/server/utils/logger.ts";
import { newId } from "~/shared/utils/id.ts";

interface IncomingMedia {
	fileId: string;
	messageSid: string;
}

export interface IncomingMessage {
	userId: string;
	from: string; // Telegram chat id (numeric, stringified)
	text: string;
	media: IncomingMedia[];
	messageSid: string; // Telegram update_id (stringified) — used for idempotency
}

export async function handleIncoming(msg: IncomingMessage): Promise<void> {
	logger.info(
		{
			userId: msg.userId,
			from: msg.from,
			mediaCount: msg.media.length,
			textLength: msg.text.length,
			messageSid: msg.messageSid,
		},
		"handling incoming message",
	);
	if (msg.media.length > 0) {
		await handleMedia(msg);
		return;
	}

	// Idempotency on Telegram update_id.
	const existing = await findScrapByExternalMessageId(msg.userId, msg.messageSid);
	if (existing) {
		logger.info({ messageSid: msg.messageSid }, "duplicate webhook ignored");
		return;
	}

	const session = await findActiveSession(msg.userId, msg.from);
	const text = msg.text.trim();
	logger.info(
		{
			from: msg.from,
			sessionState: session?.state ?? null,
			pendingScrapIds: session?.pendingScrapIds.length ?? 0,
		},
		"resolved ingestion session",
	);

	if (isCancelCommand(text)) {
		if (session && CANCELLABLE_STATES.has(session.state)) {
			logger.info(
				{ from: msg.from, state: session.state, scrapIds: session.pendingScrapIds },
				"cancelling scrap-add flow",
			);
			await deleteScrapsWithMedia(msg.userId, session.pendingScrapIds);
			await deleteSession(session.id);
			await sendTelegramMessage(msg.from, "Cancelled. Nothing saved.");
		} else {
			await sendTelegramMessage(msg.from, "Nothing to cancel.");
		}
		return;
	}

	if (!session) {
		if (!text) {
			logger.info({ from: msg.from }, "empty text with no session — prompting user");
			await sendTelegramMessage(msg.from, "Send me a quote, image, or song to scrap.");
			return;
		}
		const scrap = await createScrap(msg.userId, {
			body: text,
			source: "telegram",
			externalMessageId: msg.messageSid,
		});
		logger.info({ scrapId: scrap.id, from: msg.from }, "created quote scrap");
		await upsertSession({
			userId: msg.userId,
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

	if (session.state === "awaitingContactReply") {
		const handled = await handleContactReply(msg.userId, session, msg.from, text);
		if (handled) return;
		// fall through: empty text with no reply state — clear and prompt.
		await sendTelegramMessage(msg.from, "Send me a quote, image, or song to scrap.");
		return;
	}

	if (session.state === "awaitingImageCaption") {
		const isSkip = text.toLowerCase() === "skip" || text === "";
		if (!isSkip) {
			logger.info(
				{ from: msg.from, scrapIds: session.pendingScrapIds, captionLength: text.length },
				"saving caption",
			);
			for (const scrapId of session.pendingScrapIds) {
				await updateScrapBody(msg.userId, scrapId, text);
			}
		} else {
			logger.info({ from: msg.from }, "user skipped caption");
		}
		await upsertSession({
			userId: msg.userId,
			chatId: msg.from,
			state: "awaitingFriends",
			pendingScrapIds: session.pendingScrapIds,
		});
		await sendTelegramMessage(
			msg.from,
			`Who ${session.pendingScrapIds.length > 1 ? "are these related to" : "is this related to"}? Reply with friend names (comma-separated), or "skip".`,
		);
		return;
	}

	if (session.state === "awaitingFriends") {
		if (text.toLowerCase() === "skip" || text === "") {
			logger.info({ from: msg.from }, "user skipped tagging");
			await deleteSession(session.id);
			await sendTelegramMessage(msg.from, "Skipped tagging. Send another scrap any time.");
			return;
		}
		const names = parseFriendNames(text);
		logger.info({ from: msg.from, names }, "parsed friend names");
		const people = await resolveOrCreatePeople(msg.userId, names);
		logger.info(
			{
				from: msg.from,
				peopleIds: people.map((p) => p.id),
				peopleNames: people.map((p) => p.name),
			},
			"resolved people",
		);
		for (const scrapId of session.pendingScrapIds) {
			await addScrapPeople(
				scrapId,
				people.map((p) => p.id),
			);
		}

		// Featured-photo branch: single photo + single tag.
		const onlyScrapId =
			session.pendingScrapIds.length === 1 ? session.pendingScrapIds[0] : undefined;
		const onlyPerson = people.length === 1 ? people[0] : undefined;
		if (onlyScrapId && onlyPerson) {
			const scrap = await findScrapById(msg.userId, onlyScrapId);
			if (scrap?.mediaUrl) {
				await upsertSession({
					userId: msg.userId,
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
		logger.info({ from: msg.from, yes, onlyScrapId }, "featured-photo decision");
		if (yes && onlyScrapId) {
			const scrap = await findScrapById(msg.userId, onlyScrapId);
			const personId = scrap?.peopleIds[0];
			if (scrap && personId) {
				await setFeaturedScrap(msg.userId, personId, scrap.id);
				logger.info({ scrapId: scrap.id, personId }, "set featured scrap");
			}
			await sendTelegramMessage(msg.from, "Set as featured photo. ✨ Send another any time.");
		} else {
			await sendTelegramMessage(
				msg.from,
				"OK, leaving featured photo unchanged. Send another any time.",
			);
		}
		await deleteSession(session.id);
		return;
	}

	logger.warn({ state: session.state }, "unhandled ingestion state");
	await deleteSession(session.id);
}

async function handleMedia(msg: IncomingMessage): Promise<void> {
	logger.info(
		{ from: msg.from, mediaCount: msg.media.length, captionLength: msg.text.length },
		"handling media batch",
	);
	// If any of these update_ids already produced a scrap, treat the whole
	// batch as a replay. (Telegram albums arrive as N updates collapsed into
	// one IncomingMessage by the webhook.)
	for (const m of msg.media) {
		const existing = await findScrapByExternalMessageId(msg.userId, m.messageSid);
		if (existing) {
			logger.info({ messageSid: m.messageSid }, "duplicate media webhook ignored");
			return;
		}
	}

	const caption = msg.text.trim() || null;
	const scrapIds: string[] = [];

	for (const m of msg.media) {
		try {
			logger.info({ fileId: m.fileId }, "ingesting media item");
			const { buffer, ext } = await downloadTelegramFile(m.fileId);
			const id = newId();
			const { mediaUrl } = await saveOriginal({ id, buffer, ext });
			logger.info({ id, mediaUrl, bytes: buffer.length }, "saved original media");
			const scrap = await createScrap(msg.userId, {
				id,
				body: caption,
				mediaUrl,
				source: "telegram",
				externalMessageId: m.messageSid,
			});
			logger.info({ scrapId: scrap.id }, "created photo scrap");
			scrapIds.push(scrap.id);
		} catch (err) {
			logger.error({ err, fileId: m.fileId }, "failed to ingest Telegram photo");
		}
	}

	if (scrapIds.length === 0) {
		await sendTelegramMessage(msg.from, "Sorry — couldn't save that image. Try again?");
		return;
	}

	const noun = scrapIds.length > 1 ? `${scrapIds.length} images` : "image";
	if (caption) {
		await upsertSession({
			userId: msg.userId,
			chatId: msg.from,
			state: "awaitingFriends",
			pendingScrapIds: scrapIds,
		});
		await sendTelegramMessage(
			msg.from,
			`Saved ${noun}. Who ${scrapIds.length > 1 ? "are these related to" : "is this related to"}? Reply with friend names (comma-separated), or "skip".`,
		);
		return;
	}

	await upsertSession({
		userId: msg.userId,
		chatId: msg.from,
		state: "awaitingImageCaption",
		pendingScrapIds: scrapIds,
	});
	await sendTelegramMessage(msg.from, `Saved ${noun}. Add a caption, or reply "skip".`);
}

const CANCELLABLE_STATES = new Set([
	"awaitingImageCaption",
	"awaitingFriends",
	"awaitingFeaturedDecision",
]);

function isCancelCommand(text: string): boolean {
	return /^\/?cancel$/i.test(text.trim());
}

function parseFriendNames(text: string): string[] {
	return text
		.split(/,| and /i)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}
