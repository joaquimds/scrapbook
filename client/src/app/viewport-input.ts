import { clampScale, setViewportStore, viewportStore } from "~/client/src/stores/viewport.ts";

interface PointerState {
	clientX: number;
	clientY: number;
}

const pointers = new Map<number, PointerState>();
let pinchPrevDist: number | null = null;
let pinchPrevMid: { x: number; y: number } | null = null;

function markInteracted(): void {
	if (viewportStore.mode !== "manual") setViewportStore({ mode: "manual", preDragMode: "manual" });
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

export function onCanvasPointerDown(e: PointerEvent): void {
	if (e.button !== 0 && e.pointerType === "mouse") return;
	(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	pointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
	pinchPrevDist = null;
	pinchPrevMid = null;
}

export function onCanvasPointerMove(e: PointerEvent): void {
	const prev = pointers.get(e.pointerId);
	if (!prev) return;
	pointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

	if (pointers.size === 1) {
		const dx = e.clientX - prev.clientX;
		const dy = e.clientY - prev.clientY;
		if (dx === 0 && dy === 0) return;
		markInteracted();
		setViewportStore({
			tx: viewportStore.tx + dx,
			ty: viewportStore.ty + dy,
		});
		return;
	}

	if (pointers.size === 2) {
		const [a, b] = Array.from(pointers.values());
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
			if (pinchPrevDist > 0 && dist > 0) {
				zoomAround(mid.x, mid.y, dist / pinchPrevDist);
			}
		}
		pinchPrevDist = dist;
		pinchPrevMid = mid;
	}
}

export function onCanvasPointerUp(e: PointerEvent): void {
	const target = e.currentTarget as HTMLElement;
	if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
	pointers.delete(e.pointerId);
	if (pointers.size < 2) {
		pinchPrevDist = null;
		pinchPrevMid = null;
	}
}

export function onCanvasWheel(e: WheelEvent): void {
	e.preventDefault();
	markInteracted();
	const factor = Math.exp(-e.deltaY * 0.0015);
	zoomAround(e.clientX, e.clientY, factor);
}
