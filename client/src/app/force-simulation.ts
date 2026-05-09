import {
	forceCollide,
	forceLink,
	forceManyBody,
	forceSimulation,
	type Simulation,
	type SimulationLinkDatum,
	type SimulationNodeDatum,
} from "d3-force";
import { createEffect, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { deleteNodeSize, getNodeSize } from "~/client/src/app/node-sizes.ts";
import type { GraphEdge, GraphNode } from "~/client/src/stores/graph.ts";

export interface SimNode extends SimulationNodeDatum {
	id: string;
	nodeKind: string;
}
type SimEdge = SimulationLinkDatum<SimNode>;

// Layout positions are kept in a separate store from the data. The simulation
// mutates `simNodes` in place each tick; we copy the resulting (x, y) pairs
// into the reactive `positionsStore` so components re-render.

interface Position {
	x: number;
	y: number;
}

const [positionsStore, setPositionsStore] = createStore<Record<string, Position>>({});

export { positionsStore };

let simulation: Simulation<SimNode, SimEdge> | null = null;
const simNodes = new Map<string, SimNode>();

let onTickCallback: (() => void) | null = null;

export function setOnTick(cb: (() => void) | null): void {
	onTickCallback = cb;
}

export function getSimulation(): Simulation<SimNode, SimEdge> | null {
	return simulation;
}

export function getSimNode(id: string): SimNode | undefined {
	return simNodes.get(id);
}

const RECT_FALLBACK = { w: 40, h: 40 };
const COLLIDE_PAD = 8;

// Bounding-circle radius around each node, used by forceCollide. Sized from
// the DOM-measured rectangle so wider nodes get a wider keep-out zone.
function collideRadius(id: string): number {
	const s = getNodeSize(id) ?? RECT_FALLBACK;
	return Math.max(s.w, s.h) / 2 + COLLIDE_PAD;
}

export interface ForceSimulationOpts {
	nodes: () => GraphNode[];
	edges: () => GraphEdge[];
}

export function startForceSimulation(opts: ForceSimulationOpts): void {
	createEffect(() => {
		const nodes = opts.nodes();
		const edges = opts.edges();

		// Reuse SimNode instances across renders so x/y/vx/vy carry over and
		// the layout doesn't snap on every data update.
		const nextNodes: SimNode[] = [];
		const newUnfixed: SimNode[] = [];
		for (const n of nodes) {
			let sn = simNodes.get(n.id);
			if (!sn) {
				if (n.x !== null && n.y !== null) {
					sn = {
						id: n.id,
						nodeKind: n.nodeKind,
						x: n.x,
						y: n.y,
						fx: n.x,
						fy: n.y,
					};
					simNodes.set(n.id, sn);
				} else {
					sn = { id: n.id, nodeKind: n.nodeKind };
					simNodes.set(n.id, sn);
					newUnfixed.push(sn);
				}
			} else {
				sn.nodeKind = n.nodeKind;
			}
			nextNodes.push(sn);
		}

		// Spawn new unfixed nodes near the centroid of fixed nodes (the
		// existing cluster), with a small jitter so they don't stack. Falls
		// back to viewport-centre when there are no fixed nodes yet.
		if (newUnfixed.length > 0) {
			let fx = 0;
			let fy = 0;
			let nf = 0;
			for (const sn of simNodes.values()) {
				if (sn.fx != null && sn.fy != null) {
					fx += sn.fx;
					fy += sn.fy;
					nf += 1;
				}
			}
			const tx = nf > 0 ? fx / nf : window.innerWidth / 2;
			const ty = nf > 0 ? fy / nf : window.innerHeight / 2;
			for (const sn of newUnfixed) {
				sn.x = tx + (Math.random() - 0.5) * 50;
				sn.y = ty + (Math.random() - 0.5) * 50;
			}
		}
		// Drop nodes that no longer exist
		for (const id of simNodes.keys()) {
			if (!nodes.find((n) => n.id === id)) {
				simNodes.delete(id);
				deleteNodeSize(id);
			}
		}

		const nextEdges: SimEdge[] = edges.map((e) => ({ source: e.source, target: e.target }));

		if (!simulation) {
			simulation = forceSimulation<SimNode, SimEdge>(nextNodes)
				.force(
					"link",
					forceLink<SimNode, SimEdge>(nextEdges)
						.id((d) => d.id)
						.distance((l) => {
							const s = typeof l.source === "object" ? (l.source as SimNode).id : String(l.source);
							const t = typeof l.target === "object" ? (l.target as SimNode).id : String(l.target);
							return collideRadius(s) + collideRadius(t) + 30;
						}),
				)
				.force("charge", forceManyBody().strength(-200).distanceMax(400))
				.force(
					"collide",
					forceCollide<SimNode>().radius((d) => collideRadius(d.id)),
				)
				.on("tick", flushPositions);
		} else {
			simulation.nodes(nextNodes);
			(simulation.force("link") as ReturnType<typeof forceLink<SimNode, SimEdge>>).links(nextEdges);
			simulation.alpha(0.5).restart();
		}
	});

	onCleanup(() => {
		simulation?.stop();
		simulation = null;
	});
}

function flushPositions(): void {
	setPositionsStore(
		produce((p) => {
			for (const sn of simNodes.values()) {
				p[sn.id] = { x: sn.x ?? 0, y: sn.y ?? 0 };
			}
		}),
	);
	onTickCallback?.();
}
