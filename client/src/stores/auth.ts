import { createSignal } from "solid-js";

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
		const res = await fetch("/api/auth/check", { credentials: "include" });
		if (!res.ok) {
			setUser(null);
			setStatus("unauthed");
			return;
		}
		const body = (await res.json()) as { user: CurrentUser };
		setUser(body.user);
		setStatus("authed");
	} catch {
		setUser(null);
		setStatus("unauthed");
	}
}

export async function login(username: string, password: string): Promise<boolean> {
	const res = await fetch("/api/auth/login", {
		method: "POST",
		credentials: "include",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ username, password }),
	});
	if (!res.ok) return false;
	const body = (await res.json()) as { user: CurrentUser };
	setUser(body.user);
	setStatus("authed");
	return true;
}

export function setUnauthed(): void {
	setUser(null);
	setStatus("unauthed");
}
