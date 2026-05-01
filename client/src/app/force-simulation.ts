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

interface SimNode extends SimulationNodeDatum {
	id: string;
	nodeKind: "scrap" | "person";
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
const RING_MARGIN = 80;

function ringRadius(): number {
	return Math.max(100, Math.min(window.innerWidth, window.innerHeight) / 2 - RING_MARGIN);
}

// Clamps scrap nodes to remain inside the person ring. Person nodes are
// pinned via fx/fy so this force only nudges scraps.
function ringClamp() {
	let nodes: SimNode[] = [];
	const force = () => {
		const cx = window.innerWidth / 2;
		const cy = window.innerHeight / 2;
		const r = ringRadius();
		for (const n of nodes) {
			if (n.nodeKind !== "scrap") continue;
			const dx = (n.x ?? 0) - cx;
			const dy = (n.y ?? 0) - cy;
			const dist = Math.hypot(dx, dy);
			if (dist > r && dist > 0) {
				const k = r / dist;
				n.x = cx + dx * k;
				n.y = cy + dy * k;
				if (n.vx !== undefined) n.vx *= 0.5;
				if (n.vy !== undefined) n.vy *= 0.5;
			}
		}
	};
	force.initialize = (n: SimNode[]) => {
		nodes = n;
	};
	return force;
}

function pinPeopleToRing(nodes: SimNode[]): void {
	const cx = window.innerWidth / 2;
	const cy = window.innerHeight / 2;
	const r = ringRadius();
	const people = nodes.filter((n) => n.nodeKind === "person");
	const count = people.length;
	if (count === 0) return;
	// Sort by id for stable angular order across renders.
	people.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	for (let i = 0; i < count; i++) {
		const p = people[i];
		if (!p) continue;
		const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
		p.fx = cx + Math.cos(angle) * r;
		p.fy = cy + Math.sin(angle) * r;
		p.x = p.fx;
		p.y = p.fy;
	}
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
		for (const n of nodes) {
			let sn = simNodes.get(n.id);
			if (!sn) {
				sn = { id: n.id, nodeKind: n.nodeKind };
				simNodes.set(n.id, sn);
			} else {
				sn.nodeKind = n.nodeKind;
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

		pinPeopleToRing(nextNodes);

		if (!simulation) {
			simulation = forceSimulation<SimNode, SimEdge>(nextNodes)
				.force(
					"link",
					forceLink<SimNode, SimEdge>(nextEdges)
						.id((d) => d.id)
						.distance(80),
				)
				.force("charge", forceManyBody().strength(-200))
				.force("collide", rectCollide())
				.force("ring", ringClamp())
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
