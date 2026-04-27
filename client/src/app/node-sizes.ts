import type { Simulation } from "d3-force";

interface Size {
	w: number;
	h: number;
}

// Permissive — node-sizes only ever calls alpha()/restart(), so it doesn't
// need to know the simulation's node/link shape.
// biome-ignore lint/suspicious/noExplicitAny: see above
type Sim = Simulation<any, any>;

const sizes: Record<string, Size> = {};

export function getNodeSize(id: string): Size | undefined {
	return sizes[id];
}

export function setNodeSize(id: string, w: number, h: number, sim: Sim | null): void {
	const prev = sizes[id];
	if (prev && prev.w === w && prev.h === h) return;
	sizes[id] = { w, h };
	sim?.alpha(0.3).restart();
}

export function deleteNodeSize(id: string): void {
	delete sizes[id];
}
