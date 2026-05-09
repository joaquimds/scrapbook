import { createSignal } from "solid-js";
import { api } from "~/client/src/api/services.ts";

export type AuthStatus = "loading" | "authed" | "unauthed";

export interface CurrentUser {
	id: string;
	username: string;
}

const [status, setStatus] = createSignal<AuthStatus>("loading");
const [user, setUser] = createSignal<CurrentUser | null>(null);

export const authStatus = status;
export const currentUser = user;

export async function checkAuth(): Promise<void> {
	try {
		const res = await api.api.auth.check.$get();
		if (!res.ok) {
			setUser(null);
			setStatus("unauthed");
			return;
		}
		const body = await res.json();
		if ("user" in body) {
			setUser(body.user);
			setStatus("authed");
		} else {
			setUser(null);
			setStatus("unauthed");
		}
	} catch {
		setUser(null);
		setStatus("unauthed");
	}
}

export async function login(username: string, password: string): Promise<boolean> {
	const res = await api.api.auth.login.$post({ json: { username, password } });
	if (!res.ok) return false;
	const body = await res.json();
	if (!("user" in body)) return false;
	setUser(body.user);
	setStatus("authed");
	return true;
}

// Asks the server to issue a setup token and DM a setup link via Telegram.
// Always resolves true (the endpoint is silent on unknown users).
export async function requestSetupLink(username: string): Promise<boolean> {
	const res = await api.api.auth.forgot.$post({ json: { username } });
	return res.ok;
}

export async function validateSetupToken(token: string): Promise<{ username: string } | null> {
	const res = await api.api.auth["setup-token"][":token"].$get({ param: { token } });
	if (!res.ok) return null;
	const body = await res.json();
	if (!("username" in body)) return null;
	return { username: body.username };
}

export async function completeSetup(token: string, password: string): Promise<boolean> {
	const res = await api.api.auth.setup.$post({ json: { token, password } });
	if (!res.ok) return false;
	const body = await res.json();
	if (!("user" in body)) return false;
	setUser(body.user);
	setStatus("authed");
	return true;
}

export function setUnauthed(): void {
	setUser(null);
	setStatus("unauthed");
}
