import { sql } from "kysely";
import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { AUTH_COOKIE } from "~/server/middleware/require-auth.ts";
import { createUser } from "~/server/repositories/users.ts";
import { req } from "~/tests/harness/app.ts";
import { TEST_PASSWORD, TEST_USERNAME } from "~/tests/harness/db.ts";
import { lastSentMessage, sentMessages } from "~/tests/harness/telegram.ts";

async function makePasswordlessUser(username: string, chatId: string) {
	return await createUser({ username, telegramChatId: chatId });
}

function extractCodeFromLastMessage(): string {
	const match = lastSentMessage()?.text.match(/(\d{6})/);
	if (!match?.[1]) throw new Error("no 6-digit code in last sent message");
	return match[1];
}

describe("POST /api/auth/lookup", () => {
	it("reports passwordSet=true for an existing user with a password", async () => {
		const res = await req("POST", "/api/auth/lookup", {
			body: { username: TEST_USERNAME },
			authed: false,
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ passwordSet: true });
	});

	it("reports passwordSet=false and sends an OTP for a passwordless user", async () => {
		await makePasswordlessUser("freshie", "55555");
		const res = await req("POST", "/api/auth/lookup", {
			body: { username: "freshie" },
			authed: false,
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ passwordSet: false });
		const msg = lastSentMessage();
		expect(msg?.chatId).toBe("55555");
		expect(msg?.text).toMatch(/code is \d{6}/);
		const codes = await db.selectFrom("passwordResetCodes").selectAll().execute();
		expect(codes).toHaveLength(1);
	});

	it("reports passwordSet=false for an unknown username without sending a code", async () => {
		const res = await req("POST", "/api/auth/lookup", {
			body: { username: "nobody" },
			authed: false,
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ passwordSet: false });
		const codes = await db.selectFrom("passwordResetCodes").selectAll().execute();
		expect(codes).toHaveLength(0);
	});
});

describe("POST /api/auth/forgot", () => {
	it("sends a code without touching the existing password hash", async () => {
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
		expect(lastSentMessage()?.text).toMatch(/code is \d{6}/);

		const after = await db
			.selectFrom("users")
			.select("passwordHash")
			.where("username", "=", TEST_USERNAME)
			.executeTakeFirstOrThrow();
		expect(after.passwordHash).toBe(before.passwordHash);
	});

	it("is silent for an unknown username", async () => {
		const res = await req("POST", "/api/auth/forgot", {
			body: { username: "nobody" },
			authed: false,
		});
		expect(res.status).toBe(200);
	});
});

describe("POST /api/auth/setup", () => {
	it("rejects an invalid code", async () => {
		await makePasswordlessUser("setupie", "66666");
		// Ask for a code so a row exists
		await req("POST", "/api/auth/lookup", { body: { username: "setupie" }, authed: false });
		const res = await req("POST", "/api/auth/setup", {
			body: { username: "setupie", code: "000000", newPassword: "longenough" },
			authed: false,
		});
		expect(res.status).toBe(401);
	});

	it("accepts the right code, sets a password, and signs the user in", async () => {
		const user = await makePasswordlessUser("setupok", "77777");
		await req("POST", "/api/auth/lookup", { body: { username: "setupok" }, authed: false });
		const code = lastSentMessage()?.text.match(/(\d{6})/)?.[1];
		expect(code).toBeDefined();

		const res = await req("POST", "/api/auth/setup", {
			body: { username: "setupok", code, newPassword: "longenough" },
			authed: false,
		});
		expect(res.status).toBe(200);
		const setCookie = res.headers.get("set-cookie") ?? "";
		expect(setCookie).toContain(AUTH_COOKIE);

		const after = await db
			.selectFrom("users")
			.select("passwordHash")
			.where("id", "=", user.id)
			.executeTakeFirstOrThrow();
		expect(after.passwordHash).not.toBeNull();

		const codes = await db.selectFrom("passwordResetCodes").selectAll().execute();
		expect(codes).toHaveLength(0);
	});

	it("rejects a too-short password", async () => {
		await makePasswordlessUser("shorty", "88888");
		await req("POST", "/api/auth/lookup", { body: { username: "shorty" }, authed: false });
		const code = lastSentMessage()?.text.match(/(\d{6})/)?.[1];
		const res = await req("POST", "/api/auth/setup", {
			body: { username: "shorty", code, newPassword: "short" },
			authed: false,
		});
		expect(res.status).toBe(400);
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

describe("Forgot-password flow end-to-end", () => {
	const NEW_PASSWORD = "brand-new-pw";

	it("happy path: forgot → setup with code → old password rejected, new accepted", async () => {
		// Pre-condition: test user can log in with the original password.
		const before = await req("POST", "/api/auth/login", {
			body: { username: TEST_USERNAME, password: TEST_PASSWORD },
			authed: false,
		});
		expect(before.status).toBe(200);

		await req("POST", "/api/auth/forgot", { body: { username: TEST_USERNAME }, authed: false });
		const code = extractCodeFromLastMessage();

		const setup = await req("POST", "/api/auth/setup", {
			body: { username: TEST_USERNAME, code, newPassword: NEW_PASSWORD },
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

	it("rejects code reuse after a successful setup", async () => {
		await req("POST", "/api/auth/forgot", { body: { username: TEST_USERNAME }, authed: false });
		const code = extractCodeFromLastMessage();

		const first = await req("POST", "/api/auth/setup", {
			body: { username: TEST_USERNAME, code, newPassword: NEW_PASSWORD },
			authed: false,
		});
		expect(first.status).toBe(200);

		const replay = await req("POST", "/api/auth/setup", {
			body: { username: TEST_USERNAME, code, newPassword: "another-new-pw" },
			authed: false,
		});
		expect(replay.status).toBe(401);
	});

	it("invalidates the code after the 5-attempt cap, so even the right code fails", async () => {
		await req("POST", "/api/auth/forgot", { body: { username: TEST_USERNAME }, authed: false });
		const realCode = extractCodeFromLastMessage();

		for (let i = 0; i < 5; i++) {
			const wrong = await req("POST", "/api/auth/setup", {
				body: { username: TEST_USERNAME, code: "000000", newPassword: NEW_PASSWORD },
				authed: false,
			});
			expect(wrong.status).toBe(401);
		}

		// Row should be gone.
		const codes = await db.selectFrom("passwordResetCodes").selectAll().execute();
		expect(codes).toHaveLength(0);

		const realAfterCap = await req("POST", "/api/auth/setup", {
			body: { username: TEST_USERNAME, code: realCode, newPassword: NEW_PASSWORD },
			authed: false,
		});
		expect(realAfterCap.status).toBe(401);
	});

	it("rejects an expired code", async () => {
		await req("POST", "/api/auth/forgot", { body: { username: TEST_USERNAME }, authed: false });
		const code = extractCodeFromLastMessage();

		await sql`update password_reset_codes set expires_at = now() - interval '1 minute'`.execute(db);

		const res = await req("POST", "/api/auth/setup", {
			body: { username: TEST_USERNAME, code, newPassword: NEW_PASSWORD },
			authed: false,
		});
		expect(res.status).toBe(401);

		// Expired row is cleaned up by verifyResetCode.
		const codes = await db.selectFrom("passwordResetCodes").selectAll().execute();
		expect(codes).toHaveLength(0);
	});

	it("re-issuing replaces the prior code; only the latest works", async () => {
		await req("POST", "/api/auth/forgot", { body: { username: TEST_USERNAME }, authed: false });
		const firstCode = extractCodeFromLastMessage();

		await req("POST", "/api/auth/forgot", { body: { username: TEST_USERNAME }, authed: false });
		const messages = sentMessages();
		const secondCode = messages[messages.length - 1]?.text.match(/(\d{6})/)?.[1];
		expect(secondCode).toBeDefined();
		expect(secondCode).not.toBe(firstCode);

		const codes = await db.selectFrom("passwordResetCodes").selectAll().execute();
		expect(codes).toHaveLength(1);

		const oldCodeFails = await req("POST", "/api/auth/setup", {
			body: { username: TEST_USERNAME, code: firstCode, newPassword: NEW_PASSWORD },
			authed: false,
		});
		expect(oldCodeFails.status).toBe(401);

		const newCodeWorks = await req("POST", "/api/auth/setup", {
			body: { username: TEST_USERNAME, code: secondCode, newPassword: NEW_PASSWORD },
			authed: false,
		});
		expect(newCodeWorks.status).toBe(200);
	});
});
