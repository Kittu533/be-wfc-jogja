import fs from "node:fs";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import { getSupabaseAdmin } from "../config/supabase";
import { HttpError } from "../utils/http-error";

export async function createImageUploadResponse(req: Request) {
  if (!req.file) {
    throw new HttpError(400, "Image file is required");
  }

  const supabase = getSupabaseAdmin();
  const extension = mimeToExtension(req.file.mimetype);
  const finalName = `places/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
  const fileBuffer = await fs.promises.readFile(req.file.path);
  const { error } = await supabase.storage
    .from(env.supabaseStorageBucket)
    .upload(finalName, fileBuffer, {
      contentType: req.file.mimetype,
      cacheControl: "31536000",
      upsert: false,
    });

  await fs.promises.unlink(req.file.path).catch(() => undefined);

  if (error) {
    throw new HttpError(500, `Supabase upload failed: ${error.message}`);
  }

  const { data } = supabase.storage
    .from(env.supabaseStorageBucket)
    .getPublicUrl(finalName);

  return {
    url: data.publicUrl,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    width: null,
    height: null,
  };
}

function mimeToExtension(mimeType: string): string {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";

  return ".jpg";
}
