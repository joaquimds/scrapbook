import { type Component, type JSX, onCleanup, Show } from "solid-js";
import { positionsStore } from "~/client/src/app/force-simulation.ts";
import { createNodeDragHandlers } from "~/client/src/app/node-drag.ts";
import { setNodeSize } from "~/client/src/app/node-sizes.ts";
import { LAYOUT_FACTOR } from "~/client/src/stores/viewport.ts";

interface NodeShellProps {
	id: string;
	class?: string;
	persist?: (id: string, x: number, y: number) => Promise<void>;
	onClick?: () => void;
	children: JSX.Element;
}

const noopPersist = async () => {};

export const NodeShell: Component<NodeShellProps> = (props) => {
	const pos = () => positionsStore[props.id];

	let el: HTMLDivElement | undefined;
	const observer = new ResizeObserver(() => {
		if (!el) return;
		setNodeSize(props.id, el.offsetWidth / LAYOUT_FACTOR, el.offsetHeight / LAYOUT_FACTOR);
	});
	const attach = (node: HTMLDivElement) => {
		el = node;
		observer.observe(node);
	};
	onCleanup(() => {
		if (el) observer.unobserve(el);
		observer.disconnect();
	});

	const drag = createNodeDragHandlers(() => props.id, props.persist ?? noopPersist, props.onClick);

	return (
		<Show when={pos()}>
			{(p) => (
				<div
					ref={attach}
					class={`node ${props.class ?? ""}`}
					style={{
						left: `${p().x * LAYOUT_FACTOR}px`,
						top: `${p().y * LAYOUT_FACTOR}px`,
					}}
					onPointerDown={drag.onPointerDown}
					onPointerMove={drag.onPointerMove}
					onPointerUp={drag.onPointerUp}
					onPointerCancel={drag.onPointerUp}
				>
					{props.children}
				</div>
			)}
		</Show>
	);
};
