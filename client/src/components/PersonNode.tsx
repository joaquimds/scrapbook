import { type Component, Show } from "solid-js";
import { updatePersonPosition } from "~/client/src/api/services.ts";
import { HiResImage } from "~/client/src/components/HiResImage.tsx";
import { NodeShell } from "~/client/src/components/NodeShell.tsx";
import { peopleStore } from "~/client/src/stores/people.ts";
import { scrapsStore } from "~/client/src/stores/scraps.ts";
import { setEditingScrapId } from "~/client/src/stores/ui.ts";

export const PersonNode: Component<{ id: string }> = (props) => {
	const person = () => peopleStore.byId[props.id];
	return (
		<Show when={person()}>
			{(p) => {
				const featured = () => {
					const fid = p().featuredScrapId;
					return fid ? scrapsStore.byId[fid] : undefined;
				};
				return (
					<NodeShell
						id={props.id}
						class="person-node"
						persist={updatePersonPosition}
						onClick={() => {
							const fid = p().featuredScrapId;
							if (fid) setEditingScrapId(fid);
						}}
					>
						<Show when={featured()?.thumbnailUrl}>
							<HiResImage
								class="person-photo"
								thumbUrl={featured()?.thumbnailUrl ?? null}
								mediaUrl={featured()?.mediaUrl ?? null}
								alt={p().name}
							/>
						</Show>
						<span class="node-label">{p().name}</span>
					</NodeShell>
				);
			}}
		</Show>
	);
};
