import { describe, expect, it } from "vitest";
import { AUTH_COOKIE } from "~/server/middleware/require-auth.ts";
import { authCookieHeader, req } from "~/tests/harness/app.ts";
import { TEST_PASSWORD, TEST_USERNAME } from "~/tests/harness/db.ts";

describe("auth", () => {
	it("rejects /api/scraps without a cookie", async () => {
		const res = await req("GET", "/api/scraps", { authed: false });
		expect(res.status).toBe(401);
	});

	it("accepts /api/scraps with a valid cookie", async () => {
		const res = await req("GET", "/api/scraps");
		expect(res.status).toBe(200);
	});

	it("rejects /api/scraps with a bogus cookie of the right shape", async () => {
		const bogus = `bogus.${"a".repeat(64)}`;
		const res = await req("GET", "/api/scraps", {
			authed: false,
			headers: { Cookie: `${AUTH_COOKIE}=${bogus}` },
		});
		expect(res.status).toBe(401);
	});

	it("/api/health is open without a cookie", async () => {
		const res = await req("GET", "/api/health", { authed: false });
		expect(res.status).toBe(200);
	});

	it("POST /api/auth/login with the right credentials sets the cookie", async () => {
		const res = await req("POST", "/api/auth/login", {
			body: { username: TEST_USERNAME, password: TEST_PASSWORD },
			authed: false,
		});
		expect(res.status).toBe(200);
		const setCookie = res.headers.get("set-cookie");
		expect(setCookie).toBeTruthy();
		expect(setCookie).toContain(AUTH_COOKIE);
		expect(setCookie?.toLowerCase()).toContain("httponly");
	});

	it("POST /api/auth/login with the wrong password returns 401 and no cookie", async () => {
		const res = await req("POST", "/api/auth/login", {
			body: { username: TEST_USERNAME, password: "nope" },
			authed: false,
		});
		expect(res.status).toBe(401);
		expect(res.headers.get("set-cookie")).toBeFalsy();
	});

	it("POST /api/auth/login with an unknown username returns 401", async () => {
		const res = await req("POST", "/api/auth/login", {
			body: { username: "ghost", password: TEST_PASSWORD },
			authed: false,
		});
		expect(res.status).toBe(401);
	});

	it("GET /api/auth/check returns the user when authed, 401 when not", async () => {
		const ok = await req("GET", "/api/auth/check");
		expect(ok.status).toBe(200);
		const body = await ok.json();
		expect(body.user.username).toBe(TEST_USERNAME);
		const bad = await req("GET", "/api/auth/check", { authed: false });
		expect(bad.status).toBe(401);
	});

	it("POST /api/auth/logout clears the cookie", async () => {
		const res = await req("POST", "/api/auth/logout", { authed: false });
		expect(res.status).toBe(200);
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain(AUTH_COOKIE);
		expect(setCookie.toLowerCase()).toMatch(/max-age=0|expires=/);
	});

	it("authCookieHeader yields a cookie that authenticates", async () => {
		const res = await req("GET", "/api/scraps", {
			authed: false,
			headers: { Cookie: authCookieHeader() },
		});
		expect(res.status).toBe(200);
	});
});
