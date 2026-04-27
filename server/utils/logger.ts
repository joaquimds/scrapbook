import { pino } from "pino";
import { env } from "~/server/env.ts";

// Single shared pino logger. In dev it pretty-prints; in prod it emits JSON.
// Never use `console.log` in server code — always import this logger.
export const logger = pino(
	env.NODE_ENV === "development"
		? {
				level: "debug",
				transport: {
					target: "pino-pretty",
					options: { colorize: true, translateTime: "HH:MM:ss.l" },
				},
			}
		: { level: "info" },
);
