import { type Component, onCleanup, Show } from "solid-js";
import { updateScrapPosition } from "~/client/src/api/services.ts";
import { getSimulation, positionsStore } from "~/client/src/app/force-simulation.ts";
import { createNodeDragHandlers } from "~/client/src/app/node-drag.ts";
import { setNodeSize } from "~/client/src/app/node-sizes.ts";
import { scrapsStore } from "~/client/src/stores/scraps.ts";

export const ScrapNode: Component<{ id: string }> = (props) => {
	const data = () => {
		const pos = positionsStore[props.id];
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

	const drag = createNodeDragHandlers(() => props.id, updateScrapPosition);

	return (
		<Show when={data()}>
			{(d) => (
				<div
					ref={attach}
					class="node scrap-node"
					style={{ left: `${d().pos.x}px`, top: `${d().pos.y}px` }}
					onPointerDown={drag.onPointerDown}
					onPointerMove={drag.onPointerMove}
					onPointerUp={drag.onPointerUp}
					onPointerCancel={drag.onPointerUp}
				>
					<Show
						when={d().scrap.thumbnailUrl}
						fallback={<div class="scrap-card">{d().scrap.body ?? d().scrap.kind}</div>}
					>
						{(thumb) => (
							<img
								class="scrap-photo"
								src={thumb()}
								alt={d().scrap.body ?? ""}
								title={d().scrap.body ?? undefined}
								draggable={false}
							/>
						)}
					</Show>
				</div>
			)}
		</Show>
	);
};
