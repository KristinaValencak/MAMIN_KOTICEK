"use strict";

const fs = require("fs");
const path = require("path");

const routesDir = path.join(__dirname, "..", "routes");

function codeForStatus(status) {
  if (status === 400) return "CODES.VALIDATION_ERROR";
  if (status === 401) return "CODES.UNAUTHORIZED";
  if (status === 403) return "CODES.FORBIDDEN";
  if (status === 404) return "CODES.NOT_FOUND";
  if (status === 409) return "CODES.CONFLICT";
  if (status === 429) return "CODES.RATE_LIMIT";
  return "CODES.INTERNAL_ERROR";
}

function ensureImport(s) {
  if (s.includes('../utils/apiError') || s.includes("../utils/apiError")) return s;
  return s.replace(
    /^(const express = require\("express"\);\r?\n)(const router = express\.Router\(\);\r?\n)/m,
    `$1const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");\n$2`
  );
}

function migrateContent(s) {
  let out = s;

  // return res.status(N).json({ error: "..." , code: "X" })  — PROFILE style
  out = out.replace(
    /return res\.status\(403\)\.json\(\{\s*error:\s*"((?:[^"\\]|\\.)*)"\s*,\s*code:\s*"PROFILE_BLOCKED"\s*\}\)/g,
    'return sendJsonError(res, 403, CODES.PROFILE_BLOCKED, "$1")'
  );

  // Single-line error string
  out = out.replace(
    /return res\.status\((\d+)\)\.json\(\{\s*error:\s*"((?:[^"\\]|\\.)*)"\s*\}\)/g,
    (_, st, msg) => `return sendJsonError(res, ${st}, ${codeForStatus(Number(st))}, "${msg}")`
  );

  // Single-line message string (errors only — same mapping)
  out = out.replace(
    /return res\.status\((\d+)\)\.json\(\{\s*message:\s*"((?:[^"\\]|\\.)*)"\s*\}\)/g,
    (_, st, msg) => `return sendJsonError(res, ${st}, ${codeForStatus(Number(st))}, "${msg}")`
  );

  // res.status(500).json({ error: "..." }) without return
  out = out.replace(
    /res\.status\(500\)\.json\(\{\s*error:\s*"((?:[^"\\]|\\.)*)"\s*\}\)/g,
    'sendJsonError(res, 500, CODES.INTERNAL_ERROR, "$1")'
  );
  out = out.replace(
    /res\.status\(500\)\.json\(\{\s*message:\s*"((?:[^"\\]|\\.)*)"\s*\}\)/g,
    'sendJsonError(res, 500, CODES.INTERNAL_ERROR, "$1")'
  );

  return out;
}

for (const f of fs.readdirSync(routesDir)) {
  if (!f.endsWith(".js")) continue;
  const fp = path.join(routesDir, f);
  let s = fs.readFileSync(fp, "utf8");
  if (f === "auth.js") continue;
  const before = s;
  s = ensureImport(s);
  s = migrateContent(s);
  if (s !== before) {
    fs.writeFileSync(fp, s);
    console.log("updated", f);
  }
}
