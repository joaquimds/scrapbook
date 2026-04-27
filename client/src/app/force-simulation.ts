import {
	forceCenter,
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

interface SimNode extends SimulationNodeDatum {
	id: string;
}
type SimEdge = SimulationLinkDatum<SimNode>;

// Layout positions are kept in a separate store from the data. The simulation
// mutates `simNodes` in place each tick; we copy the resulting (x, y) pairs
// into the reactive `positions` store so components re-render.

interface Position {
	x: number;
	y: number;
}

const [positions, setPositions] = createStore<Record<string, Position>>({});

export { positions };

let simulation: Simulation<SimNode, SimEdge> | null = null;
const simNodes = new Map<string, SimNode>();

export function getSimulation(): Simulation<SimNode, SimEdge> | null {
	return simulation;
}

const RECT_FALLBACK = { w: 40, h: 40 };
const RECT_PAD = 24;

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
		for (const n of nodes) {
			let sn = simNodes.get(n.id);
			if (!sn) {
				sn = { id: n.id };
				simNodes.set(n.id, sn);
			}
			nextNodes.push(sn);
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
				.force("charge", forceManyBody().strength(-200))
				.force("center", forceCenter(window.innerWidth / 2, window.innerHeight / 2))
				.force("collide", rectCollide())
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
	setPositions(
		produce((p) => {
			for (const sn of simNodes.values()) {
				p[sn.id] = { x: sn.x ?? 0, y: sn.y ?? 0 };
			}
		}),
	);
}
