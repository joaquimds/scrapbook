import { positionsStore } from "~/client/src/app/force-simulation.ts";
import { getNodeSize } from "~/client/src/app/node-sizes.ts";
import { graphNodes } from "~/client/src/stores/graph.ts";
import { clampScale, setViewportStore, viewportStore } from "~/client/src/stores/viewport.ts";

const FIT_PADDING = 40;
const FALLBACK_SIZE = { w: 40, h: 40 };
const LERP_FACTOR = 0.12;

function computeFitTarget(): { scale: number; tx: number; ty: number } | null {
	const nodes = graphNodes();
	if (nodes.length === 0) return null;

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

	if (!Number.isFinite(minX)) return null;

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

	return { scale, tx, ty };
}

export function fitToBounds(): void {
	const target = computeFitTarget();
	if (!target) return;
	setViewportStore(target);
}

function lerpToBounds(factor: number): void {
	const target = computeFitTarget();
	if (!target) return;
	setViewportStore({
		scale: viewportStore.scale + (target.scale - viewportStore.scale) * factor,
		tx: viewportStore.tx + (target.tx - viewportStore.tx) * factor,
		ty: viewportStore.ty + (target.ty - viewportStore.ty) * factor,
	});
}

export function maybeAutoFit(): void {
	const mode = viewportStore.mode;
	if (mode === "auto") fitToBounds();
	else if (mode === "drag") lerpToBounds(LERP_FACTOR);
}
