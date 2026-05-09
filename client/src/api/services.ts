import { hc } from "hono/client";
import { setUnauthed } from "~/client/src/stores/auth.ts";
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

export async function createScrap(input: {
	kind?: Scrap["kind"];
	body: string;
	peopleIds?: string[];
}) {
	const res = await api.api.scraps.$post({ json: input });
	if (!res.ok) handleErr("POST /api/scraps", res);
	return res.json();
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
