import { createStore } from "solid-js/store";

export interface Viewport {
	scale: number;
	tx: number;
	ty: number;
	userInteracted: boolean;
}

// Layout is rendered LAYOUT_FACTOR× oversized; the actual CSS transform on
// .viewport is scale(scale / LAYOUT_FACTOR), which always stays below 1×.
// That's what keeps Safari rastering the layer at high resolution — once the
// transform scale exceeds 1, the layer's cached bitmap upscales and images
// blur. So LAYOUT_FACTOR must be ≥ MAX_SCALE; we keep a small margin (5 vs 4)
// against browser raster-scale rounding.
export const LAYOUT_FACTOR = 5;

const [viewportStore, setViewportStore] = createStore<Viewport>({
	scale: 1,
	tx: 0,
	ty: 0,
	userInteracted: false,
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
