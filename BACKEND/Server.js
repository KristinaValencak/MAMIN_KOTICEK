require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { globalApiLimiter } = require("./middleware/rateLimiters");
const db = require("./config/database");
const profanityFilter = require("./services/profanityFilter");
const { sendJsonError, sendInternalError, CODES } = require("./utils/apiError");
const { startPushOutboxWorker } = require("./workers/pushOutboxWorker");

function assertJwtSecretForEnvironment() {
  const secret = process.env.JWT_SECRET || "";
  if (process.env.NODE_ENV === "production") {
    if (secret.length < 32) {
      console.error("JWT_SECRET mora biti vsaj 32 znakov v produkciji.");
      process.exit(1);
    }
  } else if (secret && secret.length < 32) {
    console.warn("Opozorilo: JWT_SECRET je krajši od priporočenih 32 znakov.");
  }
}

assertJwtSecretForEnvironment();

console.log("Zaganjam server...");
console.log("PORT:", process.env.PORT || 8080);
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Nastavljen ✓" : "NI NASTAVLJEN ✗");

const app = express();
if (process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

function normalizeOrigin(input) {
  if (!input) return "";
  const s = String(input).trim();
  if (!s) return "";
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

function parseAllowedOrigins() {
  const raw = String(process.env.ALLOWED_ORIGINS || "").trim();
  if (raw) {
    return raw
      .split(",")
      .map((x) => normalizeOrigin(x))
      .filter(Boolean);
  }
  const fallback = normalizeOrigin("http://localhost:5173");
  return [fallback];
}

function envBool(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") return defaultValue;
  const v = String(raw).trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "y" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "n" || v === "off") return false;
  return defaultValue;
}

const allowedOrigins = parseAllowedOrigins();
const allowNoOrigin = envBool("ALLOW_NO_ORIGIN", true);

const corsOptions = {
  origin(origin, callback) {
    const o = normalizeOrigin(origin);
    if (!o) {
      return allowNoOrigin
        ? callback(null, true)
        : callback(new Error("CORS: Missing Origin header is not allowed"), false);
    }
    if (allowedOrigins.includes(o)) return callback(null, true);
    return callback(new Error(`CORS: Origin not allowed: ${o}`), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

app.use((req, res, next) => {
  res.vary("Origin");
  next();
});

app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));

app.use((err, req, res, next) => {
  if (!err) return next();
  if (typeof err.message === "string" && err.message.startsWith("CORS:")) {
    return sendJsonError(res, 403, CODES.FORBIDDEN, "CORS: Origin ni dovoljen.");
  }
  return next(err);
});

app.set("etag", false);
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use("/api", globalApiLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.use("/api", require("./routes/auth"));
app.use("/api/posts", require("./routes/posts"));
app.use("/api/comments", require("./routes/comments"));
app.use("/api/users", require("./routes/users"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/cities", require("./routes/cities"));
app.use("/api/groups", require("./routes/groups"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/push", require("./routes/push"));
app.use("/api/contact", require("./routes/contact"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/moderation/appeals", require("./routes/moderationAppeals"));
app.use("/api/moderation", require("./routes/moderation"));
app.use("/api/friends", require("./routes/friends"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/presence", require("./routes/presence"));
app.use("/api/support", require("./routes/support"));
app.use("/api/marketplace", require("./routes/marketplace"));
app.use("/api/search", require("./routes/search"));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

function isMalformedJsonBody(err) {
  if (!err) return false;
  if (err.type === "entity.parse.failed") return true;
  return err instanceof SyntaxError && (err.status === 400 || err.statusCode === 400);
}

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (isMalformedJsonBody(err)) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven JSON v telesu zahteve.");
  }
  const path = (req.originalUrl || req.url || "").split("?")[0];
  if (path.startsWith("/api")) {
    console.error("Neobravnana napaka HTTP:", err);
    return sendInternalError(res);
  }
  return next(err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Neobravnavana napaka:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Neobravnavana izjema:', error);
});

async function bootstrapBannedWordsCache() {
  const n = await profanityFilter.refreshBannedWordsCache(db);
  console.log(`Profanity filter: naloženih ${n} vzorcev (vgrajeni + baza) ✔️`);
}

const PORT = process.env.PORT || 8080;

async function startServer() {
  try {
    await bootstrapBannedWordsCache();
  } catch (err) {
    console.error("Napaka pri nalaganju profanity filtra:", err);
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
    console.warn("Opozorilo: strežnik teče brez osvežitve prepovedanih besed iz baze (uporabljen je samo vgrajeni seznam).");
  }

  const server = app.listen(PORT, () => {
    console.log(`Server posluša na http://localhost:${PORT}`);
    const w = startPushOutboxWorker();
    if (w.started) {
      console.log(`push outbox worker started ✔️ (poll ${w.intervalMs}ms)`);
    } else {
      console.log("push outbox worker disabled (set ENABLE_PUSH_WORKER=true to enable)");
    }
  }).on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} je že zaseden!`);
    } else {
      console.error("Napaka pri zagonu strežnika:", err);
    }
    process.exit(1);
  });

  return server;
}

startServer();