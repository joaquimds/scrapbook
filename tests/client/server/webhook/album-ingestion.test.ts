import { beforeEach, describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { resetAlbumBuffers } from "~/server/routes/webhook-telegram.ts";
import { webhook } from "~/tests/client/harness/app.ts";
import { photoUpdate } from "~/tests/client/harness/fixtures.ts";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ALBUM_DEBOUNCE_MS is set to 50 in tests/setup-env.ts. Real-time waits below
// give comfortable headroom over that.
const PAST_DEBOUNCE = 200;

beforeEach(() => {
	resetAlbumBuffers();
});

describe("Album (media_group) ingestion", () => {
	it("buffers photos sharing a media_group_id and flushes after debounce", async () => {
		const groupId = "group_abc";

		const update1 = photoUpdate({ mediaGroupId: groupId, caption: "album caption" });
		const update2 = photoUpdate({ mediaGroupId: groupId });

		await webhook(update1);
		await webhook(update2);

		// Nothing ingested yet (well under debounce window)
		const scrapsBefore = await db.selectFrom("scraps").selectAll().execute();
		expect(scrapsBefore).toHaveLength(0);

		await sleep(PAST_DEBOUNCE);

		const scraps = await db.selectFrom("scraps").selectAll().execute();
		expect(scraps).toHaveLength(2);
		expect(scraps.every((s) => s.mediaUrl !== null)).toBe(true);
	});

	it("attaches caption from first update to the album", async () => {
		const groupId = "group_caption";
		await webhook(photoUpdate({ mediaGroupId: groupId, caption: "group caption" }));
		await webhook(photoUpdate({ mediaGroupId: groupId }));
		await sleep(PAST_DEBOUNCE);

		const scraps = await db.selectFrom("scraps").selectAll().execute();
		expect(scraps.some((s) => s.body === "group caption (1)")).toBe(true);
		expect(scraps.some((s) => s.body === "group caption (2)")).toBe(true);
	});

	it("creates a single awaitingImageCaption session for the whole uncaptioned album", async () => {
		const groupId = "group_session";
		await webhook(photoUpdate({ mediaGroupId: groupId }));
		await webhook(photoUpdate({ mediaGroupId: groupId }));
		await sleep(PAST_DEBOUNCE);

		const sessions = await db.selectFrom("ingestionSessions").selectAll().execute();
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.state).toBe("awaitingImageCaption");
	});

	it("resets debounce timer when a new photo arrives before flush", async () => {
		const groupId = "group_reset";
		await webhook(photoUpdate({ mediaGroupId: groupId }));

		// Under 50ms — not yet flushed
		await sleep(25);

		// Second photo resets the timer
		await webhook(photoUpdate({ mediaGroupId: groupId }));

		// 30ms since reset — still under 50ms debounce
		await sleep(30);
		const scrapsPartial = await db.selectFrom("scraps").selectAll().execute();
		expect(scrapsPartial).toHaveLength(0);

		await sleep(PAST_DEBOUNCE);
		const scraps = await db.selectFrom("scraps").selectAll().execute();
		expect(scraps).toHaveLength(2);
	});
});
