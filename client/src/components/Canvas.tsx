import { type Component, For, onCleanup, onMount } from "solid-js";
import { setOnTick, startForceSimulation } from "~/client/src/app/force-simulation.ts";
import { startIncrementalLoad } from "~/client/src/app/incremental-load.ts";
import { maybeAutoFit } from "~/client/src/app/viewport-fit.ts";
import { attachViewportInput, onCanvasWheel } from "~/client/src/app/viewport-input.ts";
import { Edge } from "~/client/src/components/Edge.tsx";
import { PersonNode } from "~/client/src/components/PersonNode.tsx";
import { ScrapNode } from "~/client/src/components/ScrapNode.tsx";
import { graphEdges, graphNodes } from "~/client/src/stores/graph.ts";
import { LAYOUT_FACTOR, viewportStore } from "~/client/src/stores/viewport.ts";

export const Canvas: Component = () => {
	let rootEl: HTMLDivElement | undefined;

	onMount(() => {
		startIncrementalLoad();
		setOnTick(maybeAutoFit);
		const onResize = () => maybeAutoFit();
		window.addEventListener("resize", onResize);
		const wheelHandler = (e: WheelEvent) => onCanvasWheel(e);
		rootEl?.addEventListener("wheel", wheelHandler, { passive: false });
		const detachInput = rootEl ? attachViewportInput(rootEl) : null;
		onCleanup(() => {
			setOnTick(null);
			window.removeEventListener("resize", onResize);
			rootEl?.removeEventListener("wheel", wheelHandler);
			detachInput?.();
		});
	});

	startForceSimulation();

	return (
		<div
			ref={(el) => {
				rootEl = el;
			}}
			class="canvas-root"
		>
			<div
				class="viewport"
				style={{
					transform: `translate(${viewportStore.tx}px, ${viewportStore.ty}px) scale(${viewportStore.scale / LAYOUT_FACTOR})`,
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
