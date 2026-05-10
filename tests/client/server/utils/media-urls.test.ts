import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { env } from "~/server/env.ts";
import { toClientMediaUrl, toClientThumbnailUrl } from "~/server/utils/media-urls.ts";

describe("toClientMediaUrl", () => {
	it("rewrites file:// URLs to /media/<relative>", () => {
		const fileUrl = pathToFileURL(`${env.STORAGE_ROOT}/scraps/2024/01/abc.jpg`).toString();
		expect(toClientMediaUrl(fileUrl)).toBe("/media/scraps/2024/01/abc.jpg");
	});

	it("passes Cloudinary URLs through unchanged", () => {
		const url = "https://res.cloudinary.com/demo/image/upload/v1/abc.jpg";
		expect(toClientMediaUrl(url)).toBe(url);
	});
});

describe("toClientThumbnailUrl", () => {
	it("derives /media/thumbnails/<id>.webp from a file:// original", () => {
		const fileUrl = pathToFileURL(`${env.STORAGE_ROOT}/scraps/2024/01/abc.jpg`).toString();
		expect(toClientThumbnailUrl(fileUrl)).toBe("/media/thumbnails/abc.webp");
	});

	it("inserts a Cloudinary transformation segment for HTTPS URLs", () => {
		expect(toClientThumbnailUrl("https://res.cloudinary.com/demo/image/upload/v1/abc.jpg")).toBe(
			"https://res.cloudinary.com/demo/image/upload/w_600,q_80,f_webp/v1/abc.jpg",
		);
	});
});
