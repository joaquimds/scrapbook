import { type Component, onCleanup, Show } from "solid-js";
import { getSimulation, positions } from "~/client/src/app/force-simulation.ts";
import { setNodeSize } from "~/client/src/app/node-sizes.ts";
import { scrapsStore } from "~/client/src/stores/scraps.ts";

export const ScrapNode: Component<{ id: string }> = (props) => {
	const data = () => {
		const pos = positions[props.id];
		const scrap = scrapsStore.byId[props.id];
		if (!pos || !scrap) return undefined;
		return { pos, scrap };
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
					class="node scrap-node"
					style={{ left: `${d().pos.x}px`, top: `${d().pos.y}px` }}
				>
					<Show
						when={d().scrap.thumbnailPath}
						fallback={<div class="scrap-card">{d().scrap.body ?? d().scrap.kind}</div>}
					>
						{(thumb) => (
							<img
								class="scrap-photo"
								src={`/media/${thumb()}`}
								alt={d().scrap.body ?? ""}
								title={d().scrap.body ?? undefined}
							/>
						)}
					</Show>
				</div>
			)}
		</Show>
	);
};
