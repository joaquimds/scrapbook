import ngrok from "@ngrok/ngrok";
import { env } from "~/server/env.ts";
import { logger } from "~/server/utils/logger.ts";

// In dev we open an ngrok tunnel to the local HTTP port at startup so the
// Telegram webhook can reach the local server. The tunnel URL replaces
// `PUBLIC_BASE_URL` for the lifetime of the process; in production we trust
// the env var.

let publicBaseUrl = env.PUBLIC_BASE_URL;

export const getPublicBaseUrl = (): string => publicBaseUrl;

export async function startPublicTunnel(localPort: number): Promise<void> {
	if (env.NODE_ENV !== "development") {
		logger.info({ publicBaseUrl }, "using PUBLIC_BASE_URL from environment");
		return;
	}
	if (!env.NGROK_AUTHTOKEN) {
		logger.warn(
			"NGROK_AUTHTOKEN not set — skipping ngrok tunnel. Webhooks reachable only on localhost.",
		);
		return;
	}
	const listener = await ngrok.forward({
		addr: localPort,
		authtoken: env.NGROK_AUTHTOKEN,
	});
	const url = listener.url();
	if (!url) {
		logger.error("ngrok tunnel started but returned no URL");
		return;
	}
	publicBaseUrl = url;
	logger.info({ publicBaseUrl }, "ngrok tunnel ready");
}
