import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { webhook } from "~/tests/harness/app.ts";
import { photoUpdate } from "~/tests/harness/fixtures.ts";
import { sentMessages } from "~/tests/harness/telegram.ts";

function storageRoot(): string {
	return process.env.STORAGE_ROOT ?? "/tmp/scrapbook-test";
}

describe("Single photo ingestion", () => {
	it("downloads, saves original and thumbnail, creates scrap, sets awaitingImageKind session", async () => {
		const update = photoUpdate({ caption: "nice pic" });
		await webhook(update);

		const scraps = await db.selectFrom("scraps").selectAll().execute();
		expect(scraps).toHaveLength(1);

		const [scrap] = scraps;
		if (!scrap) throw new Error("expected one scrap");
		expect(scrap.kind).toBe("photo");
		expect(scrap.body).toBe("nice pic");
		expect(scrap.source).toBe("telegram");

		const { mediaPath, thumbnailPath } = scrap;
		if (!mediaPath || !thumbnailPath) throw new Error("expected media + thumbnail paths");
		expect(existsSync(join(storageRoot(), mediaPath))).toBe(true);
		expect(existsSync(join(storageRoot(), thumbnailPath))).toBe(true);
	});

	it("picks the largest photo variant by file_size", async () => {
		const update = photoUpdate({ fileId: "small_file" });
		// photoUpdate helper already puts a larger variant (_lg) as the last item;
		// the route should pick the one with the highest file_size.
		await webhook(update);

		const scraps = await db.selectFrom("scraps").selectAll().execute();
		expect(scraps).toHaveLength(1);
		// downloadTelegramFile is mocked; we just verify it was called once
		// (the largest variant) rather than multiple times.
		const { vi } = await import("vitest");
		const tg = await import("~/server/services/telegram.ts");
		expect(vi.mocked(tg.downloadTelegramFile)).toHaveBeenCalledTimes(1);
		// The largest file_id ends with _lg
		expect(vi.mocked(tg.downloadTelegramFile).mock.calls[0]?.[0]).toBe("small_file_lg");
	});

	it("creates awaitingImageKind session", async () => {
		await webhook(photoUpdate());

		const sessions = await db.selectFrom("ingestionSessions").selectAll().execute();
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.state).toBe("awaitingImageKind");
	});

	it("prompts for image kind after saving", async () => {
		await webhook(photoUpdate());
		const messages = sentMessages();
		expect(messages.some((m) => /photo|meme|text/i.test(m.text))).toBe(true);
	});

	it("sets mediaPath under scraps/YYYY/MM directory", async () => {
		await webhook(photoUpdate());
		const scrap = await db.selectFrom("scraps").selectAll().executeTakeFirstOrThrow();
		expect(scrap.mediaPath).toMatch(/^scraps\/\d{4}\/\d{2}\//);
	});
});
