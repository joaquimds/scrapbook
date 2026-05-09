import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("users")
		.alterColumn("password_hash", (c) => c.dropNotNull())
		.execute();

	await db.schema
		.createTable("password_reset_codes")
		.addColumn("user_id", "text", (c) => c.primaryKey().references("users.id").onDelete("cascade"))
		.addColumn("code_hash", "text", (c) => c.notNull())
		.addColumn("expires_at", "timestamptz", (c) => c.notNull())
		.addColumn("attempts", "integer", (c) => c.notNull().defaultTo(0))
		.addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`current_timestamp`))
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("password_reset_codes").execute();
	await db.schema
		.alterTable("users")
		.alterColumn("password_hash", (c) => c.setNotNull())
		.execute();
}
