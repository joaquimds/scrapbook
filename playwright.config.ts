import { defineConfig, devices } from "@playwright/test";

const E2E_DB_NAME = "scrapboard_test_e2e";
const E2E_VITE_PORT = 5273;
const E2E_SERVER_PORT = 3030;
const E2E_BASE_URL = `http://127.0.0.1:${E2E_VITE_PORT}`;

const baseTestDbUrl = process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/scrapboard_test";
const e2eDbUrl = (() => {
	const u = new URL(baseTestDbUrl);
	u.pathname = `/${E2E_DB_NAME}`;
	return u.toString();
})();

// Surface the e2e DB URL to the spawned dev server. We can't pass it via
// `webServer.env` alone because globalSetup runs first and computes the same
// value — keep them in lock-step via an env var.
process.env.E2E_DATABASE_URL = e2eDbUrl;
process.env.E2E_BASE_URL = E2E_BASE_URL;

export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: /.*\.spec\.ts$/,
	fullyParallel: false,
	workers: 1,
	reporter: "list",
	timeout: 10_000,
	expect: { timeout: 10_000 },
	globalSetup: "./tests/e2e/global-setup.ts",
	globalTeardown: "./tests/e2e/global-teardown.ts",
	use: {
		baseURL: E2E_BASE_URL,
		trace: "retain-on-failure",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: "npm run dev",
		url: E2E_BASE_URL,
		reuseExistingServer: false,
		timeout: 120_000,
		stdout: "pipe",
		stderr: "pipe",
		env: {
			NODE_ENV: "test",
			DATABASE_URL: e2eDbUrl,
			STORAGE_ROOT: "./tests/.tmp-e2e-storage",
			MEDIA_DRIVER: "local",
			SESSION_SECRET: "e2e-session-secret-e2e-session-secret",
			INVITE_CODE: "e2e-invite-code",
			PUBLIC_BASE_URL: E2E_BASE_URL,
			PORT: String(E2E_SERVER_PORT),
			VITE_PORT: String(E2E_VITE_PORT),
			VITE_HOST: "127.0.0.1",
			VITE_API_PROXY_TARGET: `http://127.0.0.1:${E2E_SERVER_PORT}`,
			// Inert telegram + tunnel: we never want the e2e dev server to call
			// the real Telegram API or open an ngrok tunnel.
			TELEGRAM_BOT_TOKEN: "",
			NGROK_AUTHTOKEN: "",
		},
	},
});
