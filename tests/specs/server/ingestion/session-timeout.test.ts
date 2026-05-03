import { sql } from "kysely";
import { describe, expect, it } from "vitest";
import { db } from "~/server/db/connection.ts";
import { upsertSession } from "~/server/repositories/ingestion-sessions.ts";
import { createScrap } from "~/server/repositories/scraps.ts";
import { webhook } from "~/tests/harness/app.ts";
import { TEST_TELEGRAM_CHAT_ID, TEST_USER_ID } from "~/tests/harness/db.ts";
import { textUpdate } from "~/tests/harness/fixtures.ts";

const CHAT_ID = TEST_TELEGRAM_CHAT_ID;

describe("Session timeout (24h expiry)", () => {
	it("treats expired session as if no session exists", async () => {
		const scrap = await createScrap(TEST_USER_ID, { kind: "quote", body: "old", source: "manual" });
		await upsertSession({
			userId: TEST_USER_ID,
			chatId: CHAT_ID,
			state: "awaitingFriends",
			pendingScrapIds: [scrap.id],
		});

		// The set_updated_at BEFORE UPDATE trigger would clobber a manual
		// updated_at shift, so disable it for this statement.
		await sql`alter table ingestion_sessions disable trigger ingestion_sessions_set_updated_at`.execute(
			db,
		);
		await sql`update ingestion_sessions set updated_at = updated_at - interval '25 hours' where chat_id = ${CHAT_ID}`.execute(
			db,
		);
		await sql`alter table ingestion_sessions enable trigger ingestion_sessions_set_updated_at`.execute(
			db,
		);

		// Send a new text — should be treated as fresh (no session) → creates new scrap
		await webhook(textUpdate("brand new quote"));

		// Old session should be gone, new scrap created
		const sessions = await db.selectFrom("ingestionSessions").selectAll().execute();
		// A new session is created for the new quote
		expect(sessions).toHaveLength(1);
		expect(sessions[0]?.state).toBe("awaitingFriends");

		const scraps = await db.selectFrom("scraps").selectAll().execute();
		// Original scrap (from setup) + new scrap
		expect(scraps).toHaveLength(2);
	});
});
