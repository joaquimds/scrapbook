import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "~/server/db/connection.ts";
import { env } from "~/server/env.ts";
import { createPerson, setFeaturedScrap } from "~/server/repositories/people.ts";
import { createScrap } from "~/server/repositories/scraps.ts";
import { logger } from "~/server/utils/logger.ts";

const PEOPLE: Array<{ name: string; avatarId: number }> = [
	{ name: "Paul", avatarId: 12 },
	{ name: "James", avatarId: 33 },
	{ name: "Linda", avatarId: 5 },
];

const QUOTES: Array<{ body: string; tags: string[] }> = [
	{ body: "the best ideas are usually the obvious ones", tags: ["Paul"] },
	{ body: "a friend is someone who knows the song in your heart", tags: ["James"] },
	{ body: "stop being so hard on yourself", tags: ["Linda"] },
	{ body: "we should start a podcast (we won't)", tags: ["Paul", "James"] },
	{ body: "linda and james arguing about coriander, again", tags: ["Linda", "James"] },
	{ body: "all three of you in one room is dangerous", tags: ["Paul", "James", "Linda"] },
];

const PHOTOS: Array<{ seed: string; body: string; tags: string[] }> = [
	{ seed: "paul-coffee", body: "paul's third coffee of the morning", tags: ["Paul"] },
	{ seed: "james-guitar", body: "james at the open mic", tags: ["James"] },
	{ seed: "linda-garden", body: "linda's tomatoes finally came in", tags: ["Linda"] },
	{ seed: "paul-james-hike", body: "paul and james on the ridge walk", tags: ["Paul", "James"] },
	{ seed: "all-three-dinner", body: "dinner at linda's", tags: ["Paul", "James", "Linda"] },
];

async function downloadHeadshot(avatarId: number, dest: string): Promise<void> {
	const url = `https://i.pravatar.cc/600?img=${avatarId}`;
	const res = await fetch(url, { redirect: "follow" });
	if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	await writeFile(dest, buf);
}

async function downloadStockPhoto(seed: string, dest: string): Promise<void> {
	const url = `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/600`;
	const res = await fetch(url, { redirect: "follow" });
	if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
	const buf = Buffer.from(await res.arrayBuffer());
	await writeFile(dest, buf);
}

async function main() {
	await mkdir(env.STORAGE_ROOT, { recursive: true });

	logger.info("seeding people");
	const people = new Map<string, { id: string; avatarId: number }>();
	for (const { name, avatarId } of PEOPLE) {
		const p = await createPerson({ name });
		people.set(name, { id: p.id, avatarId });
	}

	logger.info("downloading + creating featured photo scraps");
	for (const { name, avatarId } of PEOPLE) {
		const person = people.get(name);
		if (!person) continue;
		const filename = `${person.id}.jpg`;
		const fullPath = path.join(env.STORAGE_ROOT, filename);
		await downloadHeadshot(avatarId, fullPath);

		const scrap = await createScrap({
			kind: "photo",
			body: `${name} in their natural habitat`,
			mediaPath: filename,
			thumbnailPath: filename,
			source: "manual",
			peopleIds: [person.id],
		});
		await setFeaturedScrap(person.id, scrap.id);
	}

	logger.info("downloading + creating photo scraps");
	for (const photo of PHOTOS) {
		const peopleIds = photo.tags
			.map((n) => people.get(n)?.id)
			.filter((id): id is string => Boolean(id));
		const filename = `${photo.seed}.jpg`;
		const fullPath = path.join(env.STORAGE_ROOT, filename);
		await downloadStockPhoto(photo.seed, fullPath);
		await createScrap({
			kind: "photo",
			body: photo.body,
			mediaPath: filename,
			thumbnailPath: filename,
			source: "manual",
			peopleIds,
		});
	}

	logger.info("creating quote scraps");
	for (const q of QUOTES) {
		const peopleIds = q.tags
			.map((n) => people.get(n)?.id)
			.filter((id): id is string => Boolean(id));
		await createScrap({
			kind: "quote",
			body: q.body,
			source: "manual",
			peopleIds,
		});
	}

	logger.info("seed complete");
	await db.destroy();
}

main().catch((err) => {
	logger.error({ err }, "seed failed");
	process.exit(1);
});
