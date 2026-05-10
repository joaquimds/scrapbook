import type { Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("scraps").dropColumn("kind").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("scraps")
		.addColumn("kind", "text", (c) => c.notNull().defaultTo("quote"))
		.execute();
	await db.schema
		.alterTable("scraps")
		.alterColumn("kind", (c) => c.dropDefault())
		.execute();
}
