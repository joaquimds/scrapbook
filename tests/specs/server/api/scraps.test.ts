import { describe, expect, it } from "vitest";
import { createPerson } from "~/server/repositories/people.ts";
import { createScrap } from "~/server/repositories/scraps.ts";
import { req } from "~/tests/harness/app.ts";

describe("GET /api/scraps", () => {
	it("returns empty page when no scraps", async () => {
		const res = await req("GET", "/api/scraps");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.items).toEqual([]);
		expect(body.nextCursor).toBeNull();
	});

	it("lists scraps in descending creation order", async () => {
		await createScrap({ kind: "quote", body: "first", source: "manual" });
		await createScrap({ kind: "quote", body: "second", source: "manual" });
		const res = await req("GET", "/api/scraps");
		const { items } = await res.json();
		expect(items).toHaveLength(2);
		expect(items[0].body).toBe("second");
		expect(items[1].body).toBe("first");
	});

	it("paginates with cursor", async () => {
		await createScrap({ kind: "quote", body: "a", source: "manual" });
		await createScrap({ kind: "quote", body: "b", source: "manual" });
		await createScrap({ kind: "quote", body: "c", source: "manual" });

		const res1 = await req("GET", "/api/scraps?limit=2");
		expect(res1.status).toBe(200);
		const page1 = await res1.json();
		expect(page1.items).toHaveLength(2);
		expect(page1.nextCursor).not.toBeNull();

		const res2 = await req("GET", `/api/scraps?limit=2&cursor=${page1.nextCursor}`);
		const page2 = await res2.json();
		expect(page2.items).toHaveLength(1);
		expect(page2.nextCursor).toBeNull();
	});

	it("returns 400 on invalid limit", async () => {
		const res = await req("GET", "/api/scraps?limit=0");
		expect(res.status).toBe(400);
	});

	it("hydrates peopleIds on listed scraps", async () => {
		const person = await createPerson({ name: "Alice" });
		await createScrap({ kind: "quote", body: "hello", source: "manual", peopleIds: [person.id] });
		const res = await req("GET", "/api/scraps");
		const { items } = await res.json();
		expect(items[0].peopleIds).toEqual([person.id]);
	});
});

describe("GET /api/scraps/:id", () => {
	it("returns scrap by id", async () => {
		const scrap = await createScrap({ kind: "quote", body: "test", source: "manual" });
		const res = await req("GET", `/api/scraps/${scrap.id}`);
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.id).toBe(scrap.id);
		expect(body.body).toBe("test");
	});

	it("returns 404 for missing scrap", async () => {
		const res = await req("GET", "/api/scraps/nonexistent");
		expect(res.status).toBe(404);
	});
});

describe("POST /api/scraps", () => {
	it("creates a quote scrap", async () => {
		const res = await req("POST", "/api/scraps", {
			body: { kind: "quote", body: "hello world", peopleIds: [] },
		});
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.kind).toBe("quote");
		expect(body.body).toBe("hello world");
		expect(body.source).toBe("manual");
	});

	it("creates a scrap with peopleIds", async () => {
		const person = await createPerson({ name: "Bob" });
		const res = await req("POST", "/api/scraps", {
			body: { kind: "quote", body: "tagged", peopleIds: [person.id] },
		});
		expect(res.status).toBe(201);
		const body = await res.json();
		expect(body.peopleIds).toEqual([person.id]);
	});

	it("returns 400 on invalid body", async () => {
		const res = await req("POST", "/api/scraps", { body: { kind: "invalid_kind", body: "x" } });
		expect(res.status).toBe(400);
	});
});
