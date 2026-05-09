import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("password_reset_codes").ifExists().execute();

	await db.schema
		.createTable("setup_tokens")
		.addColumn("token_hash", "text", (c) => c.primaryKey())
		.addColumn("user_id", "text", (c) => c.notNull().references("users.id").onDelete("cascade"))
		.addColumn("expires_at", "timestamptz", (c) => c.notNull())
		.addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`current_timestamp`))
		.execute();

	await db.schema
		.createIndex("setup_tokens_user_id_idx")
		.on("setup_tokens")
		.column("user_id")
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropIndex("setup_tokens_user_id_idx").ifExists().execute();
	await db.schema.dropTable("setup_tokens").execute();

	await db.schema
		.createTable("password_reset_codes")
		.addColumn("user_id", "text", (c) => c.primaryKey().references("users.id").onDelete("cascade"))
		.addColumn("code_hash", "text", (c) => c.notNull())
		.addColumn("expires_at", "timestamptz", (c) => c.notNull())
		.addColumn("attempts", "integer", (c) => c.notNull().defaultTo(0))
		.addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`current_timestamp`))
		.execute();
}
