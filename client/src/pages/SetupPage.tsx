import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { type Component, createResource, createSignal, Show } from "solid-js";
import { completeSetup, validateSetupToken } from "~/client/src/stores/auth.ts";

const MIN_PASSWORD_LEN = 8;

export const SetupPage: Component = () => {
	const navigate = useNavigate();
	const [params] = useSearchParams<{ token?: string }>();
	const token = () => params.token ?? "";

	const [validated] = createResource(token, async (t) => {
		if (!t) return null;
		return await validateSetupToken(t);
	});

	const [password, setPassword] = createSignal("");
	const [error, setError] = createSignal<string | null>(null);
	const [busy, setBusy] = createSignal(false);

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (password().length < MIN_PASSWORD_LEN) {
			setError(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
			return;
		}
		setBusy(true);
		setError(null);
		const ok = await completeSetup(token(), password());
		setBusy(false);
		if (!ok) {
			setError("Couldn't set your password. The link may have expired.");
			return;
		}
		navigate("/", { replace: true });
	}

	return (
		<div class="login-root">
			<div class="login-card">
				<Show when={!token()}>
					<p class="login-help">This setup link is missing a token.</p>
					<A class="login-link" href="/forgot">
						Request a new link
					</A>
				</Show>
				<Show when={token() && validated.loading}>
					<p class="login-help">Checking link…</p>
				</Show>
				<Show when={token() && !validated.loading && !validated()}>
					<p class="login-help">This link is expired or invalid.</p>
					<A class="login-link" href="/forgot">
						Request a new link
					</A>
				</Show>
				<Show when={validated()}>
					{(v) => (
						<form onSubmit={onSubmit}>
							<p class="login-help">Set password for {v().username}.</p>
							<label class="login-label" for="setup-password">
								New password
							</label>
							<input
								id="setup-password"
								class="login-input"
								type="password"
								autocomplete="new-password"
								value={password()}
								onInput={(e) => setPassword(e.currentTarget.value)}
								disabled={busy()}
								autofocus
							/>
							<button class="login-button" type="submit" disabled={busy() || !password()}>
								{busy() ? "…" : "Set password & sign in"}
							</button>
							{error() && <div class="login-error">{error()}</div>}
						</form>
					)}
				</Show>
			</div>
		</div>
	);
};
