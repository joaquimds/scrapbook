import { afterEach, describe, expect, it, vi } from "vitest";

const uploadStream = vi.fn();

vi.mock("cloudinary", () => ({
	v2: {
		config: vi.fn(),
		uploader: { upload_stream: uploadStream },
	},
}));

const ORIGINAL_DRIVER = process.env.MEDIA_DRIVER;
const ORIGINAL_URL = process.env.CLOUDINARY_URL;

afterEach(() => {
	process.env.MEDIA_DRIVER = ORIGINAL_DRIVER;
	process.env.CLOUDINARY_URL = ORIGINAL_URL;
	uploadStream.mockReset();
});

describe("cloudinary driver", () => {
	it("uploads buffer via upload_stream and returns secure_url", async () => {
		process.env.CLOUDINARY_URL = "cloudinary://k:s@demo";
		uploadStream.mockImplementation((_opts, cb) => ({
			end: (buf: Buffer) => {
				cb(null, {
					secure_url: "https://res.cloudinary.com/demo/image/upload/v1/scraps/2024/05/abc.jpg",
					public_id: "scraps/2024/05/abc",
				});
				return buf;
			},
		}));

		const { saveOriginal } = await import("~/server/services/media-storage/cloudinary.ts");
		const result = await saveOriginal({
			id: "abc",
			buffer: Buffer.from("img"),
			ext: "jpg",
			createdAt: new Date(Date.UTC(2024, 4, 1)),
		});

		expect(result.mediaUrl).toBe(
			"https://res.cloudinary.com/demo/image/upload/v1/scraps/2024/05/abc.jpg",
		);
		expect(uploadStream).toHaveBeenCalledTimes(1);
		const opts = uploadStream.mock.calls[0]?.[0];
		expect(opts).toMatchObject({
			public_id: "abc",
			folder: "scrapbook/2024/05",
			resource_type: "image",
		});
	});
});
