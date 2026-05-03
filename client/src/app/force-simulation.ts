import {
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
import { graphEdges, graphNodes } from "~/client/src/stores/graph.ts";
import { peopleStore } from "~/client/src/stores/people.ts";
import { scrapsStore } from "~/client/src/stores/scraps.ts";

export interface SimNode extends SimulationNodeDatum {
	id: string;
	nodeKind: "scrap" | "person";
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
const RECT_PAD = 24;

// Like forceCenter, but targets the centroid of the *fixed* nodes instead of
// a hard-coded world point. A vanilla forceCenter targeting (W/2, H/2) drives
// the steady state to `mean_all = target`, which means with many fixed nodes
// clustered far from world-centre, the few unfixed nodes are pushed to the
// opposite side just to balance the mean. Anchoring the target on the fixed
// cluster makes the equilibrium for unfixed nodes the cluster itself.
function clusterCenter() {
	let nodes: SimNode[] = [];
	const force = () => {
		if (nodes.length === 0) return;
		let fx = 0;
		let fy = 0;
		let nf = 0;
		for (const node of nodes) {
			if (node.fx != null && node.fy != null) {
				fx += node.fx;
				fy += node.fy;
				nf += 1;
			}
		}
		const tx = nf > 0 ? fx / nf : window.innerWidth / 2;
		const ty = nf > 0 ? fy / nf : window.innerHeight / 2;
		let mx = 0;
		let my = 0;
		for (const node of nodes) {
			mx += node.x ?? 0;
			my += node.y ?? 0;
		}
		mx = mx / nodes.length - tx;
		my = my / nodes.length - ty;
		for (const node of nodes) {
			node.x = (node.x ?? 0) - mx;
			node.y = (node.y ?? 0) - my;
		}
	};
	force.initialize = (n: SimNode[]) => {
		nodes = n;
	};
	return force;
}

// Custom collision force: treats each node as a padded axis-aligned rectangle
// using sizes measured from the DOM (see node-sizes.ts). On each tick it
// resolves any overlapping pair along the axis of smaller penetration.
function rectCollide() {
	let nodes: SimNode[] = [];
	const force = () => {
		for (let i = 0; i < nodes.length; i++) {
			const a = nodes[i];
			if (!a) continue;
			const sa = getNodeSize(a.id) ?? RECT_FALLBACK;
			for (let j = i + 1; j < nodes.length; j++) {
				const b = nodes[j];
				if (!b) continue;
				const sb = getNodeSize(b.id) ?? RECT_FALLBACK;
				const dx = (b.x ?? 0) - (a.x ?? 0);
				const dy = (b.y ?? 0) - (a.y ?? 0);
				const minDx = (sa.w + sb.w) / 2 + RECT_PAD;
				const minDy = (sa.h + sb.h) / 2 + RECT_PAD;
				const overlapX = minDx - Math.abs(dx);
				const overlapY = minDy - Math.abs(dy);
				if (overlapX <= 0 || overlapY <= 0) continue;
				if (overlapX < overlapY) {
					const sign = dx < 0 ? -1 : 1;
					a.x = (a.x ?? 0) - (sign * overlapX) / 2;
					b.x = (b.x ?? 0) + (sign * overlapX) / 2;
				} else {
					const sign = dy < 0 ? -1 : 1;
					a.y = (a.y ?? 0) - (sign * overlapY) / 2;
					b.y = (b.y ?? 0) + (sign * overlapY) / 2;
				}
			}
		}
	};
	force.initialize = (n: SimNode[]) => {
		nodes = n;
	};
	return force;
}

export function startForceSimulation(): void {
	createEffect(() => {
		const nodes = graphNodes();
		const edges = graphEdges();

		// Reuse SimNode instances across renders so x/y/vx/vy carry over and
		// the layout doesn't snap on every data update.
		const nextNodes: SimNode[] = [];
		const newUnfixed: SimNode[] = [];
		for (const n of nodes) {
			let sn = simNodes.get(n.id);
			const persisted = n.nodeKind === "scrap" ? scrapsStore.byId[n.id] : peopleStore.byId[n.id];
			if (!sn) {
				if (persisted && persisted.x !== null && persisted.y !== null) {
					sn = {
						id: n.id,
						nodeKind: n.nodeKind,
						x: persisted.x,
						y: persisted.y,
						fx: persisted.x,
						fy: persisted.y,
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
						.distance(80),
				)
				.force("charge", forceManyBody().strength(-200).distanceMax(400))
				.force("collide", rectCollide())
				.force("center", clusterCenter())
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
