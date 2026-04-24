import { prepareImageFileForUpload } from "./imagePrep.js";
import { buildCloudinaryTransformedUrl, buildCloudinarySrcSetLimit, parseCloudinaryPublicIdFromUrl, buildAvatarDisplayUrl, POST_DETAIL_SRC_WIDTHS, LISTING_HERO_SRC_WIDTHS, buildResponsiveLimitImageProps, buildForumFeedImageProps, buildForumPostDetailImageProps, buildListingHeroImageProps } from "./cloudinaryDelivery.js";

export {
  buildCloudinaryTransformedUrl,
  buildCloudinarySrcSetLimit,
  parseCloudinaryPublicIdFromUrl,
  buildAvatarDisplayUrl,
  POST_DETAIL_SRC_WIDTHS,
  LISTING_HERO_SRC_WIDTHS,
  buildResponsiveLimitImageProps,
  buildForumFeedImageProps,
  buildForumPostDetailImageProps,
  buildListingHeroImageProps,
};

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validatePostImageFile(file) {
  if (!file) return { ok: false, error: "Manjka datoteka." };
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: "Dovoljeni so samo JPG, PNG ali WEBP." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Slika je prevelika (max ~2MB)." };
  }
  return { ok: true };
}

export function getCloudinaryConfig() {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const folder = import.meta.env.VITE_CLOUDINARY_FOLDER;

  if (!cloudName || !uploadPreset) {
    return {
      ok: false,
      error: "Manjka Cloudinary konfiguracija (VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET).",
    };
  }

  return { ok: true, cloudName, uploadPreset, folder: folder?.trim() || undefined };
}

async function uploadImageToCloudinaryWithConfig(file, cfg, { signal } = {}) {
  const v = validatePostImageFile(file);
  if (!v.ok) throw new Error(v.error);

  if (!cfg?.ok) throw new Error(cfg?.error || "Manjka Cloudinary konfiguracija.");

  const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/image/upload`;
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", cfg.uploadPreset);
  if (cfg.folder) form.append("folder", cfg.folder);

  const res = await fetch(url, { method: "POST", body: form, signal });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.error?.message || data?.message || "Cloudinary upload ni uspel.";
    throw new Error(message);
  }

  if (!data?.secure_url || !data?.public_id) {
    throw new Error("Cloudinary odgovor je neveljaven (manjka URL/public_id).");
  }

  return { secureUrl: data.secure_url, publicId: data.public_id };
}

export async function uploadPostImageToCloudinary(file, { signal } = {}) {
  const prepared = await prepareImageFileForUpload(file, { signal }).catch(() => file);
  const v = validatePostImageFile(prepared);
  if (!v.ok) throw new Error(v.error);

  const cfg = getCloudinaryConfig();
  return uploadImageToCloudinaryWithConfig(prepared, cfg, { signal });
}
