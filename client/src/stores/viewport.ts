import { createStore } from "solid-js/store";

export type ViewportMode = "auto" | "manual" | "drag";

export interface Viewport {
	scale: number;
	tx: number;
	ty: number;
	mode: ViewportMode;
	preDragMode: "auto" | "manual";
}

const [viewportStore, setViewportStore] = createStore<Viewport>({
	scale: 1,
	tx: 0,
	ty: 0,
	mode: "auto",
	preDragMode: "auto",
});

export { setViewportStore, viewportStore };

export function clientToWorld(clientX: number, clientY: number): { x: number; y: number } {
	return {
		x: (clientX - viewportStore.tx) / viewportStore.scale,
		y: (clientY - viewportStore.ty) / viewportStore.scale,
	};
}

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 4;

export function clampScale(s: number): number {
	return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
}
