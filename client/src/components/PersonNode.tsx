import { type Component, onCleanup, Show } from "solid-js";
import { getSimulation, positions } from "~/client/src/app/force-simulation.ts";
import { setNodeSize } from "~/client/src/app/node-sizes.ts";
import { peopleStore } from "~/client/src/stores/people.ts";
import { scrapsStore } from "~/client/src/stores/scraps.ts";

export const PersonNode: Component<{ id: string }> = (props) => {
	const data = () => {
		const pos = positions[props.id];
		const person = peopleStore.byId[props.id];
		if (!pos || !person) return undefined;
		const featured = person.featuredScrapId ? scrapsStore.byId[person.featuredScrapId] : undefined;
		const thumb = featured?.thumbnailUrl ?? null;
		return { pos, person, thumb };
	};

	let el: HTMLDivElement | undefined;
	const observer = new ResizeObserver((entries) => {
		const entry = entries[0];
		if (!entry) return;
		const { width, height } = entry.contentRect;
		setNodeSize(props.id, width, height, getSimulation());
	});
	const attach = (node: HTMLDivElement) => {
		el = node;
		observer.observe(node);
	};
	onCleanup(() => {
		if (el) observer.unobserve(el);
		observer.disconnect();
	});

	return (
		<Show when={data()}>
			{(d) => (
				<div
					ref={attach}
					class="node person-node"
					style={{ left: `${d().pos.x}px`, top: `${d().pos.y}px` }}
				>
					<Show when={d().thumb}>
						{(thumb) => (
							<img class="person-photo" src={thumb()} alt={d().person.name} />
						)}
					</Show>
					<span class="node-label">{d().person.name}</span>
				</div>
			)}
		</Show>
	);
};
