import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("scraps").addColumn("x", "double precision").execute();
	await db.schema.alterTable("scraps").addColumn("y", "double precision").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("scraps").dropColumn("x").execute();
	await db.schema.alterTable("scraps").dropColumn("y").execute();
}
