import "dotenv/config";
import { db } from "~/server/db/connection.ts";
import { createPerson, setFeaturedScrap } from "~/server/repositories/people.ts";
import { createScrap } from "~/server/repositories/scraps.ts";
import { saveOriginal } from "~/server/services/media-storage/index.ts";
import { logger } from "~/server/utils/logger.ts";
import { newId } from "~/shared/utils/id.ts";

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

async function fetchBuffer(url: string): Promise<Buffer> {
	const res = await fetch(url, { redirect: "follow" });
	if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
	return Buffer.from(await res.arrayBuffer());
}

async function main() {
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
		const buffer = await fetchBuffer(`https://i.pravatar.cc/600?img=${avatarId}`);
		const id = newId();
		const { mediaUrl } = await saveOriginal({ id, buffer, ext: "jpg" });
		const scrap = await createScrap({
			id,
			kind: "photo",
			body: `${name} in their natural habitat`,
			mediaUrl,
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
		const buffer = await fetchBuffer(
			`https://picsum.photos/seed/${encodeURIComponent(photo.seed)}/800/600`,
		);
		const id = newId();
		const { mediaUrl } = await saveOriginal({ id, buffer, ext: "jpg" });
		await createScrap({
			id,
			kind: "photo",
			body: photo.body,
			mediaUrl,
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
