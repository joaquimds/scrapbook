import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";
import { NodeShell } from "~/client/src/components/NodeShell.tsx";
import type { GraphNode } from "~/client/src/stores/graph.ts";

const TELEGRAM_BOT_URL = "https://t.me/ScrappySilviaBot";

export const MarketingNode: Component<{ node: GraphNode }> = (props) => {
	const navigate = useNavigate();
	const onClick = () => {
		switch (props.node.nodeKind) {
			case "login":
				navigate("/login");
				break;
			case "register":
				window.open(TELEGRAM_BOT_URL, "_blank", "noopener,noreferrer");
				break;
		}
	};
	const interactive = props.node.nodeKind === "login" || props.node.nodeKind === "register";
	return (
		<NodeShell
			id={props.node.id}
			class={`marketing-node marketing-node--${props.node.nodeKind}`}
			onClick={interactive ? onClick : undefined}
		>
			{props.node.id}
		</NodeShell>
	);
};
