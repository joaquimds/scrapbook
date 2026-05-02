import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("scraps").dropColumn("media_path").execute();
	await db.schema.alterTable("scraps").dropColumn("thumbnail_path").execute();
	await db.schema.alterTable("scraps").addColumn("media_url", "text").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("scraps").dropColumn("media_url").execute();
	await db.schema.alterTable("scraps").addColumn("media_path", "text").execute();
	await db.schema.alterTable("scraps").addColumn("thumbnail_path", "text").execute();
}
