import { createStore } from "solid-js/store";
import type { Person } from "~/shared/models/Person.ts";

interface PeopleState {
	byId: Record<string, Person>;
	ids: string[];
	cursor: string | null;
	loaded: boolean;
}

const [peopleStore, setPeopleStore] = createStore<PeopleState>({
	byId: {},
	ids: [],
	cursor: null,
	loaded: false,
});

export { peopleStore };

export function ingestPeoplePage(items: Person[], nextCursor: string | null): void {
	const newById = { ...peopleStore.byId };
	const newIds = [...peopleStore.ids];
	for (const p of items) {
		if (!(p.id in newById)) newIds.push(p.id);
		newById[p.id] = p;
	}
	setPeopleStore({
		byId: newById,
		ids: newIds,
		cursor: nextCursor,
		loaded: nextCursor === null,
	});
}
