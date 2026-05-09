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

// Step 1 of the two-step login: returns whether the username has a password
// already set. If not, the server has just sent a setup OTP via the bot.
export async function lookupUsername(username: string): Promise<{ passwordSet: boolean } | null> {
	const res = await api.api.auth.lookup.$post({ json: { username } });
	if (!res.ok) return null;
	return await res.json();
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

// Wipes any existing password and sends a fresh OTP. Returns true if the
// request was accepted (always true, server doesn't reveal existence).
export async function requestForgotCode(username: string): Promise<boolean> {
	const res = await api.api.auth.forgot.$post({ json: { username } });
	return res.ok;
}

export async function setupPassword(
	username: string,
	code: string,
	newPassword: string,
): Promise<boolean> {
	const res = await api.api.auth.setup.$post({
		json: { username, code, newPassword },
	});
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
