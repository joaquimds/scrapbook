import { afterEach, describe, expect, it, vi } from "vitest";

const uploadStream = vi.fn();
const destroy = vi.fn();

vi.mock("cloudinary", () => ({
	v2: {
		config: vi.fn(),
		uploader: { upload_stream: uploadStream, destroy },
	},
}));

afterEach(() => {
	uploadStream.mockReset();
	destroy.mockReset();
});

describe("cloudinary driver", () => {
	it("uploads buffer via upload_stream and returns secure_url", async () => {
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
			folder: "scrapboard/2024/05",
			resource_type: "image",
		});
	});

	it("deleteOriginal extracts public_id and calls uploader.destroy", async () => {
		destroy.mockResolvedValue({ result: "ok" });

		const { deleteOriginal } = await import("~/server/services/media-storage/cloudinary.ts");
		await deleteOriginal(
			"https://res.cloudinary.com/demo/image/upload/v1777719285/scrapboard/2026/05/abc.jpg",
		);

		expect(destroy).toHaveBeenCalledTimes(1);
		expect(destroy).toHaveBeenCalledWith("scrapboard/2026/05/abc", {
			resource_type: "image",
			invalidate: true,
		});
	});

	it("deleteOriginal also handles URLs without a version segment", async () => {
		destroy.mockResolvedValue({ result: "ok" });

		const { deleteOriginal } = await import("~/server/services/media-storage/cloudinary.ts");
		await deleteOriginal("https://res.cloudinary.com/demo/image/upload/scrapboard/2026/05/abc.jpg");

		expect(destroy).toHaveBeenCalledWith(
			"scrapboard/2026/05/abc",
			expect.objectContaining({ resource_type: "image" }),
		);
	});

	it("deleteOriginal is a no-op for URLs that don't match the expected shape", async () => {
		const { deleteOriginal } = await import("~/server/services/media-storage/cloudinary.ts");
		await deleteOriginal("https://example.com/not-cloudinary/abc.jpg");

		expect(destroy).not.toHaveBeenCalled();
	});
});
