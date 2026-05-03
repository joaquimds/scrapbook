import { cancelActiveDrags, isDragActive } from "~/client/src/app/node-drag.ts";
import { clampScale, setViewportStore, viewportStore } from "~/client/src/stores/viewport.ts";

interface PointerState {
	clientX: number;
	clientY: number;
	startedOnCanvas: boolean;
}

const pointers = new Map<number, PointerState>();
let pinchPrevDist: number | null = null;
let pinchPrevMid: { x: number; y: number } | null = null;
let canvasEl: HTMLElement | null = null;
let pinching = false;

function markInteracted(): void {
	if (!viewportStore.userInteracted) setViewportStore("userInteracted", true);
}

function zoomAround(clientX: number, clientY: number, factor: number): void {
	const prevScale = viewportStore.scale;
	const nextScale = clampScale(prevScale * factor);
	if (nextScale === prevScale) return;
	const worldX = (clientX - viewportStore.tx) / prevScale;
	const worldY = (clientY - viewportStore.ty) / prevScale;
	const tx = clientX - worldX * nextScale;
	const ty = clientY - worldY * nextScale;
	setViewportStore({ scale: nextScale, tx, ty });
}

function isWithinCanvas(target: EventTarget | null): boolean {
	return canvasEl != null && target instanceof Node && canvasEl.contains(target);
}

function startedOnEmptyCanvas(target: EventTarget | null): boolean {
	if (!(target instanceof Element)) return false;
	if (!canvasEl) return false;
	if (!canvasEl.contains(target)) return false;
	return target.closest(".node") == null;
}

export function isPinchActive(): boolean {
	return pinching;
}

function onPointerDown(e: PointerEvent): void {
	if (!isWithinCanvas(e.target)) return;
	if (e.pointerType === "mouse" && e.button !== 0) return;
	pointers.set(e.pointerId, {
		clientX: e.clientX,
		clientY: e.clientY,
		startedOnCanvas: startedOnEmptyCanvas(e.target),
	});
	if (pointers.size >= 2 && !pinching) {
		pinching = true;
		pinchPrevDist = null;
		pinchPrevMid = null;
		if (isDragActive()) cancelActiveDrags();
	}
}

function onPointerMove(e: PointerEvent): void {
	const prev = pointers.get(e.pointerId);
	if (!prev) return;
	pointers.set(e.pointerId, {
		clientX: e.clientX,
		clientY: e.clientY,
		startedOnCanvas: prev.startedOnCanvas,
	});

	if (pinching && pointers.size >= 2) {
		const [a, b] = Array.from(pointers.values()).slice(0, 2);
		if (!a || !b) return;
		const dx = b.clientX - a.clientX;
		const dy = b.clientY - a.clientY;
		const dist = Math.hypot(dx, dy);
		const mid = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
		if (pinchPrevDist != null && pinchPrevMid != null) {
			markInteracted();
			const panDx = mid.x - pinchPrevMid.x;
			const panDy = mid.y - pinchPrevMid.y;
			if (panDx !== 0 || panDy !== 0) {
				setViewportStore({
					tx: viewportStore.tx + panDx,
					ty: viewportStore.ty + panDy,
				});
			}
			if (pinchPrevDist > 0 && dist > 0 && dist !== pinchPrevDist) {
				zoomAround(mid.x, mid.y, dist / pinchPrevDist);
			}
		}
		pinchPrevDist = dist;
		pinchPrevMid = mid;
		return;
	}

	if (pointers.size === 1 && prev.startedOnCanvas) {
		const dx = e.clientX - prev.clientX;
		const dy = e.clientY - prev.clientY;
		if (dx === 0 && dy === 0) return;
		markInteracted();
		setViewportStore({
			tx: viewportStore.tx + dx,
			ty: viewportStore.ty + dy,
		});
	}
}

function onPointerUp(e: PointerEvent): void {
	pointers.delete(e.pointerId);
	if (pointers.size < 2) {
		pinchPrevDist = null;
		pinchPrevMid = null;
		if (pointers.size === 0) pinching = false;
	}
}

export function attachViewportInput(el: HTMLElement): () => void {
	canvasEl = el;
	window.addEventListener("pointerdown", onPointerDown, true);
	window.addEventListener("pointermove", onPointerMove, true);
	window.addEventListener("pointerup", onPointerUp, true);
	window.addEventListener("pointercancel", onPointerUp, true);
	return () => {
		window.removeEventListener("pointerdown", onPointerDown, true);
		window.removeEventListener("pointermove", onPointerMove, true);
		window.removeEventListener("pointerup", onPointerUp, true);
		window.removeEventListener("pointercancel", onPointerUp, true);
		canvasEl = null;
		pointers.clear();
		pinching = false;
		pinchPrevDist = null;
		pinchPrevMid = null;
	};
}

export function onCanvasWheel(e: WheelEvent): void {
	e.preventDefault();
	markInteracted();
	const factor = Math.exp(-e.deltaY * 0.0015);
	zoomAround(e.clientX, e.clientY, factor);
}
