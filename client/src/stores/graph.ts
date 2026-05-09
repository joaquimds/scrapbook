import { createMemo, createRoot } from "solid-js";
import { peopleStore } from "~/client/src/stores/people.ts";
import { scrapsStore } from "~/client/src/stores/scraps.ts";

export interface GraphNode {
	id: string;
	nodeKind: string;
	x: number | null;
	y: number | null;
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
// appear as standalone scrap nodes (or contribute edges). The memos live
// inside a single createRoot so they have a long-lived reactive owner.
export const { graphNodes, graphEdges } = createRoot(() => {
	const featuredScrapIds = createMemo(() => {
		const ids = new Set<string>();
		for (const pid of peopleStore.ids) {
			const fid = peopleStore.byId[pid]?.featuredScrapId;
			if (fid) ids.add(fid);
		}
		return ids;
	});

	const graphNodes = createMemo<GraphNode[]>(() => {
		const featured = featuredScrapIds();
		const out: GraphNode[] = [];
		for (const id of scrapsStore.ids) {
			if (featured.has(id)) continue;
			const s = scrapsStore.byId[id];
			if (!s) continue;
			out.push({ id, nodeKind: "scrap", x: s.x, y: s.y });
		}
		for (const id of peopleStore.ids) {
			const p = peopleStore.byId[id];
			if (!p) continue;
			out.push({ id, nodeKind: "person", x: p.x, y: p.y });
		}
		return out;
	});

	const graphEdges = createMemo<GraphEdge[]>(() => {
		const featured = featuredScrapIds();
		const out: GraphEdge[] = [];
		for (const sid of scrapsStore.ids) {
			if (featured.has(sid)) continue;
			const scrap = scrapsStore.byId[sid];
			if (!scrap) continue;
			for (const pid of scrap.peopleIds) {
				if (!peopleStore.byId[pid]) continue;
				out.push({ id: `${sid}::${pid}`, source: sid, target: pid });
			}
		}
		return out;
	});

	return { graphNodes, graphEdges };
});
