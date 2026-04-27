import type { Component } from "solid-js";
import { positions } from "~/client/src/app/force-simulation.ts";
import { getNodeSize } from "~/client/src/app/node-sizes.ts";

const FALLBACK = { w: 40, h: 40 };

// Push (cx, cy) outward along the line toward (tx, ty) until it sits on the
// edge of the node's bounding rectangle. If the two centres coincide, we just
// return the centre to avoid a divide-by-zero.
function clipToRect(
	cx: number,
	cy: number,
	tx: number,
	ty: number,
	w: number,
	h: number,
): { x: number; y: number } {
	const dx = tx - cx;
	const dy = ty - cy;
	if (dx === 0 && dy === 0) return { x: cx, y: cy };
	const hw = w / 2;
	const hh = h / 2;
	const scale = Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh);
	if (scale === 0) return { x: cx, y: cy };
	return { x: cx + dx / scale, y: cy + dy / scale };
}

export const Edge: Component<{ source: string; target: string }> = (props) => {
	const ends = () => {
		const sp = positions[props.source];
		const tp = positions[props.target];
		if (!sp || !tp) return undefined;
		const ss = getNodeSize(props.source) ?? FALLBACK;
		const ts = getNodeSize(props.target) ?? FALLBACK;
		const a = clipToRect(sp.x, sp.y, tp.x, tp.y, ss.w, ss.h);
		const b = clipToRect(tp.x, tp.y, sp.x, sp.y, ts.w, ts.h);
		return { a, b };
	};
	return (
		<line
			x1={ends()?.a.x ?? 0}
			y1={ends()?.a.y ?? 0}
			x2={ends()?.b.x ?? 0}
			y2={ends()?.b.y ?? 0}
			stroke="#c0392b"
			stroke-width="1.2"
			stroke-opacity="0.7"
		/>
	);
};
