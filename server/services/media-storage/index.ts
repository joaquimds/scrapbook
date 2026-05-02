import { env } from "~/server/env.ts";
import * as cloudinaryDriver from "~/server/services/media-storage/cloudinary.ts";
import * as localDriver from "~/server/services/media-storage/local.ts";

const driver = env.MEDIA_DRIVER === "cloudinary" ? cloudinaryDriver : localDriver;

export const saveOriginal = driver.saveOriginal;
