// Fixed values seeded into the e2e database before the Playwright suite runs.
// The token is greppable so anyone tracing the e2e auth flow can find it.

// One-shot setup-token user. Reserved for the registration spec — the token is
// consumed on first use, so any other spec must sign in via SIGNIN_* below.
export const STUB_SETUP_TOKEN = "e2e-stub-setup-token-0123456789abcdef0123456789abcdef";
export const STUB_USER_ID = "e2e-user-1";
export const STUB_USERNAME = "e2euser";
export const STUB_TELEGRAM_CHAT_ID = "99999";
export const STUB_PASSWORD = "e2e-password";

// Pre-seeded credentialed user. Used by every spec that just needs to be
// logged in (i.e. everything except the registration spec).
export const SIGNIN_USER_ID = "e2e-user-2";
export const SIGNIN_USERNAME = "e2esignin";
export const SIGNIN_TELEGRAM_CHAT_ID = "88888";
export const SIGNIN_PASSWORD = "e2e-signin-password";
