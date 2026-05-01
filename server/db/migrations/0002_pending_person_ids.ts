import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("ingestion_sessions")
		.addColumn("pending_person_ids", "jsonb", (c) => c.notNull().defaultTo(sql`'[]'::jsonb`))
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("ingestion_sessions").dropColumn("pending_person_ids").execute();
}
