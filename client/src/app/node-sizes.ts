import { getSimulation } from "./force-simulation";

interface Size {
	w: number;
	h: number;
}

const sizes: Record<string, Size> = {};

export function getNodeSize(id: string): Size | undefined {
	return sizes[id];
}

export function setNodeSize(id: string, w: number, h: number): void {
	const prev = sizes[id];
	if (prev && prev.w === w && prev.h === h) return;
	sizes[id] = { w, h };
	const sim = getSimulation();
	if (!sim) return;
	// forceCollide caches radii at initialize() time, so re-pass the node
	// list to make it pick up the new size.
	sim.nodes(sim.nodes());
	sim.alpha(0.3).restart();
}

export function deleteNodeSize(id: string): void {
	delete sizes[id];
}
