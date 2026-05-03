import { describe, expect, it } from "vitest";
import { createPerson } from "~/server/repositories/people.ts";
import { createScrap } from "~/server/repositories/scraps.ts";
import { req } from "~/tests/harness/app.ts";
import { TEST_USER_ID } from "~/tests/harness/db.ts";

describe("GET /api/people", () => {
	it("returns empty page", async () => {
		const res = await req("GET", "/api/people");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.items).toEqual([]);
		expect(body.nextCursor).toBeNull();
	});

	it("lists people in descending creation order", async () => {
		await createPerson(TEST_USER_ID, { name: "Alice" });
		await createPerson(TEST_USER_ID, { name: "Bob" });
		const res = await req("GET", "/api/people");
		const { items } = await res.json();
		expect(items).toHaveLength(2);
		expect(items[0].name).toBe("Bob");
	});

	it("paginates with cursor", async () => {
		await createPerson(TEST_USER_ID, { name: "A" });
		await createPerson(TEST_USER_ID, { name: "B" });
		await createPerson(TEST_USER_ID, { name: "C" });

		const page1res = await req("GET", "/api/people?limit=2");
		const page1 = await page1res.json();
		expect(page1.items).toHaveLength(2);
		expect(page1.nextCursor).not.toBeNull();

		const page2res = await req("GET", `/api/people?limit=2&cursor=${page1.nextCursor}`);
		const page2 = await page2res.json();
		expect(page2.items).toHaveLength(1);
		expect(page2.nextCursor).toBeNull();
	});
});

describe("GET /api/people/:id", () => {
	it("returns person by id", async () => {
		const person = await createPerson(TEST_USER_ID, { name: "Alice" });
		const res = await req("GET", `/api/people/${person.id}`);
		expect(res.status).toBe(200);
		expect((await res.json()).name).toBe("Alice");
	});

	it("returns 404 for missing person", async () => {
		const res = await req("GET", "/api/people/nonexistent");
		expect(res.status).toBe(404);
	});
});

describe("POST /api/people", () => {
	it("creates a person", async () => {
		const res = await req("POST", "/api/people", { body: { name: "Charlie" } });
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.name).toBe("Charlie");
		expect(body.id).toBeTruthy();
	});

	it("returns 400 on empty name", async () => {
		const res = await req("POST", "/api/people", { body: { name: "" } });
		expect(res.status).toBe(400);
	});
});

describe("PATCH /api/people/:id", () => {
	it("sets featuredScrapId", async () => {
		const person = await createPerson(TEST_USER_ID, { name: "Dave" });
		const scrap = await createScrap(TEST_USER_ID, { kind: "photo", body: null, source: "manual" });
		const res = await req("PATCH", `/api/people/${person.id}`, {
			body: { featuredScrapId: scrap.id },
		});
		expect(res.status).toBe(200);
		expect((await res.json()).featuredScrapId).toBe(scrap.id);
	});

	it("clears featuredScrapId to null", async () => {
		const person = await createPerson(TEST_USER_ID, { name: "Eve" });
		const scrap = await createScrap(TEST_USER_ID, { kind: "photo", body: null, source: "manual" });
		await req("PATCH", `/api/people/${person.id}`, { body: { featuredScrapId: scrap.id } });
		const res = await req("PATCH", `/api/people/${person.id}`, { body: { featuredScrapId: null } });
		expect(res.status).toBe(200);
		expect((await res.json()).featuredScrapId).toBeNull();
	});

	it("returns 404 for missing person", async () => {
		const res = await req("PATCH", "/api/people/nonexistent", { body: {} });
		expect(res.status).toBe(404);
	});
});
