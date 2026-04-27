import type { Person } from "~/shared/models/Person.ts";
import type { Scrap } from "~/shared/models/Scrap.ts";

export interface Page<T> {
	items: T[];
	nextCursor: string | null;
}

async function getJson<T>(url: string): Promise<T> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url}: ${res.status}`);
	return (await res.json()) as T;
}

export const fetchScrapsPage = (cursor: string | null, limit = 200) =>
	getJson<Page<Scrap>>(`/api/scraps?limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`);

export const fetchPeoplePage = (cursor: string | null, limit = 200) =>
	getJson<Page<Person>>(`/api/people?limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`);

export async function createScrap(input: {
	kind?: Scrap["kind"];
	body: string;
	peopleIds?: string[];
}): Promise<Scrap> {
	const res = await fetch("/api/scraps", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) throw new Error(`POST /api/scraps: ${res.status}`);
	return (await res.json()) as Scrap;
}
