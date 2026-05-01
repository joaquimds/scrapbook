import { describe, expect, it } from "vitest";
import { req, webhook } from "~/tests/harness/app.ts";
import { textUpdate } from "~/tests/harness/fixtures.ts";

describe("Telegram webhook secret verification", () => {
	it("returns 403 when secret header is missing", async () => {
		const res = await req("POST", "/api/webhooks/telegram", {
			body: textUpdate("hello"),
		});
		expect(res.status).toBe(403);
	});

	it("returns 403 when secret header is wrong", async () => {
		const res = await webhook(textUpdate("hello"), "wrong-secret");
		expect(res.status).toBe(403);
	});

	it("returns 200 when secret header matches", async () => {
		const res = await webhook(textUpdate("hello"), "test-secret");
		expect(res.status).toBe(200);
	});
});
