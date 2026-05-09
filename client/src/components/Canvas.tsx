import { type Component, For, Match, onCleanup, onMount, Switch } from "solid-js";
import { setOnTick, startForceSimulation } from "~/client/src/app/force-simulation.ts";
import { maybeAutoFit } from "~/client/src/app/viewport-fit.ts";
import { attachViewportInput, onCanvasWheel } from "~/client/src/app/viewport-input.ts";
import { Edge } from "~/client/src/components/Edge.tsx";
import { MarketingNode } from "~/client/src/components/MarketingNode.tsx";
import { PersonNode } from "~/client/src/components/PersonNode.tsx";
import { ScrapNode } from "~/client/src/components/ScrapNode.tsx";
import type { GraphEdge, GraphNode } from "~/client/src/stores/graph.ts";
import { LAYOUT_FACTOR, viewportStore } from "~/client/src/stores/viewport.ts";

interface CanvasProps {
	nodes: () => GraphNode[];
	edges: () => GraphEdge[];
}

export const Canvas: Component<CanvasProps> = (props) => {
	let rootEl: HTMLDivElement | undefined;

	onMount(() => {
		setOnTick(() => maybeAutoFit(props.nodes()));
		const onResize = () => maybeAutoFit(props.nodes());
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

	startForceSimulation({ nodes: props.nodes, edges: props.edges });

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
					<For each={props.nodes()}>
						{(n) => (
							<Switch>
								<Match when={n.nodeKind === "scrap"}>
									<ScrapNode id={n.id} />
								</Match>
								<Match when={n.nodeKind === "person"}>
									<PersonNode id={n.id} />
								</Match>
								<Match
									when={
										n.nodeKind === "brand" ||
										n.nodeKind === "feature" ||
										n.nodeKind === "login" ||
										n.nodeKind === "register"
									}
								>
									<MarketingNode node={n} />
								</Match>
							</Switch>
						)}
					</For>
				</div>
				<svg class="edge-layer" width="100%" height="100%" aria-hidden="true">
					<For each={props.edges()}>{(e) => <Edge source={e.source} target={e.target} />}</For>
				</svg>
			</div>
		</div>
	);
};
