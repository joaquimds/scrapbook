import { type Component, onMount } from "solid-js";
import { startIncrementalLoad } from "~/client/src/app/incremental-load.ts";
import { Canvas } from "~/client/src/components/Canvas.tsx";
import { logout } from "~/client/src/stores/auth.ts";
import { graphEdges, graphNodes } from "~/client/src/stores/graph.ts";

export const AppCanvas: Component = () => {
	onMount(() => {
		startIncrementalLoad();
	});
	return (
		<>
			<Canvas nodes={graphNodes} edges={graphEdges} />
			<button type="button" class="logout-button" onClick={() => void logout()}>
				log out
			</button>
		</>
	);
};
