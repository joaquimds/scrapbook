import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, PageQuerySchema } from "~/server/utils/pagination.ts";

describe("encodeCursor / decodeCursor round-trip", () => {
	it("round-trips a cursor", () => {
		const date = new Date("2024-06-15T12:00:00.000Z");
		const original = { createdAt: date, id: "abc123" };
		const encoded = encodeCursor(original);
		const decoded = decodeCursor(encoded);
		expect(decoded?.createdAt.toISOString()).toBe(date.toISOString());
		expect(decoded?.id).toBe("abc123");
	});

	it("returns undefined for undefined input", () => {
		expect(decodeCursor(undefined)).toBeUndefined();
	});

	it("returns undefined for invalid base64", () => {
		expect(decodeCursor("not-valid-base64!!!")).toBeUndefined();
	});

	it("returns undefined for valid base64 but invalid JSON", () => {
		const bad = Buffer.from("{invalid}").toString("base64url");
		expect(decodeCursor(bad)).toBeUndefined();
	});

	it("returns undefined for valid JSON missing required fields", () => {
		const bad = Buffer.from(JSON.stringify({ foo: "bar" })).toString("base64url");
		expect(decodeCursor(bad)).toBeUndefined();
	});
});

describe("PageQuerySchema", () => {
	it("accepts valid limit", () => {
		const result = PageQuerySchema.safeParse({ limit: "50" });
		expect(result.success).toBe(true);
		expect(result.success && result.data.limit).toBe(50);
	});

	it("uses default limit of 200", () => {
		const result = PageQuerySchema.safeParse({});
		expect(result.success && result.data.limit).toBe(200);
	});

	it("rejects limit below 1", () => {
		expect(PageQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
	});

	it("rejects limit above 500", () => {
		expect(PageQuerySchema.safeParse({ limit: "501" }).success).toBe(false);
	});

	it("accepts an optional cursor string", () => {
		const result = PageQuerySchema.safeParse({ cursor: "abc123" });
		expect(result.success && result.data.cursor).toBe("abc123");
	});
});
