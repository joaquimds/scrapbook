import { deleteScraps, getRawMediaUrls } from "~/server/repositories/scraps.ts";
import { deleteOriginal } from "~/server/services/media-storage/index.ts";
import { logger } from "~/server/utils/logger.ts";

// Delete scraps along with their stored media assets. Media deletion is
// best-effort — a failure is logged but does not block the row delete, since
// orphaned files are far less harmful than scraps left in a broken half-deleted
// state.
export async function deleteScrapsWithMedia(userId: string, ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	const mediaUrls = await getRawMediaUrls(userId, ids);
	for (const url of mediaUrls) {
		try {
			await deleteOriginal(url);
		} catch (err) {
			logger.error({ err, url }, "failed to delete media asset");
		}
	}
	await deleteScraps(userId, ids);
}
