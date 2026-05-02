import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("people").addColumn("x", "double precision").execute();
	await db.schema.alterTable("people").addColumn("y", "double precision").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("people").dropColumn("x").execute();
	await db.schema.alterTable("people").dropColumn("y").execute();
}
