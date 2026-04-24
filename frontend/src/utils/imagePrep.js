const DEFAULT_MAX_EDGE = 1920;
const WEBP_QUALITY = 0.82;

/**
 * Zmanjša najdaljšo stranico in stisne v WebP (ali JPEG), da je shranjevanje/transformacije cenejši.
 * @param {File} file
 * @param {{ maxEdge?: number, signal?: AbortSignal }} [opts]
 * @returns {Promise<File>}
 */
export async function prepareImageFileForUpload(file, { maxEdge = DEFAULT_MAX_EDGE, signal } = {}) {
  if (!file || !file.type?.startsWith("image/")) return file;
  signal?.throwIfAborted?.();

  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;

  try {
    let { width, height } = bmp;
    const longest = Math.max(width, height);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    if (scale >= 1 && file.type === "image/webp") {
      return file;
    }
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, width, height);

    const mime = "image/webp";
    let blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b || null), mime, WEBP_QUALITY);
    });
    if (!blob) {
      blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b || null), "image/jpeg", 0.88);
      });
    }
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, "");
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${base}.${ext}`, { type: blob.type });
  } finally {
    bmp.close();
  }
}
