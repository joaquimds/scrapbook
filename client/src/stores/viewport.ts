import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";

export interface Viewport {
	scale: number;
	tx: number;
	ty: number;
	userInteracted: boolean;
}

const [viewportStore, setViewportStore] = createStore<Viewport>({
	scale: 1,
	tx: 0,
	ty: 0,
	userInteracted: false,
});

export { setViewportStore, viewportStore };

const [rasterEpoch, setRasterEpoch] = createSignal(0);
export { rasterEpoch };

export function notifyZoomEnd(): void {
	setRasterEpoch((n) => n + 1);
}

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
