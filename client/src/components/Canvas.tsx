import { type Component, For, onMount } from "solid-js";
import { startForceSimulation } from "~/client/src/app/force-simulation.ts";
import { startIncrementalLoad } from "~/client/src/app/incremental-load.ts";
import { Edge } from "~/client/src/components/Edge.tsx";
import { PersonNode } from "~/client/src/components/PersonNode.tsx";
import { ScrapNode } from "~/client/src/components/ScrapNode.tsx";
import { graphEdges, graphNodes } from "~/client/src/stores/graph.ts";

export const Canvas: Component = () => {
	onMount(() => {
		startIncrementalLoad();
	});
	startForceSimulation();

	return (
		<div class="canvas-root">
			<div class="node-layer">
				<For each={graphNodes()}>
					{(n) => (n.nodeKind === "scrap" ? <ScrapNode id={n.id} /> : <PersonNode id={n.id} />)}
				</For>
			</div>
			<svg class="edge-layer" width="100%" height="100%" aria-hidden="true">
				<For each={graphEdges()}>{(e) => <Edge source={e.source} target={e.target} />}</For>
			</svg>
		</div>
	);
};
