import { type Component, createEffect, For, onCleanup, onMount } from "solid-js";
import { setOnTick, startForceSimulation } from "~/client/src/app/force-simulation.ts";
import { startIncrementalLoad } from "~/client/src/app/incremental-load.ts";
import { maybeAutoFit } from "~/client/src/app/viewport-fit.ts";
import {
	onCanvasPointerDown,
	onCanvasPointerMove,
	onCanvasPointerUp,
	onCanvasWheel,
} from "~/client/src/app/viewport-input.ts";
import { Edge } from "~/client/src/components/Edge.tsx";
import { PersonNode } from "~/client/src/components/PersonNode.tsx";
import { ScrapNode } from "~/client/src/components/ScrapNode.tsx";
import { graphEdges, graphNodes } from "~/client/src/stores/graph.ts";
import { rasterEpoch, viewportStore } from "~/client/src/stores/viewport.ts";

export const Canvas: Component = () => {
	let rootEl: HTMLDivElement | undefined;

	// Force the compositor to re-rasterize .viewport after a zoom gesture ends.
	// .viewport has transform: scale(s); Chrome rasterizes its layer at layout
	// (1×) size and GPU-upscales, so high-res images stay blurry when zoomed in
	// until something invalidates the layer's raster scale. Window resize does
	// it; we mimic that by alternating .canvas-root's height by 1px on each
	// zoom-end. Must be a *persistent* change — restoring the original height
	// in the same frame (or even seconds later) is unreliable, the compositor
	// reads the current bounding box at composite time.
	createEffect(() => {
		const epoch = rasterEpoch();
		if (epoch === 0) return;
		const el = rootEl;
		if (!el) return;
		el.style.height = epoch % 2 === 0 ? "100vh" : "calc(100vh - 1px)";
	});

	onMount(() => {
		startIncrementalLoad();
		setOnTick(maybeAutoFit);
		const onResize = () => maybeAutoFit();
		window.addEventListener("resize", onResize);
		const wheelHandler = (e: WheelEvent) => onCanvasWheel(e);
		rootEl?.addEventListener("wheel", wheelHandler, { passive: false });
		onCleanup(() => {
			setOnTick(null);
			window.removeEventListener("resize", onResize);
			rootEl?.removeEventListener("wheel", wheelHandler);
		});
	});

	startForceSimulation();

	return (
		<div
			ref={(el) => {
				rootEl = el;
			}}
			class="canvas-root"
			onPointerDown={onCanvasPointerDown}
			onPointerMove={onCanvasPointerMove}
			onPointerUp={onCanvasPointerUp}
			onPointerCancel={onCanvasPointerUp}
		>
			<div
				class="viewport"
				style={{
					transform: `translate(${viewportStore.tx}px, ${viewportStore.ty}px) scale(${viewportStore.scale})`,
				}}
			>
				<div class="node-layer">
					<For each={graphNodes()}>
						{(n) => (n.nodeKind === "scrap" ? <ScrapNode id={n.id} /> : <PersonNode id={n.id} />)}
					</For>
				</div>
				<svg class="edge-layer" width="100%" height="100%" aria-hidden="true">
					<For each={graphEdges()}>{(e) => <Edge source={e.source} target={e.target} />}</For>
				</svg>
			</div>
		</div>
	);
};
