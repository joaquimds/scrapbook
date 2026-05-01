import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { env } from "~/server/env.ts";

// Thumbnails are 600px max edge webp at quality 80. Stored flat under
// thumbnails/<id>.webp — no date-shard, since lookups are always by scrap id.

export async function makeThumbnail(opts: { id: string; buffer: Buffer }): Promise<string> {
	const relativePath = join("thumbnails", `${opts.id}.webp`);
	const absolute = join(env.STORAGE_ROOT, relativePath);
	await mkdir(dirname(absolute), { recursive: true });
	await sharp(opts.buffer)
		.rotate()
		.resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
		.webp({ quality: 80 })
		.toFile(absolute);
	return relativePath;
}
