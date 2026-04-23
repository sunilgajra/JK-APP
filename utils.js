import { state } from "./state.js";

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function cleanText(v) {
  return String(v || "").trim();
}

export function cleanUpper(v) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .toUpperCase();
}

export function cleanNumber(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeCustomerId(v) {
  return String(v || "").replace(/\D/g, "");
}

export function nextCustomerId() {
  const nums = state.buyers
    .map((b) => Number(String(b.customer_id || "").replace(/\D/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);

  return String((nums.length ? Math.max(...nums) : 1000) + 1);
}

export function formatAuditValue(v) {
  if (v == null) return "—";
  if (typeof v === "object") {
    const values = Object.values(v);
    if (values.length === 1) return String(values[0] ?? "—");
    return JSON.stringify(v);
  }
  return String(v);
}

export function formatAuditTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("en-IN");
}

export function monthSuffix(dateStr = "") {
  const d = dateStr ? new Date(dateStr) : new Date();
  const m = d.getMonth() + 1;
  return String(m).padStart(2, "0");
}

export function nextDocNumber(prefix, fieldName, invoiceDate = "") {
  const mm = monthSuffix(invoiceDate);
  const nums = state.deals
    .map((d) => String(d[fieldName] || "").match(new RegExp(`^${prefix}\\s(\\d+)\\/(\\d{2})$`)))
    .filter(Boolean)
    .map((m) => Number(m[1] || 0));

  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix} ${String(next).padStart(5, "0")}/${mm}`;
}

export function ensureDocNumbers(payload, existing = null) {
  const invoiceDate = payload.invoice_date || existing?.invoice_date || "";

  payload.pi_no = cleanText(payload.pi_no) || existing?.pi_no || nextDocNumber("PI", "pi_no", invoiceDate);
  payload.ci_no = cleanText(payload.ci_no) || existing?.ci_no || nextDocNumber("CI", "ci_no", invoiceDate);
  payload.pl_no = cleanText(payload.pl_no) || existing?.pl_no || nextDocNumber("PL", "pl_no", invoiceDate);
  payload.coo_no = cleanText(payload.coo_no) || existing?.coo_no || nextDocNumber("COO", "coo_no", invoiceDate);

  return payload;
}

export function nextDealNo() {
  const nums = state.deals
    .map((d) => String(d.deal_no || "").match(/JKP-(\d+)/))
    .filter(Boolean)
    .map((m) => Number(m[1] || 0));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `JKP-${String(next).padStart(3, "0")}`;
}
