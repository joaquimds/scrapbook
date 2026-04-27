import { createStore } from "solid-js/store";
import type { Scrap } from "~/shared/models/Scrap.ts";

interface ScrapsState {
	byId: Record<string, Scrap>;
	ids: string[];
	cursor: string | null;
	loaded: boolean;
}

const [scrapsStore, setScrapsStore] = createStore<ScrapsState>({
	byId: {},
	ids: [],
	cursor: null,
	loaded: false,
});

export { scrapsStore };

export function ingestScrapsPage(items: Scrap[], nextCursor: string | null): void {
	const newById = { ...scrapsStore.byId };
	const newIds = [...scrapsStore.ids];
	for (const s of items) {
		if (!(s.id in newById)) newIds.push(s.id);
		newById[s.id] = s;
	}
	setScrapsStore({
		byId: newById,
		ids: newIds,
		cursor: nextCursor,
		loaded: nextCursor === null,
	});
}
