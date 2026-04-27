import type { GeneratedAlways } from "kysely";
import type { ContactLog } from "~/shared/models/ContactLog.ts";
import type { IngestionSession } from "~/shared/models/IngestionSession.ts";
import type { Person } from "~/shared/models/Person.ts";
import type { Scrap } from "~/shared/models/Scrap.ts";

// Kysely table types reuse the Zod models. Property names are camelCase to
// match the models; the CamelCasePlugin maps them to snake_case columns at
// query time. Auto-generated timestamp columns default to `current_timestamp`
// in Postgres and are typed `GeneratedAlways<Date>` so callers cannot insert
// or update them. `peopleIds` is a denormalised join, added at the repository
// layer.

export type ScrapsTable = Omit<Scrap, "createdAt" | "peopleIds"> & {
	createdAt: GeneratedAlways<Date>;
};

export type PeopleTable = Omit<Person, "createdAt"> & {
	createdAt: GeneratedAlways<Date>;
};

export interface ScrapPeopleTable {
	scrapId: string;
	personId: string;
}

export type IngestionSessionsTable = Omit<IngestionSession, "createdAt" | "updatedAt"> & {
	createdAt: GeneratedAlways<Date>;
	updatedAt: GeneratedAlways<Date>;
};

export type ContactLogTable = Omit<ContactLog, "contactedAt"> & {
	contactedAt: GeneratedAlways<Date>;
};

export interface RemindersSentTable {
	id: string;
	personId: string;
	scrapId: string | null;
	sentAt: GeneratedAlways<Date>;
}

export interface Database {
	scraps: ScrapsTable;
	people: PeopleTable;
	scrapPeople: ScrapPeopleTable;
	ingestionSessions: IngestionSessionsTable;
	contactLog: ContactLogTable;
	remindersSent: RemindersSentTable;
}
