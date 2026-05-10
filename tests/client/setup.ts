import { beforeEach, vi } from "vitest";
import { seedTestUser, truncateAll } from "~/tests/client/harness/db.ts";

vi.mock("~/server/services/telegram.ts", () => ({
	sendTelegramMessage: vi.fn().mockResolvedValue(undefined),
	sendTelegramPhoto: vi.fn().mockResolvedValue(undefined),
	setTelegramWebhook: vi.fn().mockResolvedValue(undefined),
	downloadTelegramFile: vi.fn().mockImplementation(async () => {
		const sharp = (await import("sharp")).default;
		const buffer = await sharp({
			create: { width: 100, height: 100, channels: 3, background: { r: 100, g: 149, b: 237 } },
		})
			.jpeg()
			.toBuffer();
		return { buffer, ext: "jpg" };
	}),
}));

beforeEach(async () => {
	await truncateAll();
	await seedTestUser();
	vi.clearAllMocks();
});
