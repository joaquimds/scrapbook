import { positionsStore } from "~/client/src/app/force-simulation.ts";
import { getNodeSize } from "~/client/src/app/node-sizes.ts";
import type { GraphNode } from "~/client/src/stores/graph.ts";
import { clampScale, setViewportStore, viewportStore } from "~/client/src/stores/viewport.ts";

const FIT_PADDING = 40;
const FALLBACK_SIZE = { w: 40, h: 40 };

export function fitToBounds(nodes: GraphNode[]): void {
	if (nodes.length === 0) return;

	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const n of nodes) {
		const pos = positionsStore[n.id];
		if (!pos) continue;
		const size = getNodeSize(n.id) ?? FALLBACK_SIZE;
		const halfW = size.w / 2;
		const halfH = size.h / 2;
		if (pos.x - halfW < minX) minX = pos.x - halfW;
		if (pos.y - halfH < minY) minY = pos.y - halfH;
		if (pos.x + halfW > maxX) maxX = pos.x + halfW;
		if (pos.y + halfH > maxY) maxY = pos.y + halfH;
	}

	if (!Number.isFinite(minX)) return;

	const bboxW = maxX - minX;
	const bboxH = maxY - minY;
	const vw = window.innerWidth;
	const vh = window.innerHeight;
	const availW = Math.max(1, vw - FIT_PADDING * 2);
	const availH = Math.max(1, vh - FIT_PADDING * 2);

	const scale = clampScale(Math.min(availW / bboxW, availH / bboxH, 1));
	const cx = (minX + maxX) / 2;
	const cy = (minY + maxY) / 2;
	const tx = vw / 2 - cx * scale;
	const ty = vh / 2 - cy * scale;

	setViewportStore({ scale, tx, ty });
}

export function maybeAutoFit(nodes: GraphNode[]): void {
	if (viewportStore.userInteracted) return;
	fitToBounds(nodes);
}
