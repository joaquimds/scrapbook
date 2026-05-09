import type { Component } from "solid-js";
import { Canvas } from "~/client/src/components/Canvas.tsx";
import type { GraphEdge, GraphNode } from "~/client/src/stores/graph.ts";

const BRAND_ID = "Scrapboard";
const REGISTER_ID = "Register →";
const LOGIN_ID = "Login →";
const FEATURES = [
	"Add images to a private page, position them however you like",
	"Tag people in images to connect them together",
	"Telegram bot receives new images and sends reminders to keep in touch",
];

const NODES: GraphNode[] = [
	{ id: BRAND_ID, nodeKind: "brand", x: null, y: null },
	{ id: REGISTER_ID, nodeKind: "register", x: null, y: null },
	{ id: LOGIN_ID, nodeKind: "login", x: null, y: null },
	...FEATURES.map<GraphNode>((id) => ({ id, nodeKind: "feature", x: null, y: null })),
];

const EDGES: GraphEdge[] = [
	{ id: `${BRAND_ID}::${REGISTER_ID}`, source: BRAND_ID, target: REGISTER_ID },
	{ id: `${BRAND_ID}::${LOGIN_ID}`, source: BRAND_ID, target: LOGIN_ID },
	...FEATURES.map<GraphEdge>((id) => ({
		id: `${BRAND_ID}::${id}`,
		source: BRAND_ID,
		target: id,
	})),
];

const nodes = () => NODES;
const edges = () => EDGES;

export const MarketingPage: Component = () => {
	return <Canvas nodes={nodes} edges={edges} />;
};
