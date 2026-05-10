import { type Component, Show } from "solid-js";
import { updateScrapPosition } from "~/client/src/api/services.ts";
import { HiResImage } from "~/client/src/components/HiResImage.tsx";
import { NodeShell } from "~/client/src/components/NodeShell.tsx";
import { scrapsStore } from "~/client/src/stores/scraps.ts";
import { setEditingScrapId } from "~/client/src/stores/ui.ts";

export const ScrapNode: Component<{ id: string }> = (props) => {
	const scrap = () => scrapsStore.byId[props.id];
	return (
		<Show when={scrap()}>
			{(s) => (
				<NodeShell
					id={props.id}
					class="scrap-node"
					persist={updateScrapPosition}
					onClick={() => setEditingScrapId(props.id)}
				>
					<Show when={s().thumbnailUrl} fallback={<div class="scrap-card">{s().body ?? ""}</div>}>
						<HiResImage
							class="scrap-photo"
							thumbUrl={s().thumbnailUrl}
							mediaUrl={s().mediaUrl}
							alt={s().body ?? ""}
							title={s().body ?? undefined}
						/>
					</Show>
				</NodeShell>
			)}
		</Show>
	);
};
