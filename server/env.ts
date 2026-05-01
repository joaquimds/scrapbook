import { z } from "zod";

const EnvSchema = z.object({
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	HOST: z.string().default("127.0.0.1"),
	PORT: z.coerce.number().int().positive().default(3000),
	DATABASE_URL: z.string().url().default("postgres://localhost:5432/scrapbook"),
	STORAGE_ROOT: z.string().default("./storage"),
	TELEGRAM_BOT_TOKEN: z.string().optional(),
	TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
	TELEGRAM_ALLOWED_CHAT_ID: z.string().optional(),
	NGROK_AUTHTOKEN: z.string().optional(),
	PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
	REMINDER_CRON: z.string().default("0 9 * * *"),
	REMINDER_COOLDOWN_DAYS: z.coerce.number().int().nonnegative().default(14),
	ALBUM_DEBOUNCE_MS: z.coerce.number().int().nonnegative().default(1500),
});

export const env = EnvSchema.parse(process.env);
export type Env = z.infer<typeof EnvSchema>;
