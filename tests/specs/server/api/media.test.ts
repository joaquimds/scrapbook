import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createScrap } from "~/server/repositories/scraps.ts";
import { req } from "~/tests/harness/app.ts";
import { TEST_USER_ID } from "~/tests/harness/db.ts";

function storageRoot(): string {
	return process.env.STORAGE_ROOT ?? "/tmp/scrapbook-test";
}

async function writeMediaFile(id: string, ext: string, body: string): Promise<string> {
	const dir = join(storageRoot(), "scraps", "2024", "01");
	await mkdir(dir, { recursive: true });
	const filename = `${id}.${ext}`;
	await writeFile(join(dir, filename), body);
	return `/media/scraps/2024/01/${filename}`;
}

describe("GET /media/*", () => {
	it("serves a file owned by the requesting user", async () => {
		const scrap = await createScrap(TEST_USER_ID, {
			kind: "photo",
			body: null,
			source: "manual",
		});
		const url = await writeMediaFile(scrap.id, "txt", "hello storage");

		const res = await req("GET", url);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("hello storage");
	});

	it("returns 404 for missing file (no scrap exists)", async () => {
		const res = await req("GET", "/media/scraps/2024/01/missing.jpg");
		expect(res.status).toBe(404);
	});

	it("returns 404 when the scrap belongs to a different user", async () => {
		// File written but the scrap row exists under a different (nonexistent)
		// user id, simulating cross-user access — findScrapOwner returns
		// undefined because there's no scrap with that id under TEST_USER_ID.
		await writeMediaFile("orphan-id", "txt", "shouldn't see this");
		const res = await req("GET", "/media/scraps/2024/01/orphan-id.txt");
		expect(res.status).toBe(404);
	});
});
