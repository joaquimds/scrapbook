import { type Kysely, sql } from "kysely";

// Columns are written in snake_case; the CamelCasePlugin in `connection.ts`
// translates between these and the camelCase Kysely interfaces at query time.

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("scraps")
		.addColumn("id", "text", (c) => c.primaryKey())
		.addColumn("kind", "text", (c) => c.notNull())
		.addColumn("body", "text")
		.addColumn("media_path", "text")
		.addColumn("thumbnail_path", "text")
		.addColumn("source", "text", (c) => c.notNull())
		.addColumn("external_message_id", "text")
		.addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`current_timestamp`))
		.execute();

	await db.schema
		.createIndex("scraps_created_at_idx")
		.on("scraps")
		.columns(["created_at", "id"])
		.execute();

	await db.schema
		.createIndex("scraps_external_message_id_idx")
		.on("scraps")
		.column("external_message_id")
		.execute();

	await db.schema
		.createTable("people")
		.addColumn("id", "text", (c) => c.primaryKey())
		.addColumn("name", "text", (c) => c.notNull())
		.addColumn("featured_scrap_id", "text", (c) => c.references("scraps.id").onDelete("set null"))
		.addColumn("last_contacted_at", "timestamptz")
		.addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`current_timestamp`))
		.execute();

	await db.schema
		.createTable("scrap_people")
		.addColumn("scrap_id", "text", (c) => c.notNull().references("scraps.id").onDelete("cascade"))
		.addColumn("person_id", "text", (c) => c.notNull().references("people.id").onDelete("cascade"))
		.addPrimaryKeyConstraint("scrap_people_pk", ["scrap_id", "person_id"])
		.execute();

	await db.schema
		.createIndex("scrap_people_person_idx")
		.on("scrap_people")
		.column("person_id")
		.execute();

	await db.schema
		.createTable("ingestion_sessions")
		.addColumn("id", "text", (c) => c.primaryKey())
		.addColumn("chat_id", "text", (c) => c.notNull().unique())
		.addColumn("state", "text", (c) => c.notNull())
		.addColumn("pending_scrap_ids", "jsonb", (c) => c.notNull().defaultTo(sql`'[]'::jsonb`))
		.addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`current_timestamp`))
		.addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(sql`current_timestamp`))
		.execute();

	// Postgres default `current_timestamp` only fires on INSERT — a trigger
	// is required to keep `updated_at` honest on UPDATE so the column can be
	// typed as GeneratedAlways<Date>.
	await sql`
		create or replace function set_updated_at()
		returns trigger as $$
		begin
			new.updated_at = current_timestamp;
			return new;
		end;
		$$ language plpgsql;
	`.execute(db);

	await sql`
		create trigger ingestion_sessions_set_updated_at
		before update on ingestion_sessions
		for each row execute function set_updated_at();
	`.execute(db);

	await db.schema
		.createTable("contact_log")
		.addColumn("id", "text", (c) => c.primaryKey())
		.addColumn("person_id", "text", (c) => c.notNull().references("people.id").onDelete("cascade"))
		.addColumn("contacted_at", "timestamptz", (c) => c.notNull().defaultTo(sql`current_timestamp`))
		.addColumn("note", "text")
		.execute();

	await db.schema
		.createTable("reminders_sent")
		.addColumn("id", "text", (c) => c.primaryKey())
		.addColumn("person_id", "text", (c) => c.notNull().references("people.id").onDelete("cascade"))
		.addColumn("scrap_id", "text", (c) => c.references("scraps.id").onDelete("set null"))
		.addColumn("sent_at", "timestamptz", (c) => c.notNull().defaultTo(sql`current_timestamp`))
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("reminders_sent").execute();
	await db.schema.dropTable("contact_log").execute();
	await db.schema.dropTable("ingestion_sessions").execute();
	await db.schema.dropTable("scrap_people").execute();
	await db.schema.dropTable("people").execute();
	await db.schema.dropTable("scraps").execute();
	await sql`drop function if exists set_updated_at();`.execute(db);
}
