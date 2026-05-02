import { getSimNode } from "~/client/src/app/force-simulation.ts";
import { getNodeSize } from "~/client/src/app/node-sizes.ts";
import { clampScale, setViewportStore, viewportStore } from "~/client/src/stores/viewport.ts";

const EDGE_MARGIN = 80;
const PAN_GAIN = 0.15;
const MAX_PAN_PER_FRAME = 30;
const ZOOM_GAIN = 0.005;
const FALLBACK_SIZE = { w: 40, h: 40 };

let activeId: string | null = null;
let applyDrag: (() => void) | null = null;
let rafHandle: number | null = null;

export function startEdgePan(id: string, apply: () => void): void {
	activeId = id;
	applyDrag = apply;
	if (rafHandle == null) {
		rafHandle = requestAnimationFrame(tick);
	}
}

export function stopEdgePan(): void {
	activeId = null;
	applyDrag = null;
	if (rafHandle != null) {
		cancelAnimationFrame(rafHandle);
		rafHandle = null;
	}
}

function tick(): void {
	rafHandle = null;
	if (!activeId || !applyDrag) return;

	const sn = getSimNode(activeId);
	const size = getNodeSize(activeId) ?? FALLBACK_SIZE;
	if (sn && sn.x != null && sn.y != null) {
		const { scale, tx, ty } = viewportStore;
		const halfW = (size.w * scale) / 2;
		const halfH = (size.h * scale) / 2;
		const screenX = sn.x * scale + tx;
		const screenY = sn.y * scale + ty;
		const left = screenX - halfW;
		const right = screenX + halfW;
		const top = screenY - halfH;
		const bottom = screenY + halfH;

		const vw = window.innerWidth;
		const vh = window.innerHeight;

		const penLeft = Math.max(0, EDGE_MARGIN - left);
		const penRight = Math.max(0, right - (vw - EDGE_MARGIN));
		const penTop = Math.max(0, EDGE_MARGIN - top);
		const penBottom = Math.max(0, bottom - (vh - EDGE_MARGIN));

		if (penLeft > 0 || penRight > 0 || penTop > 0 || penBottom > 0) {
			let dx = 0;
			let dy = 0;
			if (penLeft > 0) dx += clamp(penLeft * PAN_GAIN, 0, MAX_PAN_PER_FRAME);
			if (penRight > 0) dx -= clamp(penRight * PAN_GAIN, 0, MAX_PAN_PER_FRAME);
			if (penTop > 0) dy += clamp(penTop * PAN_GAIN, 0, MAX_PAN_PER_FRAME);
			if (penBottom > 0) dy -= clamp(penBottom * PAN_GAIN, 0, MAX_PAN_PER_FRAME);

			let nextTx = tx + dx;
			let nextTy = ty + dy;
			let nextScale = scale;

			const maxPen = Math.max(penLeft, penRight, penTop, penBottom);
			const normalized = Math.min(1, maxPen / EDGE_MARGIN);
			const zoomFactor = 1 - ZOOM_GAIN * normalized;
			const zoomed = clampScale(scale * zoomFactor);
			if (zoomed !== scale) {
				// Anchor zoom around the edge opposite the deepest penetration so
				// the dragged node's screen position stays stable while more world
				// is revealed behind it.
				let anchorX = vw / 2;
				let anchorY = vh / 2;
				if (penRight >= penLeft && penRight > 0) anchorX = 0;
				else if (penLeft > 0) anchorX = vw;
				if (penBottom >= penTop && penBottom > 0) anchorY = 0;
				else if (penTop > 0) anchorY = vh;

				const worldAX = (anchorX - nextTx) / scale;
				const worldAY = (anchorY - nextTy) / scale;
				nextTx = anchorX - worldAX * zoomed;
				nextTy = anchorY - worldAY * zoomed;
				nextScale = zoomed;
			}

			if (nextTx !== tx || nextTy !== ty || nextScale !== scale) {
				setViewportStore({ tx: nextTx, ty: nextTy, scale: nextScale });
				applyDrag();
			}
		}
	}

	if (activeId) {
		rafHandle = requestAnimationFrame(tick);
	}
}

function clamp(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, v));
}
