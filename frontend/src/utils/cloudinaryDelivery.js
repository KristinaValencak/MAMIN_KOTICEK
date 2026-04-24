/**
 * Cloudinary delivery (transformacije za prikaz). Upload ostane v cloudinaryUpload.js.
 */

/** @typedef {'thumb'|'feedCard'|'postDetail'|'featured'|'listingThumb'|'listingCardWide'|'listingHero'|'avatar'|'legacy'} CloudinaryDeliveryProfile */

const PROFILE = {
  thumb: { w: 720, h: 220, c: "fill", g: "auto", q: "q_auto:eco" },
  feedCard: { w: 720, c: "limit", q: "q_auto:good" },
  postDetail: { w: 1080, c: "limit", q: "q_auto" },
  featured: { w: 900, h: 320, c: "fill", g: "auto", q: "q_auto:good" },
  listingThumb: { w: 720, h: 220, c: "fill", g: "auto", q: "q_auto:eco" },
  listingCardWide: { w: 720, h: 360, c: "fill", g: "auto", q: "q_auto:good" },
  avatar: { w: 128, h: 128, c: "fill", g: "auto", q: "q_auto:eco" },
};

function buildTransformChain(parts) {
  return parts.filter(Boolean).join(",");
}

/**
 * Zgradi en segment transformacij (brez public_id).
 * @param {object} opts
 * @param {number} [opts.w]
 * @param {number} [opts.h]
 * @param {'limit'|'fill'} [opts.c]
 * @param {string} [opts.g] gravity npr. auto, face
 * @param {string} [opts.q] npr. q_auto, q_auto:eco
 */
export function buildCloudinaryTransformSegment({ w, h, c = "limit", g, q = "q_auto" }) {
  const base = ["f_auto", q];
  if (w) base.push(`w_${w}`);
  if (h) base.push(`h_${h}`);
  base.push(`c_${c}`);
  if (g && c === "fill") base.push(`g_${g}`);
  return buildTransformChain(base);
}

/**
 * @param {object} args
 * @param {string} args.cloudName
 * @param {string} args.publicId
 * @param {CloudinaryDeliveryProfile} [args.profile]
 * @param {number} [args.width] — le če ni profile (združljivost)
 */
export function buildCloudinaryTransformedUrl(args) {
  const { cloudName, publicId } = args;
  if (!cloudName || !publicId) return null;

  let segment;
  if (args.profile && args.profile !== "legacy" && PROFILE[args.profile]) {
    const p = PROFILE[args.profile];
    segment = buildCloudinaryTransformSegment({
      w: p.w,
      h: p.h,
      c: p.c || "limit",
      g: p.g,
      q: p.q || "q_auto",
    });
  } else if (typeof args.width === "number" && args.width > 0) {
    segment = buildCloudinaryTransformSegment({
      w: args.width,
      c: args.c || "limit",
      q: args.q || "q_auto",
    });
  } else {
    const p = PROFILE.feedCard;
    segment = buildCloudinaryTransformSegment({
      w: p.w,
      c: p.c,
      q: p.q,
    });
  }

  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/${segment}/${publicId}`;
}

/**
 * Responsive img: več širin z c_limit (ohrani razmerje).
 * @returns {{ src: string, srcSet: string } | null}
 */
export function buildCloudinarySrcSetLimit({ cloudName, publicId, widths, q = "q_auto" }) {
  if (!cloudName || !publicId || !widths?.length) return null;
  const sorted = [...widths].sort((a, b) => a - b);
  const entries = sorted.map((w) => {
    const seg = buildCloudinaryTransformSegment({ w, c: "limit", q });
    const url = `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/${seg}/${publicId}`;
    return `${url} ${w}w`;
  });
  const mid = sorted[Math.floor(sorted.length / 2)];
  const srcSeg = buildCloudinaryTransformSegment({ w: mid, c: "limit", q });
  const src = `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/${srcSeg}/${publicId}`;
  return { src, srcSet: entries.join(", ") };
}

export const POST_DETAIL_SRC_WIDTHS = [560, 840, 1120, 1280];
export const LISTING_HERO_SRC_WIDTHS = [560, 840, 1120, 1280];

/**
 * Poskusi iz `secure_url` / javnega Cloudinary URL-ja izluščiti public_id (brez transformacij).
 * @param {string | null | undefined} url
 * @returns {string | null}
 */
export function parseCloudinaryPublicIdFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  const marker = "/image/upload/";
  const idx = u.indexOf(marker);
  if (idx === -1) return null;
  let rest = u.slice(idx + marker.length).split("?")[0];
  if (!rest) return null;
  const parts = rest.split("/").filter(Boolean);
  let i = 0;
  while (i < parts.length && (parts[i].includes(",") || /^v\d+$/i.test(parts[i]))) {
    i += 1;
  }
  if (i >= parts.length) return null;
  return parts.slice(i).join("/");
}

/**
 * Optimiziran URL za avatar, če je slika na Cloudinary; sicer original.
 * @param {string | null | undefined} cloudName
 * @param {string | null | undefined} avatarUrl
 */
export function buildAvatarDisplayUrl(cloudName, avatarUrl) {
  if (!avatarUrl) return undefined;
  const pid = parseCloudinaryPublicIdFromUrl(avatarUrl);
  if (cloudName && pid) {
    const built = buildCloudinaryTransformedUrl({ cloudName, publicId: pid, profile: "avatar" });
    if (built) return built;
  }
  return avatarUrl;
}

/**
 * @param {{ cloudName?: string, publicId?: string|null, imageUrl?: string|null, widths?: number[], q?: string, sizes: string }} p
 */
export function buildResponsiveLimitImageProps({ cloudName, publicId, imageUrl, widths, q = "q_auto", sizes }) {
  const pid = publicId || parseCloudinaryPublicIdFromUrl(imageUrl || "");
  if (!cloudName || !pid) {
    const src = imageUrl || null;
    return src ? { src, srcSet: undefined, sizes } : { src: null, srcSet: undefined, sizes };
  }
  const rs = buildCloudinarySrcSetLimit({ cloudName, publicId: pid, widths: widths || [640, 960, 1200], q });
  if (!rs) return { src: imageUrl || null, srcSet: undefined, sizes };
  return { ...rs, sizes };
}

/**
 * Slika objave v feed kartici.
 */
export function buildForumFeedImageProps(cloudName, publicId, imageUrl) {
  return buildResponsiveLimitImageProps({
    cloudName,
    publicId,
    imageUrl,
    widths: [480, 720, 960],
    q: "q_auto:good",
    sizes: "(max-width: 640px) 94vw, (max-width: 1100px) 82vw, 720px",
  });
}

/**
 * Slika objave v podrobnosti (modal).
 */
export function buildForumPostDetailImageProps(cloudName, publicId, imageUrl) {
  return buildResponsiveLimitImageProps({
    cloudName,
    publicId,
    imageUrl,
    widths: POST_DETAIL_SRC_WIDTHS,
    q: "q_auto:good",
    sizes: "(max-width: 768px) 100vw, (max-width: 1200px) 85vw, 720px",
  });
}

/**
 * Hero slike oglasa.
 */
export function buildListingHeroImageProps(cloudName, publicId, imageUrl) {
  return buildResponsiveLimitImageProps({
    cloudName,
    publicId,
    imageUrl,
    widths: LISTING_HERO_SRC_WIDTHS,
    q: "q_auto:good",
    sizes: "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 560px",
  });
}
