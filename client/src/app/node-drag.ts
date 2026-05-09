import { startEdgePan, stopEdgePan } from "~/client/src/app/edge-pan.ts";
import { getSimNode, getSimulation } from "~/client/src/app/force-simulation.ts";
import { clientToWorld, setViewportStore, viewportStore } from "~/client/src/stores/viewport.ts";

const DRAG_THRESHOLD_PX = 3;

const activeCancels = new Set<() => void>();

export function isDragActive(): boolean {
	return activeCancels.size > 0;
}

export function cancelActiveDrags(): void {
	const cancels = Array.from(activeCancels);
	activeCancels.clear();
	for (const cancel of cancels) cancel();
}

export interface DragHandlers {
	onPointerDown: (e: PointerEvent) => void;
	onPointerMove: (e: PointerEvent) => void;
	onPointerUp: (e: PointerEvent) => void;
}

export function createNodeDragHandlers(
	id: () => string,
	persist: (id: string, x: number, y: number) => Promise<void>,
	onClick?: () => void,
): DragHandlers {
	let drag: {
		pointerId: number;
		startX: number;
		startY: number;
		offsetX: number;
		offsetY: number;
		lastClientX: number;
		lastClientY: number;
		moved: boolean;
		captureEl: HTMLElement;
		cancel: () => void;
	} | null = null;

	const applyDrag = () => {
		if (!drag) return;
		const sn = getSimNode(id());
		if (!sn) return;
		const world = clientToWorld(drag.lastClientX, drag.lastClientY);
		sn.fx = world.x - drag.offsetX;
		sn.fy = world.y - drag.offsetY;
	};

	const cancel = () => {
		if (!drag) return;
		const target = drag.captureEl;
		const pointerId = drag.pointerId;
		activeCancels.delete(drag.cancel);
		drag = null;
		stopEdgePan();
		getSimulation()?.alphaTarget(0);
		if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
	};

	const onPointerDown = (e: PointerEvent) => {
		if (e.button !== 0 && e.pointerType === "mouse") return;
		const sn = getSimNode(id());
		if (!sn) return;
		const captureEl = e.currentTarget as HTMLElement;
		captureEl.setPointerCapture(e.pointerId);
		const world = clientToWorld(e.clientX, e.clientY);
		drag = {
			pointerId: e.pointerId,
			startX: e.clientX,
			startY: e.clientY,
			offsetX: world.x - (sn.x ?? 0),
			offsetY: world.y - (sn.y ?? 0),
			lastClientX: e.clientX,
			lastClientY: e.clientY,
			moved: false,
			captureEl,
			cancel,
		};
		activeCancels.add(cancel);
		e.stopPropagation();
		e.preventDefault();
	};

	const onPointerMove = (e: PointerEvent) => {
		if (!drag || e.pointerId !== drag.pointerId) return;
		drag.lastClientX = e.clientX;
		drag.lastClientY = e.clientY;
		if (
			!drag.moved &&
			Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) >= DRAG_THRESHOLD_PX
		) {
			drag.moved = true;
			if (!viewportStore.userInteracted) setViewportStore("userInteracted", true);
			getSimulation()?.alphaTarget(0.3).restart();
			startEdgePan(id(), applyDrag);
		}
		if (drag.moved) {
			applyDrag();
		}
	};

	const onPointerUp = (e: PointerEvent) => {
		if (!drag || e.pointerId !== drag.pointerId) return;
		const moved = drag.moved;
		const target = drag.captureEl;
		if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
		activeCancels.delete(drag.cancel);
		drag = null;
		stopEdgePan();
		if (!moved) {
			onClick?.();
			return;
		}
		getSimulation()?.alphaTarget(0);
		const sn = getSimNode(id());
		if (!sn || sn.fx == null || sn.fy == null) return;
		const nodeId = id();
		persist(nodeId, sn.fx, sn.fy).catch((err) => {
			console.error("failed to persist node position", { id: nodeId, err });
		});
	};

	return { onPointerDown, onPointerMove, onPointerUp };
}
