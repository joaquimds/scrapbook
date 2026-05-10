import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { webhook } from "~/tests/client/harness/app.ts";
import { textUpdate } from "~/tests/client/harness/fixtures.ts";
import { lastSentMessage, sentMessages } from "~/tests/client/harness/telegram.ts";

describe("Text message ingestion", () => {
	it("prompts user when no session and empty text", async () => {
		await webhook(textUpdate(""));
		const msg = lastSentMessage();
		expect(msg?.text).toMatch(/quote|image|song/i);

		const scraps = await db.selectFrom("scraps").selectAll().execute();
		expect(scraps).toHaveLength(0);
	});

	it("creates a scrap and sets awaitingFriends session", async () => {
		await webhook(textUpdate("A great quote"));

		const scraps = await db.selectFrom("scraps").selectAll().execute();
		expect(scraps).toHaveLength(1);
		expect(scraps[0]?.body).toBe("A great quote");
		expect(scraps[0]?.source).toBe("telegram");

		const sessions = await db.selectFrom("ingestionSessions").selectAll().execute();
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.state).toBe("awaitingFriends");
	});

	it("sends Saved! acknowledgement after quote creation", async () => {
		await webhook(textUpdate("My quote"));
		const messages = sentMessages();
		expect(messages.some((m) => m.text.includes("Saved!"))).toBe(true);
	});

	it("trims whitespace from text before creating scrap", async () => {
		await webhook(textUpdate("  trimmed quote  "));
		const scraps = await db.selectFrom("scraps").selectAll().execute();
		expect(scraps[0]?.body).toBe("trimmed quote");
	});
});
