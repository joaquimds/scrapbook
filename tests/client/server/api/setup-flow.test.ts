import { sql } from "kysely";
import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { AUTH_COOKIE } from "~/server/middleware/require-auth.ts";
import { createUser } from "~/server/repositories/users.ts";
import { req } from "~/tests/client/harness/app.ts";
import { TEST_PASSWORD, TEST_USERNAME } from "~/tests/client/harness/db.ts";
import { lastSentMessage, sentMessages } from "~/tests/client/harness/telegram.ts";

async function makePasswordlessUser(username: string, chatId: string) {
	return await createUser({ username, telegramChatId: chatId });
}

const SETUP_URL_RE = /\/setup\?token=([0-9a-f]+)/;

function extractTokenFromLastMessage(): string {
	const match = lastSentMessage()?.text.match(SETUP_URL_RE);
	if (!match?.[1]) throw new Error("no setup token in last sent message");
	return match[1];
}

describe("POST /api/auth/forgot", () => {
	it("issues a setup token and DMs a setup link without touching the existing password", async () => {
		const before = await db
			.selectFrom("users")
			.select("passwordHash")
			.where("username", "=", TEST_USERNAME)
			.executeTakeFirstOrThrow();
		expect(before.passwordHash).not.toBeNull();

		const res = await req("POST", "/api/auth/forgot", {
			body: { username: TEST_USERNAME },
			authed: false,
		});
		expect(res.status).toBe(200);
		expect(lastSentMessage()?.text).toMatch(SETUP_URL_RE);

		const tokens = await db.selectFrom("setupTokens").selectAll().execute();
		expect(tokens).toHaveLength(1);

		const after = await db
			.selectFrom("users")
			.select("passwordHash")
			.where("username", "=", TEST_USERNAME)
			.executeTakeFirstOrThrow();
		expect(after.passwordHash).toBe(before.passwordHash);
	});

	it("is silent for an unknown username (no token, no message)", async () => {
		const res = await req("POST", "/api/auth/forgot", {
			body: { username: "nobody" },
			authed: false,
		});
		expect(res.status).toBe(200);
		const tokens = await db.selectFrom("setupTokens").selectAll().execute();
		expect(tokens).toHaveLength(0);
		expect(sentMessages()).toHaveLength(0);
	});
});

describe("GET /api/auth/setup-token/:token", () => {
	it("returns the username for a valid token", async () => {
		await req("POST", "/api/auth/forgot", { body: { username: TEST_USERNAME }, authed: false });
		const token = extractTokenFromLastMessage();

		const res = await req("GET", `/api/auth/setup-token/${token}`, { authed: false });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true, username: TEST_USERNAME });
	});

	it("returns 401 for an invalid token", async () => {
		const res = await req("GET", "/api/auth/setup-token/deadbeef", { authed: false });
		expect(res.status).toBe(401);
	});
});

describe("POST /api/auth/setup", () => {
	it("rejects an invalid token", async () => {
		const res = await req("POST", "/api/auth/setup", {
			body: { token: "deadbeef", password: "longenough" },
			authed: false,
		});
		expect(res.status).toBe(401);
	});

	it("accepts a valid token, sets a password, signs the user in, and clears the token", async () => {
		const user = await makePasswordlessUser("setupok", "77777");
		await req("POST", "/api/auth/forgot", { body: { username: "setupok" }, authed: false });
		const token = extractTokenFromLastMessage();

		const res = await req("POST", "/api/auth/setup", {
			body: { token, password: "longenough" },
			authed: false,
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("set-cookie") ?? "").toContain(AUTH_COOKIE);

		const after = await db
			.selectFrom("users")
			.select("passwordHash")
			.where("id", "=", user.id)
			.executeTakeFirstOrThrow();
		expect(after.passwordHash).not.toBeNull();

		const tokens = await db.selectFrom("setupTokens").selectAll().execute();
		expect(tokens).toHaveLength(0);
	});

	it("rejects a too-short password", async () => {
		await makePasswordlessUser("shorty", "88888");
		await req("POST", "/api/auth/forgot", { body: { username: "shorty" }, authed: false });
		const token = extractTokenFromLastMessage();
		const res = await req("POST", "/api/auth/setup", {
			body: { token, password: "short" },
			authed: false,
		});
		expect(res.status).toBe(400);
	});
});

describe("Forgot-password flow end-to-end", () => {
	const NEW_PASSWORD = "brand-new-pw";

	it("happy path: forgot → setup with token → old password rejected, new accepted", async () => {
		const before = await req("POST", "/api/auth/login", {
			body: { username: TEST_USERNAME, password: TEST_PASSWORD },
			authed: false,
		});
		expect(before.status).toBe(200);

		await req("POST", "/api/auth/forgot", { body: { username: TEST_USERNAME }, authed: false });
		const token = extractTokenFromLastMessage();

		const setup = await req("POST", "/api/auth/setup", {
			body: { token, password: NEW_PASSWORD },
			authed: false,
		});
		expect(setup.status).toBe(200);
		expect(setup.headers.get("set-cookie") ?? "").toContain(AUTH_COOKIE);

		const oldFails = await req("POST", "/api/auth/login", {
			body: { username: TEST_USERNAME, password: TEST_PASSWORD },
			authed: false,
		});
		expect(oldFails.status).toBe(401);

		const newWorks = await req("POST", "/api/auth/login", {
			body: { username: TEST_USERNAME, password: NEW_PASSWORD },
			authed: false,
		});
		expect(newWorks.status).toBe(200);
	});

	it("rejects token reuse after a successful setup", async () => {
		await req("POST", "/api/auth/forgot", { body: { username: TEST_USERNAME }, authed: false });
		const token = extractTokenFromLastMessage();

		const first = await req("POST", "/api/auth/setup", {
			body: { token, password: NEW_PASSWORD },
			authed: false,
		});
		expect(first.status).toBe(200);

		const replay = await req("POST", "/api/auth/setup", {
			body: { token, password: "another-new-pw" },
			authed: false,
		});
		expect(replay.status).toBe(401);
	});

	it("rejects an expired token and cleans up the row", async () => {
		await req("POST", "/api/auth/forgot", { body: { username: TEST_USERNAME }, authed: false });
		const token = extractTokenFromLastMessage();

		await sql`update setup_tokens set expires_at = now() - interval '1 minute'`.execute(db);

		const res = await req("POST", "/api/auth/setup", {
			body: { token, password: NEW_PASSWORD },
			authed: false,
		});
		expect(res.status).toBe(401);

		const tokens = await db.selectFrom("setupTokens").selectAll().execute();
		expect(tokens).toHaveLength(0);
	});

	it("re-issuing replaces the prior token; only the latest works", async () => {
		await req("POST", "/api/auth/forgot", { body: { username: TEST_USERNAME }, authed: false });
		const firstToken = extractTokenFromLastMessage();

		await req("POST", "/api/auth/forgot", { body: { username: TEST_USERNAME }, authed: false });
		const secondToken = extractTokenFromLastMessage();
		expect(secondToken).not.toBe(firstToken);

		const tokens = await db.selectFrom("setupTokens").selectAll().execute();
		expect(tokens).toHaveLength(1);

		const oldFails = await req("POST", "/api/auth/setup", {
			body: { token: firstToken, password: NEW_PASSWORD },
			authed: false,
		});
		expect(oldFails.status).toBe(401);

		const newWorks = await req("POST", "/api/auth/setup", {
			body: { token: secondToken, password: NEW_PASSWORD },
			authed: false,
		});
		expect(newWorks.status).toBe(200);
	});
});

describe("POST /api/auth/login (with passwordless user)", () => {
	it("rejects a passwordless user even with an empty password", async () => {
		await makePasswordlessUser("nopass", "99999");
		const res = await req("POST", "/api/auth/login", {
			body: { username: "nopass", password: "anything" },
			authed: false,
		});
		expect(res.status).toBe(401);
	});
});
