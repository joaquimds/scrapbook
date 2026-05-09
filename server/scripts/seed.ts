import "dotenv/config";
import { db } from "~/server/db/connection.ts";
import {
	createPerson,
	setFeaturedScrap,
	updatePersonPosition,
} from "~/server/repositories/people.ts";
import { createScrap, updateScrapPosition } from "~/server/repositories/scraps.ts";
import { createUser, findUserByUsername, setUserPassword } from "~/server/repositories/users.ts";
import { deleteOriginal, saveOriginal } from "~/server/services/media-storage/index.ts";
import { logger } from "~/server/utils/logger.ts";
import { newId } from "~/shared/utils/id.ts";

type Connectivity = "dense" | "sparse" | "none";
type Fixed = "none" | "majority" | "all";

interface Args {
	connectivity: Connectivity;
	fixed: Fixed;
	people: number;
	scraps: number;
	username: string;
}

function parseArgs(): Args {
	const argv = process.argv.slice(2);
	const out: Args = {
		connectivity: "dense",
		fixed: "majority",
		people: 10,
		scraps: 20,
		username: "seed",
	};
	for (let i = 0; i < argv.length; i++) {
		const flag = argv[i];
		const value = argv[i + 1];
		if (flag === "--username") {
			if (!value) throw new Error("--username requires a value");
			out.username = value;
			i++;
		} else if (flag === "--connectivity") {
			if (value !== "dense" && value !== "sparse" && value !== "none") {
				throw new Error(`--connectivity must be dense|sparse|none, got ${value}`);
			}
			out.connectivity = value;
			i++;
		} else if (flag === "--fixed") {
			if (value !== "none" && value !== "majority" && value !== "all") {
				throw new Error(`--fixed must be none|majority|all, got ${value}`);
			}
			out.fixed = value;
			i++;
		} else if (flag === "--people") {
			out.people = Number.parseInt(value ?? "", 10);
			if (!Number.isFinite(out.people) || out.people <= 0) {
				throw new Error(`--people must be a positive integer`);
			}
			i++;
		} else if (flag === "--scraps") {
			out.scraps = Number.parseInt(value ?? "", 10);
			if (!Number.isFinite(out.scraps) || out.scraps < 0) {
				throw new Error(`--scraps must be a non-negative integer`);
			}
			i++;
		} else {
			throw new Error(`unknown flag: ${flag}`);
		}
	}
	return out;
}

const FIRST_NAMES = [
	"Paul",
	"James",
	"Linda",
	"Maya",
	"Theo",
	"Iris",
	"Otis",
	"Nora",
	"Cleo",
	"Felix",
	"Hugo",
	"Ada",
	"Rumi",
	"Sasha",
	"Wren",
	"Ezra",
	"Juno",
	"Kai",
	"Luna",
	"Milo",
	"Nico",
	"Opal",
	"Pia",
	"Quinn",
	"Remy",
	"Stella",
	"Tomás",
	"Una",
	"Vera",
	"Wes",
	"Xan",
	"Yara",
	"Zane",
	"Anya",
	"Bram",
	"Cora",
	"Dax",
	"Esme",
	"Finn",
	"Gia",
	"Hari",
	"Ines",
	"Joss",
	"Kira",
	"Leo",
	"Mira",
	"Niko",
	"Orla",
	"Pax",
	"Reza",
];

const QUOTE_TEMPLATES = [
	"the best ideas are usually the obvious ones",
	"a friend is someone who knows the song in your heart",
	"stop being so hard on yourself",
	"we should start a podcast (we won't)",
	"arguing about coriander, again",
	"all of you in one room is dangerous",
	"never trust a quiet group chat",
	"writing this down so I don't forget",
];

const PHOTO_CAPTIONS = [
	"natural habitat",
	"third coffee of the morning",
	"the open mic",
	"tomatoes finally came in",
	"ridge walk weather",
	"dinner at the usual place",
	"the dog is involved somehow",
	"loud opinions about wallpaper",
	"someone please bring snacks",
	"wedding season again",
	"birthday in the back garden",
	"reminded me to call my mum",
	"on the train back",
	"sunday market haul",
	"that joke didn't land",
	"matching shoes by accident",
];

const QUOTE_COUNT = 8;
const PHOTO_DOWNLOAD_CONCURRENCY = 8;

async function fetchBuffer(url: string): Promise<Buffer> {
	const res = await fetch(url, { redirect: "follow" });
	if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
	return Buffer.from(await res.arrayBuffer());
}

async function reset(userId: string): Promise<void> {
	logger.info({ userId }, "deleting media originals for user");
	const mediaRows = await db
		.selectFrom("scraps")
		.select("mediaUrl")
		.where("userId", "=", userId)
		.where("mediaUrl", "is not", null)
		.execute();
	for (const row of mediaRows) {
		if (!row.mediaUrl) continue;
		try {
			await deleteOriginal(row.mediaUrl);
		} catch (err) {
			logger.warn({ err, mediaUrl: row.mediaUrl }, "failed to delete media original");
		}
	}
	logger.info({ userId }, "clearing user's rows");
	await db.deleteFrom("scraps").where("userId", "=", userId).execute();
	await db.deleteFrom("people").where("userId", "=", userId).execute();
}

async function ensureSeedUser(username: string): Promise<string> {
	const existing = await findUserByUsername(username);
	if (existing) return existing.id;
	const created = await createUser({ username, telegramChatId: `seed:${username}` });
	await setUserPassword(created.id, "seed-password");
	logger.info({ userId: created.id, username }, "created seed user (password: seed-password)");
	return created.id;
}

function pickName(seenNames: Set<string>, index: number): string {
	const base = FIRST_NAMES[index % FIRST_NAMES.length] ?? `Person${index}`;
	const round = Math.floor(index / FIRST_NAMES.length);
	const name = round === 0 ? base : `${base} ${"I".repeat(round + 1)}`;
	if (seenNames.has(name)) return `${name} ${index}`;
	seenNames.add(name);
	return name;
}

interface SeedPerson {
	id: string;
	name: string;
	clusterIdx: number;
	avatarId: number;
}

function pickRandom<T>(arr: T[]): T {
	const v = arr[Math.floor(Math.random() * arr.length)];
	if (v === undefined) throw new Error("pickRandom on empty array");
	return v;
}

function shuffle<T>(arr: T[]): T[] {
	const out = arr.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = out[i] as T;
		out[i] = out[j] as T;
		out[j] = tmp;
	}
	return out;
}

// Cluster layout: arrange cluster centroids in a roughly square grid in
// world space, with enough spacing that the force layout sees them as
// distinct islands when connectivity is sparse.
const CLUSTER_SPACING = 1200;
const MEMBER_JITTER = 220;

function clusterCenter(clusterIdx: number, totalClusters: number): { x: number; y: number } {
	const cols = Math.ceil(Math.sqrt(totalClusters));
	const col = clusterIdx % cols;
	const row = Math.floor(clusterIdx / cols);
	return {
		x: (col - (cols - 1) / 2) * CLUSTER_SPACING,
		y: (row - (cols - 1) / 2) * CLUSTER_SPACING,
	};
}

function jitter(): number {
	return (Math.random() - 0.5) * MEMBER_JITTER * 2;
}

async function main(): Promise<void> {
	const args = parseArgs();
	logger.info({ args }, "seeding");

	const userId = await ensureSeedUser(args.username);
	await reset(userId);

	const totalClusters =
		args.connectivity === "sparse" ? Math.max(2, Math.min(6, Math.round(args.people / 8))) : 1;

	const seenNames = new Set<string>();
	const people: SeedPerson[] = [];
	logger.info({ count: args.people }, "creating people");
	for (let i = 0; i < args.people; i++) {
		const name = pickName(seenNames, i);
		const clusterIdx = args.connectivity === "sparse" ? i % totalClusters : 0;
		const avatarId = ((i * 7) % 70) + 1; // pravatar ids run 1..70
		const created = await createPerson(userId, { name });
		people.push({ id: created.id, name, clusterIdx, avatarId });
	}

	logger.info("creating featured photo scraps");
	for (const person of people) {
		const buffer = await fetchBuffer(`https://i.pravatar.cc/600?img=${person.avatarId}`);
		const id = newId();
		const { mediaUrl } = await saveOriginal({ id, buffer, ext: "jpg" });
		const scrap = await createScrap(userId, {
			id,
			kind: "photo",
			body: `${person.name} in their natural habitat`,
			mediaUrl,
			source: "manual",
			peopleIds: [person.id],
		});
		await setFeaturedScrap(userId, person.id, scrap.id);
	}

	const peopleByCluster = new Map<number, SeedPerson[]>();
	for (const p of people) {
		const list = peopleByCluster.get(p.clusterIdx) ?? [];
		list.push(p);
		peopleByCluster.set(p.clusterIdx, list);
	}

	const tagsForIndex = (i: number): { peopleIds: string[]; clusterIdx: number } => {
		if (args.connectivity === "none") {
			return { peopleIds: [], clusterIdx: Math.floor(Math.random() * totalClusters) };
		}
		if (args.connectivity === "sparse") {
			const clusterIdx = i % totalClusters;
			const pool = peopleByCluster.get(clusterIdx) ?? [];
			const tagCount = Math.min(pool.length, 1 + Math.floor(Math.random() * 3));
			return {
				peopleIds: shuffle(pool)
					.slice(0, tagCount)
					.map((p) => p.id),
				clusterIdx,
			};
		}
		const tagCount = Math.min(people.length, 1 + Math.floor(Math.random() * 3));
		return {
			peopleIds: shuffle(people)
				.slice(0, tagCount)
				.map((p) => p.id),
			clusterIdx: 0,
		};
	};

	interface ScrapPlacement {
		id: string;
		clusterIdx: number;
	}
	const scrapPlacements: ScrapPlacement[] = [];

	const quoteCount = Math.min(QUOTE_COUNT, args.scraps);
	const photoCount = args.scraps - quoteCount;

	logger.info(
		{ count: photoCount, concurrency: PHOTO_DOWNLOAD_CONCURRENCY },
		"creating photo scraps",
	);
	let photoCursor = 0;
	const makePhoto = async (i: number): Promise<void> => {
		const { peopleIds, clusterIdx } = tagsForIndex(i);
		const seed = `seed-photo-${i}-${Math.random().toString(36).slice(2, 8)}`;
		const buffer = await fetchBuffer(
			`https://picsum.photos/seed/${encodeURIComponent(seed)}/800/600`,
		);
		const id = newId();
		const { mediaUrl } = await saveOriginal({ id, buffer, ext: "jpg" });
		const created = await createScrap(userId, {
			id,
			kind: "photo",
			body: pickRandom(PHOTO_CAPTIONS),
			mediaUrl,
			source: "manual",
			peopleIds,
		});
		scrapPlacements.push({ id: created.id, clusterIdx });
	};
	while (photoCursor < photoCount) {
		const batch: Promise<void>[] = [];
		for (let k = 0; k < PHOTO_DOWNLOAD_CONCURRENCY && photoCursor < photoCount; k++) {
			batch.push(makePhoto(photoCursor++));
		}
		await Promise.all(batch);
	}

	logger.info({ count: quoteCount }, "creating quote scraps");
	for (let i = 0; i < quoteCount; i++) {
		const { peopleIds, clusterIdx } = tagsForIndex(photoCount + i);
		const body = pickRandom(QUOTE_TEMPLATES);
		const created = await createScrap(userId, { kind: "quote", body, source: "manual", peopleIds });
		scrapPlacements.push({ id: created.id, clusterIdx });
	}

	if (args.fixed !== "none") {
		logger.info({ fixed: args.fixed }, "assigning positions");
		const fixedFraction = args.fixed === "all" ? 1 : 0.8;

		for (const person of people) {
			if (Math.random() > fixedFraction) continue;
			const center = clusterCenter(person.clusterIdx, totalClusters);
			await updatePersonPosition(userId, person.id, center.x + jitter(), center.y + jitter());
		}

		for (const placement of scrapPlacements) {
			if (Math.random() > fixedFraction) continue;
			const center = clusterCenter(placement.clusterIdx, totalClusters);
			await updateScrapPosition(userId, placement.id, center.x + jitter(), center.y + jitter());
		}
	}

	logger.info("seed complete");
	await db.destroy();
}

main().catch((err) => {
	logger.error({ err }, "seed failed");
	process.exit(1);
});
