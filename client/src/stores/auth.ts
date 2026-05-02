import { createSignal } from "solid-js";

export type AuthStatus = "loading" | "authed" | "unauthed";

const [status, setStatus] = createSignal<AuthStatus>("loading");

export const authStatus = status;

export async function checkAuth(): Promise<void> {
	try {
		const res = await fetch("/api/auth/check", { credentials: "include" });
		setStatus(res.ok ? "authed" : "unauthed");
	} catch {
		setStatus("unauthed");
	}
}

export async function login(password: string): Promise<boolean> {
	const res = await fetch("/api/auth/login", {
		method: "POST",
		credentials: "include",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ password }),
	});
	if (!res.ok) return false;
	setStatus("authed");
	return true;
}

export function setUnauthed(): void {
	setStatus("unauthed");
}
