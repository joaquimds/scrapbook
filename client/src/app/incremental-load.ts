import { fetchPeoplePage, fetchScrapsPage } from "~/client/src/api/services.ts";
import { ingestPeoplePage } from "~/client/src/stores/people.ts";
import { ingestScrapsPage } from "~/client/src/stores/scraps.ts";

// Idle-scheduled paginated fetch. Both scraps and people are loaded in
// parallel; each page is queued via requestIdleCallback so we don't block
// the main thread or starve the force simulation that's running alongside.

const idle = (cb: () => void): void => {
	const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => void })
		.requestIdleCallback;
	if (ric) ric(cb);
	else setTimeout(cb, 0);
};

async function loadAllScraps(): Promise<void> {
	let cursor: string | null = null;
	do {
		const page = await fetchScrapsPage(cursor);
		ingestScrapsPage(page.items, page.nextCursor);
		cursor = page.nextCursor;
		if (cursor) await new Promise<void>((r) => idle(r));
	} while (cursor);
}

async function loadAllPeople(): Promise<void> {
	let cursor: string | null = null;
	do {
		const page = await fetchPeoplePage(cursor);
		ingestPeoplePage(page.items, page.nextCursor);
		cursor = page.nextCursor;
		if (cursor) await new Promise<void>((r) => idle(r));
	} while (cursor);
}

export function startIncrementalLoad(): void {
	loadAllScraps().catch((e) => {
		console.error("scraps load failed", e);
	});
	loadAllPeople().catch((e) => {
		console.error("people load failed", e);
	});
}
