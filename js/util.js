// ---------- безопасный HTML ----------
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
const raw = (s) => new Raw(s);
function fmt(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(fmt).join("");
  if (v == null || v === false || v === true) return "";
  return esc(v);
}
// html`...` экранирует всё, что подставлено через ${...}, кроме вложенных html``/raw()
const html = (strs, ...vals) => new Raw(strs.reduce((a, s, i) => a + s + (i < vals.length ? fmt(vals[i]) : ""), ""));

// ---------- даты (Алматы) ----------
const TZ = "Asia/Almaty";
const todayKZ = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
function addDays(ds, n) {
  const [y, m, d] = ds.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
function weekStart(ds = todayKZ()) {
  const [y, m, d] = ds.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=вс
  return addDays(ds, -((dow + 6) % 7));
}
const MONTHS = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
function fmtDate(ds) {
  if (!ds) return "";
  const [y, m, d] = ds.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
function fmtDateTime(ts) {
  if (!ts) return "—";
  const dt = new Date(ts);
  return dt.toLocaleString("ru-RU", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function daysSince(ts) {
  if (!ts) return Infinity;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}

// ---------- прочее ----------
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); }));
const sum = (a, f = (x) => x) => a.reduce((s, x) => s + f(x), 0);
const byKey = (arr, k) => Object.fromEntries(arr.map((x) => [x[k], x]));

// нормализация ответов для режима «письмо»
function norm(s) {
  return String(s || "").toLowerCase().replace(/ё/g, "е").replace(/[’'`´ʼʻ]/g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function isCorrectAnswer(input, translation) {
  const x = norm(input); if (!x) return false;
  const variants = String(translation).split(/[;,\/]|\bили\b/).map(norm).filter(Boolean);
  variants.push(norm(translation));
  return variants.some((v) => v === x || (v.length > 5 && lev(v, x) <= 1));
}

function toast(msg, kind = "") {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.className = "show " + kind; t.textContent = msg;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.className = ""), kind === "err" ? 4500 : 2200);
}
function download(name, text, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + text], { type });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast("Скопировано"); }
  catch { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast("Скопировано"); }
}
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function genCode(n = 8) { let s = ""; const r = crypto.getRandomValues(new Uint8Array(n)); for (const b of r) s += CODE_ALPHABET[b % CODE_ALPHABET.length]; return s; }
const NAME_RE = /^[\p{L}][\p{L}'’\-]+$/u;
