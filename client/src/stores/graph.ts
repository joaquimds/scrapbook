import { createMemo } from "solid-js";
import { peopleStore } from "~/client/src/stores/people.ts";
import { scrapsStore } from "~/client/src/stores/scraps.ts";

export type GraphNodeKind = "scrap" | "person";

export interface GraphNode {
	id: string;
	nodeKind: GraphNodeKind;
}

export interface GraphEdge {
	id: string;
	source: string;
	target: string;
}

// Derived view of the data stores as a graph: every scrap and person becomes
// a node; every (scrap, person) tag becomes an edge. Memoised so the force
// simulation only rebuilds when the underlying data actually changes.

// Featured scraps are rendered inline on the person node, so they should not
// appear as standalone scrap nodes (or contribute edges).
const featuredScrapIds = createMemo(() => {
	const ids = new Set<string>();
	for (const pid of peopleStore.ids) {
		const fid = peopleStore.byId[pid]?.featuredScrapId;
		if (fid) ids.add(fid);
	}
	return ids;
});

export const graphNodes = createMemo<GraphNode[]>(() => {
	const featured = featuredScrapIds();
	const scrapNodes = scrapsStore.ids
		.filter((id) => !featured.has(id))
		.map((id): GraphNode => ({ id, nodeKind: "scrap" }));
	const personNodes = peopleStore.ids.map((id): GraphNode => ({ id, nodeKind: "person" }));
	return [...scrapNodes, ...personNodes];
});

export const graphEdges = createMemo<GraphEdge[]>(() => {
	const featured = featuredScrapIds();
	const out: GraphEdge[] = [];
	for (const sid of scrapsStore.ids) {
		if (featured.has(sid)) continue;
		const scrap = scrapsStore.byId[sid];
		if (!scrap) continue;
		for (const pid of scrap.peopleIds) {
			out.push({ id: `${sid}::${pid}`, source: sid, target: pid });
		}
	}
	return out;
});
