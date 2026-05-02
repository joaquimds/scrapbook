import { setUnauthed } from "~/client/src/stores/auth.ts";
import type { Person } from "~/shared/models/Person.ts";
import type { Scrap } from "~/shared/models/Scrap.ts";

export interface Page<T> {
	items: T[];
	nextCursor: string | null;
}

async function getJson<T>(url: string): Promise<T> {
	const res = await fetch(url, { credentials: "include" });
	if (res.status === 401) {
		setUnauthed();
		throw new Error(`${url}: 401`);
	}
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
		credentials: "include",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(input),
	});
	if (res.status === 401) {
		setUnauthed();
		throw new Error("POST /api/scraps: 401");
	}
	if (!res.ok) throw new Error(`POST /api/scraps: ${res.status}`);
	return (await res.json()) as Scrap;
}

async function patchPosition(path: string, x: number, y: number): Promise<void> {
	const res = await fetch(path, {
		method: "PATCH",
		credentials: "include",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ x, y }),
	});
	if (res.status === 401) {
		setUnauthed();
		throw new Error(`PATCH ${path}: 401`);
	}
	if (!res.ok) throw new Error(`PATCH ${path}: ${res.status}`);
}

export const updateScrapPosition = (id: string, x: number, y: number) =>
	patchPosition(`/api/scraps/${id}/position`, x, y);

export const updatePersonPosition = (id: string, x: number, y: number) =>
	patchPosition(`/api/people/${id}/position`, x, y);
