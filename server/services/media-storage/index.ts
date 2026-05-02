import { env } from "~/server/env.ts";
import * as cloudinaryDriver from "~/server/services/media-storage/cloudinary.ts";
import * as localDriver from "~/server/services/media-storage/local.ts";

const driver = env.MEDIA_DRIVER === "cloudinary" ? cloudinaryDriver : localDriver;

export const saveOriginal = driver.saveOriginal;

// Dispatches to the right driver by URL scheme so we can clean up assets
// regardless of which driver wrote them (e.g. mid-deployment switches).
export async function deleteOriginal(mediaUrl: string): Promise<void> {
	if (mediaUrl.startsWith("file://")) {
		await localDriver.deleteOriginal(mediaUrl);
		return;
	}
	await cloudinaryDriver.deleteOriginal(mediaUrl);
}
