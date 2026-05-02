import { type Component, Match, onMount, Switch } from "solid-js";
import { Canvas } from "~/client/src/components/Canvas.tsx";
import { LoginScreen } from "~/client/src/components/LoginScreen.tsx";
import { authStatus, checkAuth } from "~/client/src/stores/auth.ts";

export const App: Component = () => {
	onMount(() => {
		void checkAuth();
	});
	return (
		<Switch>
			<Match when={authStatus() === "authed"}>
				<Canvas />
			</Match>
			<Match when={authStatus() === "unauthed"}>
				<LoginScreen />
			</Match>
		</Switch>
	);
};
