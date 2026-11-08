// ============================================================
//  Данные: подключение, вход, загрузка, интервальное повторение, баллы
// ============================================================
const S = {
  sb: null, demo: false, me: null,
  people: [], lessons: [], cards: [], questions: [], progress: {}, attempts: [], hw: [], diary: [], att: [], posts: [],
  board: {}, checkins: {},            // board[uid] = {total, week}; checkins[uid] = Set(days)
  tProg: [], tCards: {}, tTests: [],  // только для учителя
};
const INTERVALS = [0, 1, 3, 7, 14, 30];     // дни до следующего показа по «коробкам» 0..5
const LEARNED_BOX = 2;                      // слово «выучено», когда 2 раза подряд верно в разные дни
const NEW_PER_DAY = 8;
// Уровень турецкого: множитель баллов за учёбу (слова, тренировка, тесты). Должен совпадать с google/Code.gs
const LEVEL_INFO = {
  beginner: { ru: "Начинающий", mult: 2, rank: 0 },
  intermediate: { ru: "Средний", mult: 1.5, rank: 1 },
  advanced: { ru: "Продвинутый", mult: 1, rank: 2 },
};
const levelOf = (p) => LEVEL_INFO[p?.level] || LEVEL_INFO.intermediate;
function parseLevel(s) {
  const x = String(s || "").trim().toLowerCase();
  if (!x) return "intermediate";
  if (/^(н|b|нач)/.test(x)) return "beginner";
  if (/^(п|a|прод)/.test(x)) return "advanced";
  if (/^(с|i|m)/.test(x)) return "intermediate";
  return null;
}

async function q(p) { const { data, error } = await p; if (error) throw error; return data; }
const isTeacher = () => S.me?.role === "teacher";
const person = (uid) => S.people.find((p) => p.uid === uid);
const fullName = (p) => (p ? `${p.first_name} ${p.last_name}` : "—");
const lessonById = (id) => S.lessons.find((l) => l.id === id);
const cardById = (id) => S.cards.find((c) => c.id === id);
const lessonCards = (lid) => S.cards.filter((c) => c.lesson_id === lid && c.status === "approved");
const lessonQuestions = (lid) => S.questions.filter((x) => x.lesson_id === lid && x.status === "approved");

function errMsg(e) {
  const m = String(e?.message || e || "");
  if (/Invalid login/i.test(m)) return "Неверный код или пароль";
  if (/unauthorized/i.test(m)) return "Сессия истекла — войдите снова";
  if (/already registered/i.test(m)) return "Этот код уже зарегистрирован — войдите по коду и паролю";
  if (/invalid_code/.test(m)) return "Код не найден или уже занят";
  if (/row-level security|forbidden|permission/i.test(m)) return "Недостаточно прав для этого действия";
  if (/explanation/i.test(m) && /check|constraint|Объяснение/i.test(m)) return "Объяснение обязательно (минимум 3 символа)";
  if (/duplicate key/i.test(m)) return "Такая запись уже существует";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Нет соединения с сервером";
  return m || "Что-то пошло не так";
}

function initClient() {
  const c = window.CONFIG || {};
  if (c.API_URL) { S.sb = createGasClient(c.API_URL); S.demo = false; }
  else { S.sb = createMock(); S.demo = true; }
}

const codeToEmail = (code) => `${String(code).trim().toLowerCase()}@tutors.lemalar.app`;

async function doLogin(code, password) {
  const { error } = await S.sb.auth.signInWithPassword({ email: codeToEmail(code), password });
  if (error) throw error;
  await afterAuth();
}
async function doRegister(code, password) {
  const info = await q(S.sb.rpc("check_invite", { p_code: code }));
  if (!info || !info.length) throw new Error("invalid_code");
  if (info[0].claimed) throw new Error("already registered");
  const { error } = await S.sb.auth.signUp({ email: codeToEmail(code), password });
  if (error) throw error;
  await q(S.sb.rpc("claim_invite", { p_code: code }));
  await afterAuth();
}
async function doLogout() { await S.sb.auth.signOut(); S.me = null; location.hash = "#/"; render(); }

async function afterAuth() {
  const { data } = await S.sb.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) { S.me = null; return; }
  const me = await q(S.sb.from("profiles").select("*").eq("auth_id", uid).maybeSingle());
  if (!me) { S.me = null; throw new Error("Аккаунт не привязан к списку группы. Обратитесь к учителю."); }
  S.me = me;
  S.sb.rpc("touch").then(() => {});
  await loadAll();
}

async function loadAll() {
  const uid = S.me.uid, t = isTeacher();
  const [people, lessons, cards, questions, progress, board, checks, attempts, hw, diary, att, posts] = await Promise.all([
    q(S.sb.from("people").select("*")),
    q(S.sb.from("lessons").select("*").order("num", { ascending: true })),
    q(S.sb.from("cards").select("*").order("created_at", { ascending: true })),
    q(S.sb.from("questions").select("*").order("created_at", { ascending: true })),
    q(S.sb.from("progress").select("*").eq("user_id", uid)),
    q(S.sb.rpc("leaderboard")),
    q(S.sb.rpc("checkins", { p_days: 60 })),
    q(S.sb.from("attempts").select("*").eq("user_id", uid)),
    t ? q(S.sb.from("homework_answers").select("lesson_id,user_id")) : q(S.sb.from("homework_answers").select("*").eq("user_id", uid)),
    q(S.sb.from("diary").select("*").eq("user_id", uid).order("day", { ascending: false })),
    t ? q(S.sb.from("attendance").select("*")) : q(S.sb.from("attendance").select("*").eq("user_id", uid)),
    q(S.sb.from("posts").select("*").order("created_at", { ascending: true })),
  ]);
  S.people = people; S.lessons = lessons; S.cards = cards; S.questions = questions;
  S.progress = byKey(progress, "card_id"); S.attempts = attempts; S.hw = hw; S.diary = diary; S.att = att; S.posts = posts;
  S.board = byKey(board, "user_id"); setCheckins(checks);
  if (t) await loadTeacherStats();
}
function setCheckins(rows) {
  S.checkins = {};
  for (const r of rows) (S.checkins[r.user_id] ||= new Set()).add(r.day);
}
async function loadTeacherStats() {
  const [pr, cs, ts] = await Promise.all([q(S.sb.rpc("progress_summary")), q(S.sb.rpc("card_stats")), q(S.sb.rpc("test_summary"))]);
  S.tProg = byKey(pr, "user_id"); S.tCards = byKey(cs, "card_id"); S.tTests = ts;
}
async function refreshBoard() {
  const [board, checks] = await Promise.all([q(S.sb.rpc("leaderboard")), q(S.sb.rpc("checkins", { p_days: 60 }))]);
  S.board = byKey(board, "user_id"); setCheckins(checks);
}

// ---------- серии ----------
function streakOf(uid) {
  const days = S.checkins[uid]; if (!days || !days.size) return 0;
  let d = todayKZ(); if (!days.has(d)) d = addDays(d, -1);
  let n = 0; while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
const checkedToday = (uid) => !!S.checkins[uid]?.has(todayKZ());
const myBoard = () => S.board[S.me.uid] || { total: 0, week: 0 };

// ---------- баллы ----------
async function award(reason, ref, delta) {
  if (delta <= 0) return 0;
  const gained = await q(S.sb.rpc("award", { p_reason: reason, p_ref: ref, p_delta: delta }));
  if (gained > 0) {
    const b = (S.board[S.me.uid] ||= { user_id: S.me.uid, total: 0, week: 0 });
    b.total += gained; b.week += gained;
    updateChip();
  }
  return gained || 0;
}
function updateChip() { const el = document.getElementById("pts-chip"); if (el) el.textContent = `${myBoard().total} ★`; }

// ---------- интервальное повторение ----------
async function grade(card, correct, opts = {}) {
  const today = todayKZ();
  const old = S.progress[card.id];
  const p = old ? { ...old } : { user_id: S.me.uid, card_id: card.id, box: 0, due: today, right_count: 0, wrong_count: 0, learned: false };
  if (correct) { p.box = Math.min(opts.self ? LEARNED_BOX - 1 : 5, p.box + 1); p.right_count++; }   // самооценка не может сделать слово «выученным»
  else { p.box = 0; p.wrong_count++; }
  p.due = correct ? addDays(today, INTERVALS[p.box]) : today;
  const becameLearned = !p.learned && p.box >= LEARNED_BOX;
  if (becameLearned) p.learned = true;
  p.updated_at = new Date().toISOString();
  S.progress[card.id] = p;
  await q(S.sb.from("progress").upsert(p));
  let gained = 0;
  if (becameLearned) { try { gained = await award("learn_card", card.id, 5); } catch (e) { console.warn(e); } }
  return { becameLearned, gained };
}

function dueCards(lessonIds) {
  const today = todayKZ();
  const pool = S.cards.filter((c) => c.status === "approved" && (!lessonIds || lessonIds.includes(c.lesson_id)) && lessonById(c.lesson_id)?.published);
  const due = pool.filter((c) => S.progress[c.id] && S.progress[c.id].due <= today);
  const fresh = pool.filter((c) => !S.progress[c.id]);
  return { due, fresh, pool };
}
function lessonStats(lid) {
  const cs = lessonCards(lid);
  const learned = cs.filter((c) => S.progress[c.id]?.learned).length;
  return { total: cs.length, learned, pct: cs.length ? Math.round((learned / cs.length) * 100) : 0 };
}
const myAttempts = (lid) => S.attempts.filter((a) => a.lesson_id === lid);
const bestAttempt = (lid) => myAttempts(lid).reduce((b, a) => (!b || a.score > b.score ? a : b), null);
