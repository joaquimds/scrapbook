import { type Component, createSignal, Match, Switch } from "solid-js";
import {
	login,
	lookupUsername,
	requestForgotCode,
	setupPassword,
} from "~/client/src/stores/auth.ts";

type Mode = "username" | "password" | "setup";

const MIN_PASSWORD_LEN = 8;

export const LoginScreen: Component = () => {
	const [mode, setMode] = createSignal<Mode>("username");
	const [username, setUsername] = createSignal("");
	const [password, setPassword] = createSignal("");
	const [code, setCode] = createSignal("");
	const [newPassword, setNewPassword] = createSignal("");
	const [error, setError] = createSignal<string | null>(null);
	const [busy, setBusy] = createSignal(false);

	function reset() {
		setMode("username");
		setPassword("");
		setCode("");
		setNewPassword("");
		setError(null);
	}

	async function onUsernameSubmit(e: SubmitEvent) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		const result = await lookupUsername(username());
		setBusy(false);
		if (!result) {
			setError("Something went wrong. Try again.");
			return;
		}
		setMode(result.passwordSet ? "password" : "setup");
	}

	async function onPasswordSubmit(e: SubmitEvent) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		const ok = await login(username(), password());
		setBusy(false);
		if (!ok) setError("Wrong password.");
	}

	async function onForgot() {
		setBusy(true);
		setError(null);
		const ok = await requestForgotCode(username());
		setBusy(false);
		if (!ok) {
			setError("Couldn't send a code. Try again.");
			return;
		}
		setPassword("");
		setMode("setup");
	}

	async function onSetupSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (newPassword().length < MIN_PASSWORD_LEN) {
			setError(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
			return;
		}
		setBusy(true);
		setError(null);
		const ok = await setupPassword(username(), code(), newPassword());
		setBusy(false);
		if (!ok) setError("That code didn't work. Check your Telegram and try again.");
	}

	return (
		<div class="login-root">
			<Switch>
				<Match when={mode() === "username"}>
					<form class="login-card" onSubmit={onUsernameSubmit}>
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
						<button class="login-button" type="submit" disabled={busy() || !username()}>
							{busy() ? "…" : "Continue"}
						</button>
						{error() && <div class="login-error">{error()}</div>}
					</form>
				</Match>

				<Match when={mode() === "password"}>
					<form class="login-card" onSubmit={onPasswordSubmit}>
						<div class="login-username-row">
							<span>{username()}</span>
							<button type="button" class="login-link" onClick={reset} disabled={busy()}>
								change
							</button>
						</div>
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
							{busy() ? "…" : "Sign in"}
						</button>
						<button type="button" class="login-link" onClick={onForgot} disabled={busy()}>
							Forgot password?
						</button>
						{error() && <div class="login-error">{error()}</div>}
					</form>
				</Match>

				<Match when={mode() === "setup"}>
					<form class="login-card" onSubmit={onSetupSubmit}>
						<div class="login-username-row">
							<span>{username()}</span>
							<button type="button" class="login-link" onClick={reset} disabled={busy()}>
								change
							</button>
						</div>
						<p class="login-help">Check Telegram for a 6-digit code, then choose a password.</p>
						<label class="login-label" for="login-code">
							Code
						</label>
						<input
							id="login-code"
							class="login-input"
							type="text"
							inputmode="numeric"
							autocomplete="one-time-code"
							value={code()}
							onInput={(e) => setCode(e.currentTarget.value)}
							disabled={busy()}
							autofocus
						/>
						<label class="login-label" for="login-new-password">
							New password
						</label>
						<input
							id="login-new-password"
							class="login-input"
							type="password"
							autocomplete="new-password"
							value={newPassword()}
							onInput={(e) => setNewPassword(e.currentTarget.value)}
							disabled={busy()}
						/>
						<button
							class="login-button"
							type="submit"
							disabled={busy() || !code() || !newPassword()}
						>
							{busy() ? "…" : "Set password & sign in"}
						</button>
						{error() && <div class="login-error">{error()}</div>}
					</form>
				</Match>
			</Switch>
		</div>
	);
};
