import { A, useNavigate } from "@solidjs/router";
import { type Component, createEffect, createSignal } from "solid-js";
import { authStatus, login } from "~/client/src/stores/auth.ts";

export const LoginPage: Component = () => {
	const navigate = useNavigate();
	const [username, setUsername] = createSignal("");
	const [password, setPassword] = createSignal("");
	const [error, setError] = createSignal<string | null>(null);
	const [busy, setBusy] = createSignal(false);

	createEffect(() => {
		if (authStatus() === "authed") navigate("/", { replace: true });
	});

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		const ok = await login(username(), password());
		setBusy(false);
		if (!ok) setError("Invalid username or password.");
	}

	return (
		<div class="login-root">
			<form class="login-card" onSubmit={onSubmit}>
				<label class="login-label" for="login-username">
					Username
				</label>
				<input
					id="login-username"
					class="login-input"
					type="text"
					autocomplete="username"
					value={username()}
					onInput={(e) => setUsername(e.currentTarget.value)}
					disabled={busy()}
					autofocus
				/>
				<label class="login-label" for="login-password">
					Password
				</label>
				<input
					id="login-password"
					class="login-input"
					type="password"
					autocomplete="current-password"
					value={password()}
					onInput={(e) => setPassword(e.currentTarget.value)}
					disabled={busy()}
				/>
				<button class="login-button" type="submit" disabled={busy() || !username() || !password()}>
					{busy() ? "…" : "Sign in"}
				</button>
				<A class="login-link" href="/forgot">
					Forgot password?
				</A>
				{error() && <div class="login-error">{error()}</div>}
			</form>
		</div>
	);
};
