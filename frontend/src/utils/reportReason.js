import { INPUT_LIMITS } from "../constants/inputLimits";

export const OTHER_REASON_ID = "other";

export const REPORT_REASON_OPTIONS = [
  { id: "inappropriate", label: "Neprimerna ali žaljiva vsebina" },
  { id: "harassment", label: "Nadlegovanje ali sovražni govor" },
  { id: "misinformation", label: "Lažne ali zavajajoče informacije" },
  { id: "spam", label: "Spam ali oglaševanje" },
  { id: "scam", label: "Sum prevare ali zavajajoč oglas" },
  { id: "dangerous", label: "Nevaren ali škodljiv izdelek" },
  { id: OTHER_REASON_ID, label: "Drugo" },
];

export const REPORT_OTHER_TEXT_MAX = INPUT_LIMITS.REPORT_OTHER_DETAIL;

export function buildReportReason(selectedMap, otherText) {
  const parts = [];
  const extra = String(otherText || "").trim();

  for (const opt of REPORT_REASON_OPTIONS) {
    if (!selectedMap[opt.id]) continue;
    if (opt.id === OTHER_REASON_ID) {
      parts.push(extra ? `Drugo: ${extra}` : "Drugo");
    } else {
      parts.push(opt.label);
    }
  }
  return parts.join("\n");
}

export function isReportReasonValid(selectedMap, otherText) {
  const anySelected = REPORT_REASON_OPTIONS.some((o) => selectedMap[o.id]);
  if (!anySelected) return false;

  const extra = String(otherText || "");
  if (selectedMap[OTHER_REASON_ID]) {
    if (!extra.trim()) return false;
    if (extra.length > REPORT_OTHER_TEXT_MAX) return false;
  }
  const built = buildReportReason(selectedMap, otherText);
  if (built.length > INPUT_LIMITS.REPORT_REASON) return false;
  return true;
}
