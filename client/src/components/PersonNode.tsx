import { type Component, onCleanup, Show } from "solid-js";
import { updatePersonPosition } from "~/client/src/api/services.ts";
import { getSimulation, positionsStore } from "~/client/src/app/force-simulation.ts";
import { createNodeDragHandlers } from "~/client/src/app/node-drag.ts";
import { setNodeSize } from "~/client/src/app/node-sizes.ts";
import { HiResImage } from "~/client/src/components/HiResImage.tsx";
import { peopleStore } from "~/client/src/stores/people.ts";
import { scrapsStore } from "~/client/src/stores/scraps.ts";
import { LAYOUT_FACTOR } from "~/client/src/stores/viewport.ts";

export const PersonNode: Component<{ id: string }> = (props) => {
	const data = () => {
		const pos = positionsStore[props.id];
		const person = peopleStore.byId[props.id];
		if (!pos || !person) return undefined;
		const featured = person.featuredScrapId ? scrapsStore.byId[person.featuredScrapId] : undefined;
		const thumb = featured?.thumbnailUrl ?? null;
		const media = featured?.mediaUrl ?? null;
		return { pos, person, thumb, media };
	};

	let el: HTMLDivElement | undefined;
	const observer = new ResizeObserver((entries) => {
		const entry = entries[0];
		if (!entry) return;
		const { width, height } = entry.contentRect;
		setNodeSize(props.id, width / LAYOUT_FACTOR, height / LAYOUT_FACTOR, getSimulation());
	});
	const attach = (node: HTMLDivElement) => {
		el = node;
		observer.observe(node);
	};
	onCleanup(() => {
		if (el) observer.unobserve(el);
		observer.disconnect();
	});

	const drag = createNodeDragHandlers(() => props.id, updatePersonPosition);

	return (
		<Show when={data()}>
			{(d) => (
				<div
					ref={attach}
					class="node person-node"
					style={{
						left: `${d().pos.x * LAYOUT_FACTOR}px`,
						top: `${d().pos.y * LAYOUT_FACTOR}px`,
					}}
					onPointerDown={drag.onPointerDown}
					onPointerMove={drag.onPointerMove}
					onPointerUp={drag.onPointerUp}
					onPointerCancel={drag.onPointerUp}
				>
					<Show when={d().thumb}>
						<HiResImage
							class="person-photo"
							thumbUrl={d().thumb}
							mediaUrl={d().media}
							alt={d().person.name}
						/>
					</Show>
					<span class="node-label">{d().person.name}</span>
				</div>
			)}
		</Show>
	);
};
