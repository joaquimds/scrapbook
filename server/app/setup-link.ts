import { getPublicBaseUrl } from "~/server/app/public-url.ts";
import { issueSetupToken } from "~/server/repositories/setup-tokens.ts";
import { sendTelegramMessage } from "~/server/services/telegram.ts";

// Issues a fresh setup token for the user and DMs the corresponding /setup
// link via Telegram. Used both during initial registration and as the
// "forgot password" mechanism.
export async function sendSetupLink(userId: string, chatId: string): Promise<void> {
	const token = await issueSetupToken(userId);
	const url = `${getPublicBaseUrl()}/setup?token=${token}`;
	await sendTelegramMessage(
		chatId,
		`Set your Scrapbook password here: ${url}\n\nLink expires in 30 minutes.`,
	);
}
