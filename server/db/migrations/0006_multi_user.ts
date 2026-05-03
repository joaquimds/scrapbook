import { randomBytes, scryptSync } from "node:crypto";
import { type Kysely, sql } from "kysely";
import { customAlphabet } from "nanoid";

const newId = customAlphabet("0123456789ABCDEFGHJKMNPQRSTVWXYZabcdefghjkmnpqrstvwxyz", 16);

function hashPassword(plain: string): string {
	const salt = randomBytes(16);
	const hash = scryptSync(plain, salt, 64);
	return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

const SCOPED_TABLES = [
	"scraps",
	"people",
	"ingestion_sessions",
	"contact_log",
	"reminders_sent",
] as const;

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("users")
		.addColumn("id", "text", (c) => c.primaryKey())
		.addColumn("username", "text", (c) => c.notNull().unique())
		.addColumn("password_hash", "text", (c) => c.notNull())
		.addColumn("telegram_chat_id", "text", (c) => c.notNull().unique())
		.addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`current_timestamp`))
		.execute();

	await db.schema
		.createTable("telegram_registrations")
		.addColumn("chat_id", "text", (c) => c.primaryKey())
		.addColumn("step", "text", (c) => c.notNull())
		.addColumn("username", "text")
		.addColumn("created_at", "timestamptz", (c) => c.notNull().defaultTo(sql`current_timestamp`))
		.addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(sql`current_timestamp`))
		.execute();

	await sql`
		create trigger telegram_registrations_set_updated_at
		before update on telegram_registrations
		for each row execute function set_updated_at();
	`.execute(db);

	let needsBackfill = false;
	for (const table of SCOPED_TABLES) {
		const result = await sql<{
			count: string;
		}>`select count(*)::text as count from ${sql.ref(table)}`.execute(db);
		const count = Number(result.rows[0]?.count ?? "0");
		if (count > 0) {
			needsBackfill = true;
			break;
		}
	}

	let ownerId: string | null = null;
	if (needsBackfill) {
		const username = process.env.SEED_OWNER_USERNAME;
		const password = process.env.SEED_OWNER_PASSWORD;
		const telegramChatId =
			process.env.SEED_OWNER_TELEGRAM_CHAT_ID ?? process.env.TELEGRAM_ALLOWED_CHAT_ID;
		if (!username || !password || !telegramChatId) {
			throw new Error(
				"Multi-user migration: existing rows require backfill. Set SEED_OWNER_USERNAME, SEED_OWNER_PASSWORD, and SEED_OWNER_TELEGRAM_CHAT_ID (or legacy TELEGRAM_ALLOWED_CHAT_ID) before running.",
			);
		}
		ownerId = newId();
		await db
			.insertInto("users" as never)
			.values({
				id: ownerId,
				username,
				password_hash: hashPassword(password),
				telegram_chat_id: telegramChatId,
			} as never)
			.execute();
	}

	for (const table of SCOPED_TABLES) {
		await db.schema.alterTable(table).addColumn("user_id", "text").execute();
		if (ownerId) {
			await sql`update ${sql.ref(table)} set user_id = ${ownerId} where user_id is null`.execute(
				db,
			);
		}
		await db.schema
			.alterTable(table)
			.alterColumn("user_id", (c) => c.setNotNull())
			.execute();
		await db.schema
			.alterTable(table)
			.addForeignKeyConstraint(`${table}_user_id_fk`, ["user_id"], "users", ["id"])
			.onDelete("cascade")
			.execute();
	}

	await db.schema
		.createIndex("scraps_user_created_at_idx")
		.on("scraps")
		.columns(["user_id", "created_at", "id"])
		.execute();

	await db.schema
		.createIndex("people_user_name_idx")
		.on("people")
		.columns(["user_id", "name"])
		.execute();

	await db.schema
		.createIndex("ingestion_sessions_user_idx")
		.on("ingestion_sessions")
		.column("user_id")
		.execute();

	await db.schema.createIndex("contact_log_user_idx").on("contact_log").column("user_id").execute();

	await db.schema
		.createIndex("reminders_sent_user_idx")
		.on("reminders_sent")
		.column("user_id")
		.execute();

	// chat_id was previously a global unique key on ingestion_sessions; with
	// multi-user it has to be unique per user instead. Dropping the constraint
	// also drops the implicit index it created.
	await sql`alter table ingestion_sessions drop constraint if exists ingestion_sessions_chat_id_key`.execute(
		db,
	);
	await db.schema.dropIndex("ingestion_sessions_chat_id_key").ifExists().execute();
	await db.schema
		.createIndex("ingestion_sessions_user_chat_idx")
		.on("ingestion_sessions")
		.columns(["user_id", "chat_id"])
		.unique()
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropIndex("ingestion_sessions_user_chat_idx").ifExists().execute();
	await sql`alter table ingestion_sessions add constraint ingestion_sessions_chat_id_key unique (chat_id)`.execute(
		db,
	);
	await db.schema.dropIndex("reminders_sent_user_idx").ifExists().execute();
	await db.schema.dropIndex("contact_log_user_idx").ifExists().execute();
	await db.schema.dropIndex("ingestion_sessions_user_idx").ifExists().execute();
	await db.schema.dropIndex("people_user_name_idx").ifExists().execute();
	await db.schema.dropIndex("scraps_user_created_at_idx").ifExists().execute();
	for (const table of SCOPED_TABLES) {
		await sql`alter table ${sql.ref(table)} drop constraint if exists ${sql.ref(`${table}_user_id_fk`)}`.execute(
			db,
		);
		await db.schema.alterTable(table).dropColumn("user_id").execute();
	}
	await sql`drop trigger if exists telegram_registrations_set_updated_at on telegram_registrations`.execute(
		db,
	);
	await db.schema.dropTable("telegram_registrations").execute();
	await db.schema.dropTable("users").execute();
}
