import { z } from "zod";

const EnvSchema = z
	.object({
		NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
		HOST: z.string().default("127.0.0.1"),
		PORT: z.coerce.number().int().positive().default(3000),
		DATABASE_URL: z.url().default("postgres://localhost:5432/scrapboard"),
		STORAGE_ROOT: z.string().default("./storage"),
		MEDIA_DRIVER: z.enum(["local", "cloudinary"]).default("local"),
		CLOUDINARY_URL: z.string().optional(),
		SESSION_SECRET: z.string().min(32),
		INVITE_CODE: z.string().min(1),
		TELEGRAM_BOT_TOKEN: z.string().optional(),
		TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
		NGROK_AUTHTOKEN: z.string().optional(),
		PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
		REMINDER_CRON: z.string().default("0 9 * * *"),
		REMINDER_COOLDOWN_DAYS: z.coerce.number().int().nonnegative().default(14),
		ALBUM_DEBOUNCE_MS: z.coerce.number().int().nonnegative().default(1500),
	})
	.refine((e) => e.MEDIA_DRIVER !== "cloudinary" || Boolean(e.CLOUDINARY_URL), {
		message: "CLOUDINARY_URL is required when MEDIA_DRIVER=cloudinary",
		path: ["CLOUDINARY_URL"],
	});

export const env = EnvSchema.parse(process.env);
export type Env = z.infer<typeof EnvSchema>;
