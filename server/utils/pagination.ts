import { z } from "zod";

const CursorSchema = z.object({
	createdAt: z.coerce.date(),
	id: z.string(),
});
export type Cursor = z.infer<typeof CursorSchema>;

export function encodeCursor(cursor: Cursor): string {
	return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(value: string | undefined): Cursor | undefined {
	if (!value) return undefined;
	try {
		const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
		return CursorSchema.parse(parsed);
	} catch {
		return undefined;
	}
}

export const PageQuerySchema = z.object({
	cursor: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(500).default(200),
});
export type PageQuery = z.infer<typeof PageQuerySchema>;
