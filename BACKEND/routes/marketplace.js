const express = require("express");
const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");
const router = express.Router();
const db = require("../config/database");
const requireAuth = require("../middleware/auth");
const emailService = require("../services/emailService");
const { parseViewerUserId } = require("../services/contentVisibility");
const { canViewHiddenContent } = require("../services/permissions");
const {
  recordUserReport,
  DUPLICATE_ACTIVE_REPORT_CODE,
  DUPLICATE_ACTIVE_REPORT_MESSAGE,
} = require("../services/contentReports");
const L = require("../constants/inputLimits");
const { rejectIfStringTooLong } = require("../utils/rejectIfStringTooLong");
const { marketplaceCreateUserLimiter, userContentReportLimiter } = require("../middleware/rateLimiters");
const requireCleanContent = require("../middleware/requireCleanContent");
const { isAllowedCity, normalizeCityOrNull } = require("../constants/cities");

function isSafePublicId(v) {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (s.length < 1 || s.length > 300) return false;
  return /^[a-zA-Z0-9/_-]+$/.test(s);
}

function isValidCloudinaryUrl(urlStr) {
  if (typeof urlStr !== "string") return false;
  const s = urlStr.trim();
  if (s.length < 10 || s.length > 4000) return false;

  let u;
  try {
    u = new URL(s);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.hostname !== "res.cloudinary.com") return false;

  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  if (cloudName) {
    if (!u.pathname.startsWith(`/${cloudName}/`)) return false;
  }

  if (!u.pathname.includes("/image/upload/")) return false;
  return true;
}

function normalizeOptionalImageFields(body) {
  const imageUrl =
    body?.imageUrl === null || body?.imageUrl === undefined ? null : String(body.imageUrl).trim();
  const imagePublicId =
    body?.imagePublicId === null || body?.imagePublicId === undefined
      ? null
      : String(body.imagePublicId).trim();
  return { imageUrl: imageUrl || null, imagePublicId: imagePublicId || null };
}

function normalizeFolderPrefix(folder) {
  const f = String(folder || "").trim();
  if (!f) return null;
  return f.endsWith("/") ? f : `${f}/`;
}

function allowedMarketplacePublicIdPrefixes() {
  const posts = normalizeFolderPrefix(process.env.CLOUDINARY_POSTS_FOLDER || "posts");
  return [posts].filter(Boolean);
}

function detectContactWarnings(text) {
  const s = String(text || "");
  const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  // Very forgiving phone matcher; we only warn (no block).
  const phoneRe = /\b(\+?\d[\d\s().-]{6,}\d)\b/;

  const warnings = [];
  if (emailRe.test(s)) warnings.push("Zaznali smo email v besedilu. Zaradi varnosti ga raje odstrani.");
  if (phoneRe.test(s)) warnings.push("Zaznali smo telefonsko številko v besedilu. Zaradi varnosti jo raje odstrani.");
  return warnings;
}

function parseLimitOffset(req) {
  const limitRaw = parseInt(req.query.limit || "24", 10);
  const offsetRaw = parseInt(req.query.offset || "0", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 60) : 24;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
  return { limit, offset };
}

function parsePrice(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return { error: "Neveljavna cena." };
  if (n < 0) return { error: "Cena ne sme biti negativna." };
  // Keep 2 decimals max, but store as numeric in DB.
  return Math.round(n * 100) / 100;
}

function parseOptionalPositiveInt(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return { error: "Neveljavna vrednost." };
  if (n < 1) return { error: "Neveljavna vrednost." };
  return n;
}

async function validateCategoryOrNull(categoryId) {
  if (categoryId === null) return { ok: true, categoryId: null };
  const id = Number(categoryId);
  if (!Number.isFinite(id) || !Number.isInteger(id) || id < 1) {
    return { ok: false, error: "Neveljavna kategorija." };
  }
  const r = await db.query(
    `SELECT id FROM marketplace_categories WHERE id = $1 AND is_active = true LIMIT 1`,
    [id]
  );
  if (r.rowCount === 0) return { ok: false, error: "Izbrana kategorija ne obstaja." };
  return { ok: true, categoryId: id };
}

async function ensureDailyLimit(userId) {
  const maxPerDay = parseInt(process.env.MARKETPLACE_MAX_LISTINGS_PER_DAY || "3", 10);
  const max = Number.isFinite(maxPerDay) && maxPerDay > 0 ? maxPerDay : 3;
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS c
     FROM marketplace_listings
     WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
    [userId]
  );
  const c = Number(rows?.[0]?.c || 0);
  if (c >= max) {
    return { ok: false, max };
  }
  return { ok: true, max };
}

// GET /api/marketplace/categories
router.get("/categories", async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, slug, name, sort_order AS "sortOrder"
       FROM marketplace_categories
       WHERE is_active = true
       ORDER BY sort_order ASC, name ASC`
    );
    return res.json({ items: rows });
  } catch (err) {
    console.error("Napaka /api/marketplace/categories:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju kategorij");
  }
});

// GET /api/marketplace?limit=&offset=&city=&categoryId=&priceMin=&priceMax=
router.get("/", async (req, res) => {
  try {
    const { limit, offset } = parseLimitOffset(req);

    const rawCity = req.query.city;
    if (!isAllowedCity(rawCity)) {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljavna lokacija (mesto).");
    }
    const city = normalizeCityOrNull(rawCity);

    const rawCategoryId = req.query.categoryId ?? req.query.category_id;
    const categoryIdParsed = parseOptionalPositiveInt(rawCategoryId);
    if (typeof categoryIdParsed === "object" && categoryIdParsed?.error) {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljavna kategorija.");
    }

    const priceMinParsed = parsePrice(req.query.priceMin ?? req.query.price_min);
    if (typeof priceMinParsed === "object" && priceMinParsed?.error) {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven minimalni znesek.");
    }
    const priceMaxParsed = parsePrice(req.query.priceMax ?? req.query.price_max);
    if (typeof priceMaxParsed === "object" && priceMaxParsed?.error) {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven maksimalni znesek.");
    }
    if (priceMinParsed != null && priceMaxParsed != null && priceMinParsed > priceMaxParsed) {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Minimalna cena ne sme biti višja od maksimalne.");
    }

    const params = [];
    const where = ["l.status = 'active'", "l.deleted_at IS NULL", "l.is_hidden = false"];
    if (city) {
      params.push(city);
      where.push(`l.city = $${params.length}`);
    }
    if (categoryIdParsed) {
      params.push(categoryIdParsed);
      where.push(`l.category_id = $${params.length}`);
    }
    if (priceMinParsed != null) {
      params.push(priceMinParsed);
      where.push(`l.price >= $${params.length}`);
    }
    if (priceMaxParsed != null) {
      params.push(priceMaxParsed);
      where.push(`l.price <= $${params.length}`);
    }

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const { rows } = await db.query(
      `SELECT
         l.id,
         l.title,
         l.description,
         l.is_gift AS "isGift",
         l.price,
         l.city,
         l.category_id AS "categoryId",
         c.slug AS "categorySlug",
         c.name AS "categoryName",
         l.image_url AS "imageUrl",
         l.image_public_id AS "imagePublicId",
         l.created_at AS "createdAt"
       FROM marketplace_listings l
       LEFT JOIN marketplace_categories c ON c.id = l.category_id
       WHERE ${where.join(" AND ")}
       ORDER BY l.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    return res.json({ items: rows, pagination: { limit, offset } });
  } catch (err) {
    console.error("Napaka /api/marketplace:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju oglasov");
  }
});

// GET /api/marketplace/:id
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID oglasa");

  try {
    const viewerUserId = await parseViewerUserId(req);
    const canViewHidden = viewerUserId ? await canViewHiddenContent(viewerUserId) : false;
    const listingRes = await db.query(
      `SELECT
         l.id,
         l.user_id AS "userId",
         l.title,
         l.description,
         l.is_gift AS "isGift",
         l.price,
         l.city,
         l.category_id AS "categoryId",
         c.slug AS "categorySlug",
         c.name AS "categoryName",
         l.image_url AS "imageUrl",
         l.image_public_id AS "imagePublicId",
         l.has_contact_warning AS "hasContactWarning",
         l.is_hidden AS "isHidden",
         l.status,
         l.created_at AS "createdAt",
         l.updated_at AS "updatedAt",
         u.username AS "sellerUsername",
         u.bio AS "sellerBio",
         u.created_at AS "sellerCreatedAt"
       FROM marketplace_listings l
       JOIN users u ON u.id = l.user_id
       LEFT JOIN marketplace_categories c ON c.id = l.category_id
       WHERE l.id = $1
        AND l.deleted_at IS NULL
       LIMIT 1`,
      [id]
    );

    if (listingRes.rowCount === 0) return sendJsonError(res, 404, CODES.NOT_FOUND, "Oglas ne obstaja");
    const listing = listingRes.rows[0];
    if (listing.status !== "active") return sendJsonError(res, 404, CODES.NOT_FOUND, "Oglas ni več na voljo");

    const isOwner = viewerUserId != null && Number(viewerUserId) === Number(listing.userId);
    if (listing.isHidden && !isOwner && !canViewHidden) {
      return sendJsonError(res, 404, CODES.NOT_FOUND, "Oglas ni več na voljo");
    }

    const statsRes = await db.query(
      `SELECT
         COALESCE(p.total_posts, 0)::int AS "totalPosts",
         COALESCE(m.total_listings, 0)::int AS "totalListings"
       FROM (SELECT $1::bigint AS user_id) x
       LEFT JOIN (
         SELECT user_id, COUNT(*)::int AS total_posts
         FROM posts
         WHERE user_id = $1
           AND is_hidden = false
           AND status <> 'deleted'
           AND deleted_at IS NULL
         GROUP BY user_id
       ) p ON p.user_id = x.user_id
       LEFT JOIN (
         SELECT user_id, COUNT(*)::int AS total_listings
         FROM marketplace_listings
         WHERE user_id = $1
           AND status = 'active'
           AND deleted_at IS NULL
         GROUP BY user_id
       ) m ON m.user_id = x.user_id`,
      [listing.userId]
    );

    return res.json({
      ...listing,
      sellerStats: statsRes.rows?.[0] || { totalPosts: 0, totalListings: 0 },
    });
  } catch (err) {
    console.error("Napaka /api/marketplace/:id:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju oglasa");
  }
});

// GET /api/marketplace/me/hidden (auth)
router.get("/me/hidden", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit, offset } = parseLimitOffset(req);
    const { rows } = await db.query(
      `SELECT
         l.id,
         l.title,
         l.description,
         l.is_gift AS "isGift",
         l.price,
         l.city,
         l.category_id AS "categoryId",
         c.slug AS "categorySlug",
         c.name AS "categoryName",
         l.image_url AS "imageUrl",
         l.image_public_id AS "imagePublicId",
         l.created_at AS "createdAt",
         l.updated_at AS "updatedAt",
         l.status,
         l.is_hidden AS "isHidden",
         l.hidden_at AS "hiddenAt"
       FROM marketplace_listings l
       LEFT JOIN marketplace_categories c ON c.id = l.category_id
       WHERE l.user_id = $1
         AND l.is_hidden = true
         AND l.status = 'active'
         AND l.deleted_at IS NULL
       ORDER BY COALESCE(l.hidden_at, l.updated_at, l.created_at) DESC, l.id DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    const countRes = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM marketplace_listings l
       WHERE l.user_id = $1 AND l.is_hidden = true AND l.status = 'active' AND l.deleted_at IS NULL`,
      [userId]
    );
    return res.json({
      items: rows,
      pagination: { limit, offset, total: countRes.rows?.[0]?.count ?? rows.length },
    });
  } catch (err) {
    console.error("Napaka GET /api/marketplace/me/hidden:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju skritih oglasov");
  }
});

// POST /api/marketplace (auth)
router.post("/", requireAuth, marketplaceCreateUserLimiter, requireCleanContent("title", "description"), async (req, res) => {
  const userId = req.user.id;
  try {
    const { title, description } = req.body;
    const isGift = req.body?.isGift === true;
    const { imageUrl, imagePublicId } = normalizeOptionalImageFields(req.body);
    const priceParsed = isGift ? null : parsePrice(req.body.price);
    const rawCity = req.body?.city;
    const rawCategoryId = req.body?.categoryId ?? req.body?.category_id ?? req.body?.categoryID;

    if (!title?.trim() || !description?.trim()) {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Naslov in opis sta obvezna.");
    }
    if (rejectIfStringTooLong(res, title.trim(), L.LISTING_TITLE, "Naslov")) return;
    if (rejectIfStringTooLong(res, description.trim(), L.LISTING_DESCRIPTION, "Opis")) return;
    if (req.body.price != null && String(req.body.price).length > L.PRICE_INPUT) {
      return sendJsonError(
        res,
        400,
        CODES.VALIDATION_ERROR,
        `Cena je predolga (največ ${L.PRICE_INPUT} znakov).`
      );
    }
    if (typeof priceParsed === "object" && priceParsed?.error) {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, priceParsed.error);
    }

    if (!isAllowedCity(rawCity)) {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljavna lokacija (mesto).");
    }
    const city = normalizeCityOrNull(rawCity);

    const categoryIdParsed = parseOptionalPositiveInt(rawCategoryId);
    if (typeof categoryIdParsed === "object" && categoryIdParsed?.error) {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljavna kategorija.");
    }
    const catCheck = await validateCategoryOrNull(categoryIdParsed);
    if (!catCheck.ok) {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, catCheck.error);
    }

    if ((imageUrl && !imagePublicId) || (!imageUrl && imagePublicId)) {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Če dodate sliko, sta obvezna imageUrl in imagePublicId.");
    }
    if (imageUrl) {
      if (!isValidCloudinaryUrl(imageUrl)) {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven imageUrl (mora biti Cloudinary image URL).");
      }
      if (!isSafePublicId(imagePublicId)) {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven imagePublicId.");
      }
      const prefixes = allowedMarketplacePublicIdPrefixes();
      if (prefixes.length > 0 && !prefixes.some((p) => String(imagePublicId).startsWith(p))) {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven imagePublicId (napačen folder).");
      }
    }

    const limitCheck = await ensureDailyLimit(userId);
    if (!limitCheck.ok) {
      return sendJsonError(
        res,
        429,
        CODES.RATE_LIMIT,
        `Dosegla si dnevno omejitev oglasov (${limitCheck.max}/24h). Poskusi znova kasneje.`
      );
    }

    const warnings = [
      ...detectContactWarnings(title),
      ...detectContactWarnings(description),
    ];
    const hasContactWarning = warnings.length > 0;

    const ins = await db.query(
      `INSERT INTO marketplace_listings
        (user_id, title, description, is_gift, price, city, category_id, image_url, image_public_id, has_contact_warning, status, created_at, updated_at)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', NOW(), NOW())
       RETURNING
        id,
        user_id AS "userId",
        title,
        description,
        is_gift AS "isGift",
        price,
        city,
        category_id AS "categoryId",
        image_url AS "imageUrl",
        image_public_id AS "imagePublicId",
        has_contact_warning AS "hasContactWarning",
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt"`,
      [
        userId,
        title.trim(),
        description.trim(),
        isGift,
        priceParsed ?? null,
        city,
        catCheck.categoryId,
        imageUrl,
        imagePublicId,
        hasContactWarning,
      ]
    );

    return res.status(201).json({ ...ins.rows[0], warnings });
  } catch (err) {
    console.error("Napaka POST /api/marketplace:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri ustvarjanju oglasa");
  }
});

// PUT /api/marketplace/:id (auth)
router.put("/:id", requireAuth, requireCleanContent("title", "description"), async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID oglasa");

  try {
    const existing = await db.query(
      `SELECT id, user_id AS "userId", status FROM marketplace_listings WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (existing.rowCount === 0) return sendJsonError(res, 404, CODES.NOT_FOUND, "Oglas ne obstaja");
    if (existing.rows[0].status !== "active") return sendJsonError(res, 404, CODES.NOT_FOUND, "Oglas ni več na voljo");

    if (Number(existing.rows[0].userId) !== Number(userId)) {
      return sendJsonError(res, 403, CODES.FORBIDDEN, "Nimaš pravic za urejanje tega oglasa");
    }

    const { title, description } = req.body;
    const isGift = req.body?.isGift === true;
    const { imageUrl, imagePublicId } = normalizeOptionalImageFields(req.body);
    const priceParsed = isGift ? null : parsePrice(req.body.price);
    const rawCity = req.body?.city;
    const rawCategoryId = req.body?.categoryId ?? req.body?.category_id ?? req.body?.categoryID;

    if (!title?.trim() || !description?.trim()) {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Naslov in opis sta obvezna.");
    }
    if (rejectIfStringTooLong(res, title.trim(), L.LISTING_TITLE, "Naslov")) return;
    if (rejectIfStringTooLong(res, description.trim(), L.LISTING_DESCRIPTION, "Opis")) return;
    if (req.body.price != null && String(req.body.price).length > L.PRICE_INPUT) {
      return sendJsonError(
        res,
        400,
        CODES.VALIDATION_ERROR,
        `Cena je predolga (največ ${L.PRICE_INPUT} znakov).`
      );
    }
    if (typeof priceParsed === "object" && priceParsed?.error) {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, priceParsed.error);
    }

    if (!isAllowedCity(rawCity)) {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljavna lokacija (mesto).");
    }
    const city = normalizeCityOrNull(rawCity);

    const categoryIdParsed = parseOptionalPositiveInt(rawCategoryId);
    if (typeof categoryIdParsed === "object" && categoryIdParsed?.error) {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljavna kategorija.");
    }
    const catCheck = await validateCategoryOrNull(categoryIdParsed);
    if (!catCheck.ok) {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, catCheck.error);
    }

    if ((imageUrl && !imagePublicId) || (!imageUrl && imagePublicId)) {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Če dodate sliko, sta obvezna imageUrl in imagePublicId.");
    }
    if (imageUrl) {
      if (!isValidCloudinaryUrl(imageUrl)) {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven imageUrl (mora biti Cloudinary image URL).");
      }
      if (!isSafePublicId(imagePublicId)) {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven imagePublicId.");
      }
      const prefixes = allowedMarketplacePublicIdPrefixes();
      if (prefixes.length > 0 && !prefixes.some((p) => String(imagePublicId).startsWith(p))) {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven imagePublicId (napačen folder).");
      }
    }

    const warnings = [
      ...detectContactWarnings(title),
      ...detectContactWarnings(description),
    ];
    const hasContactWarning = warnings.length > 0;

    const upd = await db.query(
      `UPDATE marketplace_listings
       SET title = $1,
           description = $2,
           is_gift = $3,
           price = $4,
           city = $5,
           category_id = $6,
           image_url = $7,
           image_public_id = $8,
           has_contact_warning = $9,
           updated_at = NOW()
       WHERE id = $10
       RETURNING
        id,
        user_id AS "userId",
        title,
        description,
        is_gift AS "isGift",
        price,
        city,
        category_id AS "categoryId",
        image_url AS "imageUrl",
        image_public_id AS "imagePublicId",
        has_contact_warning AS "hasContactWarning",
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt"`,
      [
        title.trim(),
        description.trim(),
        isGift,
        priceParsed ?? null,
        city,
        catCheck.categoryId,
        imageUrl,
        imagePublicId,
        hasContactWarning,
        id,
      ]
    );

    return res.json({ ...upd.rows[0], warnings });
  } catch (err) {
    console.error("Napaka PUT /api/marketplace/:id:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri urejanju oglasa");
  }
});

// DELETE /api/marketplace/:id (auth) - soft delete
router.delete("/:id", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID oglasa");

  try {
    const existing = await db.query(
      `SELECT id, user_id AS "userId", status FROM marketplace_listings WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (existing.rowCount === 0) return sendJsonError(res, 404, CODES.NOT_FOUND, "Oglas ne obstaja");
    if (existing.rows[0].status === "deleted") return res.json({ ok: true });

    const isAdminRes = await db.query(`SELECT is_admin FROM users WHERE id = $1`, [userId]);
    const isAdmin = Boolean(isAdminRes.rows?.[0]?.is_admin);
    if (!isAdmin && Number(existing.rows[0].userId) !== Number(userId)) {
      return sendJsonError(res, 403, CODES.FORBIDDEN, "Nimaš pravic za brisanje tega oglasa");
    }

    await db.query(
      `UPDATE marketplace_listings
       SET status = 'deleted',
           deleted_at = COALESCE(deleted_at, NOW()),
           deleted_by_user_id = $2,
           deleted_source = $3,
           deleted_reason = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [id, userId, isAdmin ? "admin" : "user", isAdmin ? "admin_delete" : "self_delete"]
    );
    await db.query(
      `INSERT INTO deletion_events (target_type, target_id, event_type, actor_user_id, source, reason, metadata)
       VALUES ('marketplace_listing', $1, 'deleted', $2, $3, $4, '{}'::jsonb)`,
      [id, userId, isAdmin ? "admin" : "user", isAdmin ? "admin_delete" : "self_delete"]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error("Napaka DELETE /api/marketplace/:id:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri brisanju oglasa");
  }
});

// POST /api/marketplace/:id/report (auth)
router.post("/:id/report", requireAuth, userContentReportLimiter, async (req, res) => {
  const reporterId = req.user.id;
  const id = parseInt(req.params.id, 10);
  const reason = String(req.body?.reason || "").trim();
  if (Number.isNaN(id) || id < 1) return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID oglasa");
  if (!reason) return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Razlog prijave je obvezen.");
  if (rejectIfStringTooLong(res, reason, L.REPORT_REASON, "Razlog prijave")) return;

  try {
    const listingRes = await db.query(
      `SELECT
         l.id,
         l.title,
         l.user_id AS "sellerId",
         u.username AS "sellerUsername"
       FROM marketplace_listings l
       JOIN users u ON u.id = l.user_id
       WHERE l.id = $1
       LIMIT 1`,
      [id]
    );
    if (listingRes.rowCount === 0) return sendJsonError(res, 404, CODES.NOT_FOUND, "Oglas ne obstaja");

    try {
      await recordUserReport({
        reporterUserId: reporterId,
        targetType: "marketplace_listing",
        targetId: id,
        reason,
      });
    } catch (dbErr) {
      if (dbErr.code === DUPLICATE_ACTIVE_REPORT_CODE) {
        return sendJsonError(res, 409, CODES.CONFLICT, DUPLICATE_ACTIVE_REPORT_MESSAGE);
      }
      console.error("content_reports (marketplace):", dbErr);
      return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri shranjevanju prijave.");
    }

    const reporterRes = await db.query(`SELECT email FROM users WHERE id = $1`, [reporterId]);
    const reporterEmail = reporterRes.rows?.[0]?.email || null;

    // Best-effort: reporting must succeed even if email is misconfigured.
    try {
      await emailService.sendMarketplaceReportEmail(
        listingRes.rows[0].title,
        listingRes.rows[0].sellerUsername,
        id,
        reason,
        reporterEmail
      );
    } catch (emailErr) {
      console.error("Error sending marketplace report email:", emailErr);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Napaka POST /api/marketplace/:id/report:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri prijavi oglasa");
  }
});

module.exports = router;

