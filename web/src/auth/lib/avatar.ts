import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

export const AVATAR_BUCKET = "organization-assets";
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Crops to the centre square and scales down, so a phone photo becomes a few dozen kilobytes (the bucket allows 2 MB). */
export async function resizeToSquare(file: File, size = 256): Promise<Blob> {
  if (!AVATAR_TYPES.includes(file.type)) throw new Error("Choose a JPG, PNG or WebP image.");
  if (file.size > AVATAR_MAX_BYTES) throw new Error("That image is larger than 5 MB.");
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("That image could not be read."); });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser cannot process images.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("That image could not be processed."))), "image/jpeg", 0.88));
}

/** A picture you can put in an <img>: demo pictures are data URLs, real ones are private files that need a short-lived signed link. */
export function useAvatarUrl(path: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(path?.startsWith("data:") ? path : null);
  useEffect(() => {
    if (!path) { setUrl(null); return undefined; }
    if (path.startsWith("data:")) { setUrl(path); return undefined; }
    if (!isSupabaseConfigured) { setUrl(null); return undefined; }
    let cancelled = false;
    supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 3600).then(({ data }) => { if (!cancelled) setUrl(data?.signedUrl ?? null); });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}
