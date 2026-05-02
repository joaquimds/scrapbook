import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { env } from "~/server/env.ts";
import { makeThumbnail } from "~/server/services/thumbnails.ts";

// Originals live at scraps/<YYYY>/<MM>/<id>.<ext> relative to STORAGE_ROOT.
// Returned as a file:// URL pointing at the absolute path.

export async function saveOriginal(opts: {
	id: string;
	buffer: Buffer;
	ext: string;
	createdAt?: Date;
}): Promise<{ mediaUrl: string }> {
	const date = opts.createdAt ?? new Date();
	const yyyy = String(date.getUTCFullYear());
	const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
	const ext = opts.ext.replace(/^\./, "").toLowerCase() || "bin";
	const relativePath = join("scraps", yyyy, mm, `${opts.id}.${ext}`);
	const absolute = resolve(env.STORAGE_ROOT, relativePath);
	await mkdir(dirname(absolute), { recursive: true });
	await writeFile(absolute, opts.buffer);
	await makeThumbnail({ id: opts.id, buffer: opts.buffer });
	return { mediaUrl: pathToFileURL(absolute).toString() };
}
