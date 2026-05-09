import type { GeneratedAlways } from "kysely";
import type { ContactLog } from "~/shared/models/ContactLog.ts";
import type { IngestionSession } from "~/shared/models/IngestionSession.ts";
import type { Person } from "~/shared/models/Person.ts";
import type { Scrap } from "~/shared/models/Scrap.ts";
import type { User } from "~/shared/models/User.ts";

// Kysely table types reuse the Zod models. Property names are camelCase to
// match the models; the CamelCasePlugin maps them to snake_case columns at
// query time. Auto-generated timestamp columns default to `current_timestamp`
// in Postgres and are typed `GeneratedAlways<string>` so callers cannot insert
// or update them. `peopleIds` is a denormalised join, added at the repository
// layer.

export type UsersTable = Omit<User, "createdAt"> & {
	passwordHash: string | null;
	createdAt: GeneratedAlways<string>;
};

export interface SetupTokensTable {
	tokenHash: string;
	userId: string;
	expiresAt: string;
	createdAt: GeneratedAlways<string>;
}

export interface TelegramRegistrationsTable {
	chatId: string;
	step: "awaiting_invite_code" | "awaiting_username";
	username: string | null;
	createdAt: GeneratedAlways<string>;
	updatedAt: GeneratedAlways<string>;
}

export type ScrapsTable = Omit<Scrap, "createdAt" | "peopleIds" | "thumbnailUrl"> & {
	userId: string;
	createdAt: GeneratedAlways<string>;
};

export type PeopleTable = Omit<Person, "createdAt"> & {
	userId: string;
	createdAt: GeneratedAlways<string>;
};

export interface ScrapPeopleTable {
	scrapId: string;
	personId: string;
}

export type IngestionSessionsTable = Omit<IngestionSession, "createdAt" | "updatedAt"> & {
	userId: string;
	createdAt: GeneratedAlways<string>;
	updatedAt: GeneratedAlways<string>;
};

export type ContactLogTable = Omit<ContactLog, "contactedAt"> & {
	userId: string;
	contactedAt: GeneratedAlways<string>;
};

export interface RemindersSentTable {
	id: string;
	userId: string;
	personId: string;
	scrapId: string | null;
	sentAt: GeneratedAlways<string>;
}

export interface Database {
	users: UsersTable;
	setupTokens: SetupTokensTable;
	telegramRegistrations: TelegramRegistrationsTable;
	scraps: ScrapsTable;
	people: PeopleTable;
	scrapPeople: ScrapPeopleTable;
	ingestionSessions: IngestionSessionsTable;
	contactLog: ContactLogTable;
	remindersSent: RemindersSentTable;
}
