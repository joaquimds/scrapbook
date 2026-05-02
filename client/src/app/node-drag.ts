import { getSimNode, getSimulation } from "~/client/src/app/force-simulation.ts";

const DRAG_THRESHOLD_PX = 3;

export interface DragHandlers {
	onPointerDown: (e: PointerEvent) => void;
	onPointerMove: (e: PointerEvent) => void;
	onPointerUp: (e: PointerEvent) => void;
}

export function createNodeDragHandlers(
	id: () => string,
	persist: (id: string, x: number, y: number) => Promise<void>,
): DragHandlers {
	let drag: {
		pointerId: number;
		startX: number;
		startY: number;
		offsetX: number;
		offsetY: number;
		moved: boolean;
	} | null = null;

	const onPointerDown = (e: PointerEvent) => {
		if (e.button !== 0) return;
		const sn = getSimNode(id());
		if (!sn) return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		drag = {
			pointerId: e.pointerId,
			startX: e.clientX,
			startY: e.clientY,
			offsetX: e.clientX - (sn.x ?? 0),
			offsetY: e.clientY - (sn.y ?? 0),
			moved: false,
		};
		e.preventDefault();
	};

	const onPointerMove = (e: PointerEvent) => {
		if (!drag || e.pointerId !== drag.pointerId) return;
		const sn = getSimNode(id());
		if (!sn) return;
		const nx = e.clientX - drag.offsetX;
		const ny = e.clientY - drag.offsetY;
		if (
			!drag.moved &&
			Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) >= DRAG_THRESHOLD_PX
		) {
			drag.moved = true;
			getSimulation()?.alphaTarget(0.3).restart();
		}
		if (drag.moved) {
			sn.fx = nx;
			sn.fy = ny;
		}
	};

	const onPointerUp = (e: PointerEvent) => {
		if (!drag || e.pointerId !== drag.pointerId) return;
		const moved = drag.moved;
		const target = e.currentTarget as HTMLElement;
		if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
		drag = null;
		if (!moved) return;
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
