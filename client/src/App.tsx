import { Navigate, Route, Router } from "@solidjs/router";
import { type Component, Match, onMount, Switch } from "solid-js";
import { Canvas } from "~/client/src/components/Canvas.tsx";
import { ForgotPage } from "~/client/src/pages/ForgotPage.tsx";
import { LoginPage } from "~/client/src/pages/LoginPage.tsx";
import { SetupPage } from "~/client/src/pages/SetupPage.tsx";
import { authStatus, checkAuth } from "~/client/src/stores/auth.ts";

const Home: Component = () => (
	<Switch>
		<Match when={authStatus() === "authed"}>
			<Canvas />
		</Match>
		<Match when={authStatus() === "unauthed"}>
			<Navigate href="/login" />
		</Match>
	</Switch>
);

export const App: Component = () => {
	onMount(() => {
		void checkAuth();
	});
	return (
		<Router>
			<Route path="/" component={Home} />
			<Route path="/login" component={LoginPage} />
			<Route path="/forgot" component={ForgotPage} />
			<Route path="/setup" component={SetupPage} />
		</Router>
	);
};
