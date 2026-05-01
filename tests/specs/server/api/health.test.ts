import { describe, expect, it } from "vitest";
import { req } from "~/tests/harness/app.ts";

describe("GET /api/health", () => {
	it("returns ok", async () => {
		const res = await req("GET", "/api/health");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});
});
