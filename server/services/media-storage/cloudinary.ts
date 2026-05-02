import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { env } from "~/server/env.ts";

// Cloudinary auto-configures from CLOUDINARY_URL env at module load.
// We pass the buffer via upload_stream to avoid base64 inflation.

let configured = false;
function ensureConfigured(): void {
	if (configured) return;
	if (!env.CLOUDINARY_URL) {
		throw new Error("CLOUDINARY_URL is required when MEDIA_DRIVER=cloudinary");
	}
	cloudinary.config({ secure: true });
	configured = true;
}

export async function saveOriginal(opts: {
	id: string;
	buffer: Buffer;
	ext: string;
	createdAt?: Date;
}): Promise<{ mediaUrl: string }> {
	ensureConfigured();
	const date = opts.createdAt ?? new Date();
	const yyyy = String(date.getUTCFullYear());
	const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
	const result = await new Promise<UploadApiResponse>((resolveUpload, rejectUpload) => {
		const stream = cloudinary.uploader.upload_stream(
			{
				public_id: opts.id,
				folder: `scrapbook/${yyyy}/${mm}`,
				resource_type: "image",
			},
			(err, res) => {
				if (err || !res) rejectUpload(err ?? new Error("Cloudinary upload returned no result"));
				else resolveUpload(res);
			},
		);
		stream.end(opts.buffer);
	});
	return { mediaUrl: result.secure_url };
}

// Extracts the Cloudinary public_id from a delivery URL produced by saveOriginal,
// e.g. https://res.cloudinary.com/<cloud>/image/upload/v123/scrapbook/2026/05/abc.jpg
// → "scrapbook/2026/05/abc".
function publicIdFromUrl(mediaUrl: string): string | null {
	const match = mediaUrl.match(/\/image\/upload\/(?:v\d+\/)?(.+)$/);
	if (!match?.[1]) return null;
	return match[1].replace(/\.[^./]+$/, "");
}

export async function deleteOriginal(mediaUrl: string): Promise<void> {
	ensureConfigured();
	const publicId = publicIdFromUrl(mediaUrl);
	if (!publicId) return;
	await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
}
