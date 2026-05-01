import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { req } from "~/tests/harness/app.ts";

function storageRoot(): string {
	return process.env.STORAGE_ROOT ?? "/tmp/scrapbook-test";
}

describe("GET /media/*", () => {
	it("serves a file from STORAGE_ROOT", async () => {
		const dir = join(storageRoot(), "scraps", "2024", "01");
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, "test.txt"), "hello storage");

		const res = await req("GET", "/media/scraps/2024/01/test.txt");
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toBe("hello storage");
	});

	it("returns 404 for missing file", async () => {
		const res = await req("GET", "/media/does/not/exist.jpg");
		expect(res.status).toBe(404);
	});
});
