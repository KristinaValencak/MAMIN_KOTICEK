"use strict";

const crypto = require("crypto");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { rateLimitBody } = require("../utils/apiError");

function clientKey(req) {
  return ipKeyGenerator(req.ip ?? req.socket?.remoteAddress ?? "unknown");
}

const isProduction = process.env.NODE_ENV === "production";
const devMultRaw = Number(process.env.RATE_LIMIT_DEV_MULT || (isProduction ? 1 : 5));
const devMult = Number.isFinite(devMultRaw) && devMultRaw > 0 ? devMultRaw : 1;

function bump(n) {
  return Math.max(1, Math.floor(n * devMult));
}

function skipOptions(req) {
  return req.method === "OPTIONS";
}

function skipHealth(req) {
  if (skipOptions(req)) return true;
  const path = (req.originalUrl || req.url || "").split("?")[0];
  return path.endsWith("/health") || path.endsWith("/api/health");
}

/** Light safety net: all methods; does not skip GET (unlike legacy limiter). */
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: bump(isProduction ? 3000 : 8000),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Preveč zahtev. Poskusi znova kasneje."),
  skip: skipHealth,
});

const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: bump(5),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Preveč poskusov prijave. Poskusi znova čez nekaj minut."),
  skip: skipOptions,
  keyGenerator: (req) => {
    const id = String(req.body?.identifier || "")
      .toLowerCase()
      .trim()
      .slice(0, 300);
    const h = crypto.createHash("sha256").update(id, "utf8").digest("hex").slice(0, 16);
    return `${clientKey(req)}:${h}`;
  },
});

const registerIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: bump(3),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Preveč poskusov registracije. Poskusi znova kasneje."),
  skip: skipOptions,
});

const forgotPasswordIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: bump(3),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Preveč zahtev za ponastavitev gesla. Poskusi znova kasneje."),
  skip: skipOptions,
});

const resendVerificationIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: bump(3),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Preveč poskusov. Poskusi znova kasneje."),
  skip: skipOptions,
});

const resetPasswordIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: bump(10),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Preveč poskusov ponastavitve gesla. Poskusi znova kasneje."),
  skip: skipOptions,
});

const verifyEmailGetIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: bump(30),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Preveč poskusov. Poskusi znova kasneje."),
  skip: skipOptions,
});

const contactPostIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: bump(5),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Preveč sporočil iz tega naslova. Poskusi znova kasneje."),
  skip: skipOptions,
});

const searchGetIpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: bump(60),
  standardHeaders: true,
  legacyHeaders: true,
  message: rateLimitBody("Preveč iskalnih zahtev. Upočasni malo."),
  skip: skipOptions,
});

const userSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: bump(60),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Preveč iskalnih zahtev. Upočasni malo."),
  skip: skipOptions,
  keyGenerator: (req) => {
    const id = req.user?.id;
    return id != null ? `usersearch:${id}` : clientKey(req);
  },
});

const createPostUserLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: bump(10),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Preveč novih objav. Počakaj malo."),
  skip: skipOptions,
  keyGenerator: (req) => `postcreate:${req.user?.id ?? clientKey(req)}`,
});

const postCommentUserLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: bump(30),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Preveč komentarjev. Počakaj malo."),
  skip: skipOptions,
  keyGenerator: (req) => `postcomment:${req.user?.id ?? clientKey(req)}`,
});

const commentReplyUserLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: bump(30),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Preveč odgovorov. Počakaj malo."),
  skip: skipOptions,
  keyGenerator: (req) => `commentreply:${req.user?.id ?? clientKey(req)}`,
});

const messageSendBurstUserLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: bump(20),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Pošiljaš sporočila prehitro. Počakaj malo."),
  skip: skipOptions,
  keyGenerator: (req) => `msgsendburst:${req.user?.id ?? clientKey(req)}`,
});

const messageSendHourUserLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: bump(60),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Preveč sporočil. Počakaj malo."),
  skip: skipOptions,
  keyGenerator: (req) => `msgsendhour:${req.user?.id ?? clientKey(req)}`,
});

const userContentReportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: bump(10),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Preveč prijav. Počakaj malo."),
  skip: skipOptions,
  keyGenerator: (req) => `report:${req.user?.id ?? clientKey(req)}`,
});

const friendRequestUserLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: bump(30),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Preveč prošenj za prijateljstvo. Počakaj malo."),
  skip: skipOptions,
  keyGenerator: (req) => `friendreq:${req.user?.id ?? clientKey(req)}`,
});

const pushTokenUserLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: bump(20),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Preveč zahtev za push token. Počakaj malo."),
  skip: skipOptions,
  keyGenerator: (req) => `pushtoken:${req.user?.id ?? clientKey(req)}`,
});

const marketplaceCreateUserLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: bump(3),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitBody("Preveč novih oglasov. Počakaj malo."),
  skip: skipOptions,
  keyGenerator: (req) => `mplist:${req.user?.id ?? clientKey(req)}`,
});

module.exports = {
  bump,
  globalApiLimiter,
  loginIpLimiter,
  registerIpLimiter,
  forgotPasswordIpLimiter,
  resendVerificationIpLimiter,
  resetPasswordIpLimiter,
  verifyEmailGetIpLimiter,
  contactPostIpLimiter,
  searchGetIpLimiter,
  userSearchLimiter,
  createPostUserLimiter,
  postCommentUserLimiter,
  commentReplyUserLimiter,
  messageSendBurstUserLimiter,
  messageSendHourUserLimiter,
  userContentReportLimiter,
  friendRequestUserLimiter,
  pushTokenUserLimiter,
  marketplaceCreateUserLimiter,
};
