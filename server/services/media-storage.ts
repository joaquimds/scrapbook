import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { env } from "~/server/env.ts";

// Originals live at scraps/<YYYY>/<MM>/<id>.<ext> relative to STORAGE_ROOT.
// The frontend reads them via `/media/<relativePath>` (see routes/media.ts).

export async function saveOriginal(opts: {
	id: string;
	buffer: Buffer;
	ext: string;
	createdAt?: Date;
}): Promise<string> {
	const date = opts.createdAt ?? new Date();
	const yyyy = String(date.getUTCFullYear());
	const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
	const ext = opts.ext.replace(/^\./, "").toLowerCase() || "bin";
	const relativePath = join("scraps", yyyy, mm, `${opts.id}.${ext}`);
	const absolute = join(env.STORAGE_ROOT, relativePath);
	await mkdir(dirname(absolute), { recursive: true });
	await writeFile(absolute, opts.buffer);
	return relativePath;
}
