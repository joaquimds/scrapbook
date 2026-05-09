import { A } from "@solidjs/router";
import { type Component, createSignal } from "solid-js";
import { requestSetupLink } from "~/client/src/stores/auth.ts";

export const ForgotPage: Component = () => {
	const [username, setUsername] = createSignal("");
	const [busy, setBusy] = createSignal(false);
	const [sent, setSent] = createSignal(false);

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		setBusy(true);
		await requestSetupLink(username());
		setBusy(false);
		setSent(true);
	}

	return (
		<div class="login-root">
			<form class="login-card" onSubmit={onSubmit}>
				{sent() ? (
					<>
						<p class="login-help">
							If that username exists, we've sent a setup link via Telegram. Open the bot and tap
							the link to choose a new password.
						</p>
						<A class="login-link" href="/login">
							Back to sign in
						</A>
					</>
				) : (
					<>
						<label class="login-label" for="forgot-username">
							Username
						</label>
						<input
							id="forgot-username"
							class="login-input"
							type="text"
							autocomplete="username"
							value={username()}
							onInput={(e) => setUsername(e.currentTarget.value)}
							disabled={busy()}
							autofocus
						/>
						<button class="login-button" type="submit" disabled={busy() || !username()}>
							{busy() ? "…" : "Send setup link"}
						</button>
						<A class="login-link" href="/login">
							Back to sign in
						</A>
					</>
				)}
			</form>
		</div>
	);
};
