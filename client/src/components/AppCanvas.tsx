import { type Component, onMount, Show } from "solid-js";
import { startIncrementalLoad } from "~/client/src/app/incremental-load.ts";
import { Canvas } from "~/client/src/components/Canvas.tsx";
import { ScrapForm } from "~/client/src/components/ScrapForm.tsx";
import { logout } from "~/client/src/stores/auth.ts";
import { graphEdges, graphNodes } from "~/client/src/stores/graph.ts";
import { editingScrapId, setEditingScrapId } from "~/client/src/stores/ui.ts";

export const AppCanvas: Component = () => {
	onMount(() => {
		startIncrementalLoad();
	});
	return (
		<>
			<Canvas nodes={graphNodes} edges={graphEdges} />
			<div class="top-actions">
				<button type="button" class="add-button" onClick={() => setEditingScrapId(null)}>
					add
				</button>
				<button type="button" class="logout-button" onClick={() => void logout()}>
					log out
				</button>
			</div>
			<Show when={editingScrapId() !== undefined}>
				<ScrapForm
					scrapId={editingScrapId() ?? null}
					onClose={() => setEditingScrapId(undefined)}
				/>
			</Show>
		</>
	);
};
