import { type Component, createSignal } from "solid-js";
import { login } from "~/client/src/stores/auth.ts";

export const LoginScreen: Component = () => {
	const [password, setPassword] = createSignal("");
	const [error, setError] = createSignal<string | null>(null);
	const [busy, setBusy] = createSignal(false);

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		const ok = await login(password());
		setBusy(false);
		if (!ok) setError("Wrong password.");
	}

	return (
		<div class="login-root">
			<form class="login-card" onSubmit={onSubmit}>
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
					autofocus
				/>
				<button class="login-button" type="submit" disabled={busy() || !password()}>
					{busy() ? "…" : "Unlock"}
				</button>
				{error() && <div class="login-error">{error()}</div>}
			</form>
		</div>
	);
};
