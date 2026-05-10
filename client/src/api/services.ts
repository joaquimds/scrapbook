import { hc } from "hono/client";
import { setUnauthed } from "~/client/src/stores/auth.ts";
import type { Person } from "~/shared/models/Person.ts";
import type { Scrap } from "~/shared/models/Scrap.ts";
import type { AppType } from "~/shared/types.d.ts";

export const api = hc<AppType>("/", {
	init: { credentials: "include" },
});

function handleErr(label: string, res: { status: number }): never {
	if (res.status === 401) setUnauthed();
	throw new Error(`${label}: ${res.status}`);
}

export const fetchScrapsPage = async (cursor: string | null, limit = 200) => {
	const res = await api.api.scraps.$get({
		query: { limit: String(limit), ...(cursor ? { cursor } : {}) },
	});
	if (!res.ok) handleErr("GET /api/scraps", res);
	return res.json();
};

export const fetchPeoplePage = async (cursor: string | null, limit = 200) => {
	const res = await api.api.people.$get({
		query: { limit: String(limit), ...(cursor ? { cursor } : {}) },
	});
	if (!res.ok) handleErr("GET /api/people", res);
	return res.json();
};

export async function createScrap(input: { body: string; peopleIds?: string[] }) {
	const res = await api.api.scraps.$post({ json: input });
	if (!res.ok) handleErr("POST /api/scraps", res);
	return res.json();
}

export async function updateScrap(
	id: string,
	patch: {
		body?: string | null;
		peopleIds?: string[];
	},
): Promise<Scrap> {
	const res = await api.api.scraps[":id"].$patch({ param: { id }, json: patch });
	if (!res.ok) handleErr(`PATCH /api/scraps/${id}`, res);
	return (await res.json()) as Scrap;
}

export async function deleteScrap(id: string): Promise<void> {
	const res = await api.api.scraps[":id"].$delete({ param: { id } });
	if (!res.ok) handleErr(`DELETE /api/scraps/${id}`, res);
}

export async function uploadScrapMedia(id: string, file: File): Promise<Scrap> {
	const fd = new FormData();
	fd.append("file", file);
	const res = await fetch(`/api/scraps/${encodeURIComponent(id)}/media`, {
		method: "POST",
		credentials: "include",
		body: fd,
	});
	if (!res.ok) handleErr(`POST /api/scraps/${id}/media`, res);
	return (await res.json()) as Scrap;
}

export async function createPerson(name: string): Promise<Person> {
	const res = await api.api.people.$post({ json: { name } });
	if (!res.ok) handleErr("POST /api/people", res);
	return (await res.json()) as Person;
}

export async function updatePerson(
	id: string,
	patch: { name?: string; featuredScrapId?: string | null },
): Promise<Person> {
	const res = await api.api.people[":id"].$patch({ param: { id }, json: patch });
	if (!res.ok) handleErr(`PATCH /api/people/${id}`, res);
	return (await res.json()) as Person;
}

export async function deletePerson(id: string): Promise<{ deletedScrapIds: string[] }> {
	const res = await api.api.people[":id"].$delete({ param: { id } });
	if (!res.ok) handleErr(`DELETE /api/people/${id}`, res);
	const data = (await res.json()) as { ok: true; deletedScrapIds: string[] };
	return { deletedScrapIds: data.deletedScrapIds };
}

export const updateScrapPosition = async (id: string, x: number, y: number): Promise<void> => {
	const res = await api.api.scraps[":id"].position.$patch({
		param: { id },
		json: { x, y },
	});
	if (!res.ok) handleErr(`PATCH /api/scraps/${id}/position`, res);
};

export const updatePersonPosition = async (id: string, x: number, y: number): Promise<void> => {
	const res = await api.api.people[":id"].position.$patch({
		param: { id },
		json: { x, y },
	});
	if (!res.ok) handleErr(`PATCH /api/people/${id}/position`, res);
};
