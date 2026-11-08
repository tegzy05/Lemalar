/**
 * Лемалар · Тьюторы — серверная часть на Google Apps Script.
 * База данных — листы этой Google Таблицы. Бесплатно, только ваш Google-аккаунт.
 *
 * Установка: см. README.md (раздел «Google»).
 *   1) При желании измените настройки ниже.
 *   2) Выберите функцию setup и нажмите «Выполнить» (один раз) — создаст листы и запись учителя.
 *   3) Развернуть → Новое развертывание → Веб-приложение (Выполнять от: Меня, Доступ: Все).
 */

// ===================== НАСТРОЙКИ (меняйте до запуска setup) =====================
const TEACHER_FIRST = 'Имя';        // ваше настоящее имя
const TEACHER_LAST  = 'Фамилия';    // ваша настоящая фамилия
const TEACHER_CODE  = '';           // пусто = создастся случайный код (рекомендуется)
const TZ            = 'Asia/Almaty';
const SESSION_DAYS  = 60;           // сколько дней не нужно вводить пароль заново
const HASH_ROUNDS   = 40;
const MAX_UPLOAD_MB = 10;           // максимальный размер презентации

// Уровень турецкого → множитель баллов за УЧЁБУ (выученные слова, тренировка, тесты).
// Новичок получает больше баллов за те же усилия, у продвинутого — ×1.
const LEVELS = {
  beginner:     { mult: 2,   rank: 0 },   // начинающий
  intermediate: { mult: 1.5, rank: 1 },   // средний
  advanced:     { mult: 1,   rank: 2 },   // продвинутый
};
const MULTIPLIED = ['learn_card', 'practice', 'test'];
// Наставник (уровень выше) получает долю баллов своего подопечного за учёбу — за помощь новичкам.
const MENTOR_SHARE = 0.25;
const MENTOR_DAILY_CAP = 10;        // максимум в день на одного подопечного
// ================================================================================

const T_ = (s) => s.split(',').map((x) => { const p = x.trim().split(':'); return { n: p[0], t: p[1] || 't' }; });
// типы: t — текст, n — число, b — да/нет, j — JSON
const SCHEMA = {
  profiles:         { cols: T_('uid,auth_id,code,first_name,last_name,role,team,mentor,last_seen,created_at,salt,hash,pwv:n,level'), pk: ['uid'] },
  lessons:          { cols: T_('id,num:n,title,lesson_date,summary,slides_url,discussion_topic,discussion_open:b,homework,homework_due,test_open:b,test_minutes:n,test_attempts:n,published:b,created_at'), pk: ['id'] },
  cards:            { cols: T_('id,lesson_id,kind,term,translation,explanation,example,source_ref,status,author,created_at'), pk: ['id'] },
  questions:        { cols: T_('id,lesson_id,author,question,options:j,correct:n,explanation,status,created_at'), pk: ['id'] },
  progress:         { cols: T_('user_id,card_id,box:n,due,right_count:n,wrong_count:n,learned:b,updated_at'), pk: ['user_id', 'card_id'] },
  attempts:         { cols: T_('id,user_id,lesson_id,score:n,total:n,duration_s:n,created_at'), pk: ['id'] },
  points_log:       { cols: T_('user_id,reason,ref,delta:n,note,updated_at'), pk: ['user_id', 'reason', 'ref'] },
  homework_answers: { cols: T_('lesson_id,user_id,answer,created_at'), pk: ['lesson_id', 'user_id'] },
  diary:            { cols: T_('user_id,day,body'), pk: ['user_id', 'day'] },
  posts:            { cols: T_('id,lesson_id,parent_id,user_id,body,created_at'), pk: ['id'] },
  attendance:       { cols: T_('lesson_id,user_id,present:b'), pk: ['lesson_id', 'user_id'] },
};
const HIDDEN = { profiles: ['salt', 'hash', 'pwv'] };
const WRITE_RPC = ['touch', 'award', 'teacher_award', 'reset_password', 'upload_slide'];
const NAME_RE = /^[\p{L}][\p{L}'’\-]+$/u;

// ---------------------------------------------------------------- утилиты
const uuid_ = () => Utilities.getUuid();
const nowIso_ = () => new Date().toISOString();
const today_ = () => Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
function addDays_(ds, n) { const p = ds.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10); }
function weekStart_(ds) { const p = ds.split('-').map(Number); const dow = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); return addDays_(ds, -((dow + 6) % 7)); }
const ok_ = (data) => ({ data: data, error: null });
const fail_ = (m) => { throw new Error(m); };
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }

function fromCell_(v, c) {
  if (v === '' || v === null || v === undefined) return c.t === 'b' ? false : null;
  switch (c.t) {
    case 'n': return Number(v);
    case 'b': return v === true || String(v).toLowerCase() === 'true';
    case 'j': try { return JSON.parse(v); } catch (e) { return null; }
    default:
      if (v instanceof Date) return /_at$|^last_seen$/.test(c.n) ? v.toISOString() : Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
      return String(v);
  }
}
function toCell_(v, c) {
  if (v === null || v === undefined) return '';
  switch (c.t) {
    case 'j': return JSON.stringify(v);
    case 'n': return v === '' ? '' : Number(v);
    case 'b': return v ? 'TRUE' : 'FALSE';
    default: return String(v);
  }
}

// ---------------------------------------------------------------- доступ к листам
function Table_(db, name) {
  this.name = name; this.def = SCHEMA[name];
  this.sheet = db.ss.getSheetByName(name);
  if (!this.sheet) throw new Error('Нет листа «' + name + '». Запустите функцию setup().');
  const n = this.def.cols.length, last = this.sheet.getLastRow();
  this.rows = []; this.rewrite = false;
  if (last > 1) {
    const vals = this.sheet.getRange(2, 1, last - 1, n).getValues();
    for (let i = 0; i < vals.length; i++) {
      if (vals[i][0] === '' || vals[i][0] === null) continue;
      const o = { _r: i + 2 };
      for (let j = 0; j < n; j++) o[this.def.cols[j].n] = fromCell_(vals[i][j], this.def.cols[j]);
      this.rows.push(o);
    }
  }
}
Table_.prototype.pkOf = function (o) { return this.def.pk.map(function (k) { return o[k]; }).join('|'); };
Table_.prototype.findPk = function (rec) { const k = this.pkOf(rec); return this.rows.find((r) => this.pkOf(r) === k) || null; };
Table_.prototype.insert = function (rec) {
  const o = { _new: true };
  this.def.cols.forEach((c) => { o[c.n] = rec[c.n] === undefined ? null : rec[c.n]; });
  this.rows.push(o); return o;
};
Table_.prototype.touch = function (o) { if (!o._new) o._dirty = true; };
Table_.prototype.remove = function (pred) {
  const keep = [], gone = [];
  this.rows.forEach((r) => (pred(r) ? gone : keep).push(r));
  this.rows = keep; if (gone.length) this.rewrite = true; return gone;
};
Table_.prototype.commit = function () {
  const cols = this.def.cols, n = cols.length, sh = this.sheet;
  const added = this.rows.filter((r) => r._new), dirty = this.rows.filter((r) => r._dirty && !r._new);
  if (!this.rewrite && !added.length && !dirty.length) return;
  const fmtRow = cols.map((c) => (c.t === 'n' ? '0' : '@'));
  const toRow = (o) => cols.map((c) => toCell_(o[c.n], c));
  const ensure = (lastRow) => { const mx = sh.getMaxRows(); if (lastRow > mx) sh.insertRowsAfter(mx, lastRow - mx + 200); };
  if (this.rewrite || dirty.length > 8) {
    const last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, n).clearContent();
    if (this.rows.length) {
      ensure(this.rows.length + 1);
      const rg = sh.getRange(2, 1, this.rows.length, n);
      rg.setNumberFormats(this.rows.map(() => fmtRow)); rg.setValues(this.rows.map(toRow));
    }
    this.rows.forEach((r, i) => { r._r = i + 2; });
  } else {
    dirty.forEach((r) => { sh.getRange(r._r, 1, 1, n).setValues([toRow(r)]); });
    if (added.length) {
      const start = sh.getLastRow() + 1; ensure(start + added.length - 1);
      const rg = sh.getRange(start, 1, added.length, n);
      rg.setNumberFormats(added.map(() => fmtRow)); rg.setValues(added.map(toRow));
      added.forEach((r, i) => { r._r = start + i; });
    }
  }
  this.rows.forEach((r) => { delete r._new; delete r._dirty; });
  this.rewrite = false;
};
function DB_() {
  const id = prop_('SSID');
  if (!id) throw new Error('Не выполнена настройка: запустите функцию setup() в редакторе скриптов.');
  this.ss = SpreadsheetApp.openById(id); this.tabs = {};
}
DB_.prototype.t = function (name) { return this.tabs[name] || (this.tabs[name] = new Table_(this, name)); };
DB_.prototype.commit = function () { const self = this; Object.keys(this.tabs).forEach(function (k) { self.tabs[k].commit(); }); };

// ---------------------------------------------------------------- вход, токены
function sha_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
function hashPw_(pw, salt) { let h = salt + ':' + pw; for (let i = 0; i < HASH_ROUNDS; i++) h = sha_(h + salt); return h; }
function sign_(payload) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, prop_('SECRET'))); }
function makeToken_(p) { const payload = p.uid + '.' + (p.pwv || 0) + '.' + (Date.now() + SESSION_DAYS * 86400000); return payload + '.' + sign_(payload); }
function authCtx_(db, token) {
  if (!token) return null;
  const p = String(token).split('.');
  if (p.length !== 4 || sign_(p.slice(0, 3).join('.')) !== p[3] || Number(p[2]) < Date.now()) return null;
  const prof = db.t('profiles').rows.find((r) => r.uid === p[0]);
  if (!prof || !prof.auth_id || String(prof.pwv || 0) !== p[1]) return null;
  return { uid: prof.uid, role: prof.role };
}
function authCall_(db, c) {
  const code = String(c.code || '').trim().toUpperCase();
  const profs = db.t('profiles'), p = profs.rows.find((r) => r.code === code);
  if (c.op === 'signIn') {
    const cache = CacheService.getScriptCache(), key = 'fail:' + code, fails = Number(cache.get(key) || 0);
    if (fails >= 8) fail_('Слишком много попыток входа. Подождите 15 минут.');
    if (!p || !p.auth_id || !p.hash || hashPw_(String(c.password || ''), p.salt) !== p.hash) { cache.put(key, String(fails + 1), 900); fail_('Invalid login credentials'); }
    cache.remove(key);
    return ok_({ user: { id: p.uid }, session: { access_token: makeToken_(p), user: { id: p.uid } } });
  }
  if (c.op === 'signUp') {
    if (!p) fail_('invalid_code');
    if (p.auth_id) fail_('User already registered');
    const pw = String(c.password || '');
    if (pw.length < 6 || pw.length > 100) fail_('Пароль: от 6 до 100 символов');
    p.salt = uuid_(); p.hash = hashPw_(pw, p.salt); p.auth_id = p.uid; p.pwv = (p.pwv || 0) + 1; profs.touch(p);
    return ok_({ user: { id: p.uid }, session: { access_token: makeToken_(p), user: { id: p.uid } } });
  }
  fail_('bad_call');
}

// ---------------------------------------------------------------- веб-приложение
function doGet() {
  return ContentService.createTextOutput('Лемалар API работает. Адрес нужно вставить в config.js (API_URL).');
}
function doPost(e) {
  let out;
  try { out = processBatch_(JSON.parse(e.postData.contents)); }
  catch (err) { out = { results: [], error: { message: String(err.message || err) } }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function isWrite_(c) {
  return (c.k === 'q' && c.op && c.op !== 'select') || (c.k === 'auth' && c.op === 'signUp') || (c.k === 'rpc' && WRITE_RPC.indexOf(c.name) >= 0);
}
function processBatch_(req) {
  const calls = req.calls || [];
  const lock = calls.some(isWrite_) ? LockService.getScriptLock() : null;
  if (lock) lock.waitLock(25000);
  try {
    const db = new DB_(), ctx = authCtx_(db, req.token);
    const results = calls.map((c) => {
      try {
        if (c.k === 'auth') return authCall_(db, c);
        if (c.k === 'rpc') return rpcCall_(db, ctx, c.name, c.args || {});
        if (c.k === 'q') { if (!ctx) fail_('unauthorized'); return queryCall_(db, ctx, c); }
        return fail_('bad_call');
      } catch (err) { return { data: null, error: { message: String(err.message || err) } }; }
    });
    db.commit();
    return { results: results };
  } finally { if (lock) lock.releaseLock(); }
}

// ---------------------------------------------------------------- запросы к таблицам
function makeMatcher_(filters) {
  return (r) => filters.every((f) => {
    const op = f[0], x = r[f[1]], v = f[2];
    if (op === 'eq') return x === v; if (op === 'neq') return x !== v;
    if (op === 'in') return v.indexOf(x) >= 0; if (op === 'gte') return x >= v; if (op === 'lte') return x <= v;
    return true;
  });
}
function pubSet_(db) { const s = {}; db.t('lessons').rows.forEach((l) => { if (l.published) s[l.id] = true; }); return s; }
function pub_(t, r) {
  if (!SCHEMA[t]) { const o = {}; Object.keys(r).forEach((k) => { if (k[0] !== '_') o[k] = r[k]; }); return o; }
  const hide = HIDDEN[t] || [], o = {};
  SCHEMA[t].cols.forEach((c) => { if (hide.indexOf(c.n) < 0) o[c.n] = r[c.n]; });
  return o;
}
function selectRows_(db, ctx, q) {
  const t = q.t, isT = ctx.role === 'teacher', uid = ctx.uid;
  let rows;
  if (t === 'people') {
    rows = db.t('profiles').rows.map((p) => ({ uid: p.uid, first_name: p.first_name, last_name: p.last_name, role: p.role, team: p.team, mentor: p.mentor, level: p.level, last_seen: p.last_seen, registered: !!p.auth_id }));
  } else {
    if (!SCHEMA[t]) fail_('unknown table');
    rows = db.t(t).rows;
    if (!isT) {
      if (t === 'profiles') rows = rows.filter((r) => r.uid === uid);
      else if (t === 'lessons') rows = rows.filter((r) => r.published);
      else if (t === 'cards' || t === 'questions') { const pub = pubSet_(db); rows = rows.filter((r) => r.author === uid || (r.status === 'approved' && pub[r.lesson_id])); }
      else if (t === 'posts') { const pub = pubSet_(db); rows = rows.filter((r) => pub[r.lesson_id]); }
      else if (['progress', 'attempts', 'homework_answers', 'diary', 'attendance'].indexOf(t) >= 0) rows = rows.filter((r) => r.user_id === uid);
    }
  }
  rows = rows.filter(makeMatcher_(q.filters || []));
  if (q.order) {
    const col = q.order.col, dir = q.order.asc ? 1 : -1;
    rows = rows.slice().sort((a, b) => { const x = a[col], y = b[col]; if (x === y) return 0; if (x === null || x === undefined) return -dir; if (y === null || y === undefined) return dir; return (x > y ? 1 : -1) * dir; });
  }
  if (q.limit) rows = rows.slice(0, q.limit);
  return rows.map((r) => pub_(t, r));
}

function typed_(t, k, v) {
  const c = SCHEMA[t].cols.find((x) => x.n === k);
  if (!c) fail_('unknown field ' + k);
  if (v === null || v === undefined || v === '') return c.t === 'b' ? false : null;
  if (c.t === 'n') { const n = Number(v); if (isNaN(n)) fail_('bad number ' + k); return n; }
  if (c.t === 'b') return v === true || v === 'true';
  if (c.t === 'j') return v;
  const s = String(v); if (s.length > 5000) fail_('Слишком длинный текст'); return s;
}
const blank_ = (s) => !s || !String(s).trim();
function must_(cond, msg) { if (!cond) fail_(msg); }

function prepareWrite_(db, ctx, t, rec, op) {
  const isT = ctx.role === 'teacher', uid = ctx.uid; let allowed, force = {};
  const needT = () => { if (!isT) fail_('forbidden'); };
  switch (t) {
    case 'profiles': needT(); allowed = op === 'insert' ? ['code', 'first_name', 'last_name', 'team', 'level'] : ['team', 'mentor', 'level']; break;
    case 'lessons': needT(); allowed = ['num', 'title', 'lesson_date', 'summary', 'slides_url', 'discussion_topic', 'discussion_open', 'homework', 'homework_due', 'test_open', 'test_minutes', 'test_attempts', 'published']; break;
    case 'cards':
      if (isT) allowed = ['lesson_id', 'kind', 'term', 'translation', 'explanation', 'example', 'source_ref', 'status'];
      else { must_(op === 'insert', 'forbidden'); allowed = ['lesson_id', 'term', 'translation', 'explanation', 'example', 'source_ref']; force = { kind: 'word', status: 'pending', author: uid }; }
      break;
    case 'questions':
      if (isT) allowed = ['lesson_id', 'question', 'options', 'correct', 'explanation', 'status'];
      else { must_(op === 'insert', 'forbidden'); allowed = ['lesson_id', 'question', 'options', 'correct', 'explanation']; force = { status: 'pending', author: uid }; }
      break;
    case 'progress': allowed = ['card_id', 'box', 'due', 'right_count', 'wrong_count', 'learned', 'updated_at']; force = { user_id: uid }; break;
    case 'attempts': must_(op === 'insert', 'forbidden'); allowed = ['lesson_id', 'score', 'total', 'duration_s']; force = { user_id: uid }; break;
    case 'homework_answers': allowed = ['lesson_id', 'answer']; force = { user_id: uid }; break;
    case 'diary': allowed = ['day', 'body']; force = { user_id: uid }; break;
    case 'posts': must_(op === 'insert', 'forbidden'); allowed = ['lesson_id', 'parent_id', 'body']; force = { user_id: uid }; break;
    case 'attendance': needT(); allowed = ['lesson_id', 'user_id', 'present']; break;
    default: fail_('forbidden');
  }
  const out = {};
  allowed.forEach((k) => { if (rec[k] !== undefined) out[k] = typed_(t, k, rec[k]); });
  Object.keys(force).forEach((k) => { out[k] = force[k]; });
  validate_(db, ctx, t, out, op);
  return out;
}
function lessonOf_(db, id) { return db.t('lessons').rows.find((l) => l.id === id) || null; }
function validate_(db, ctx, t, r, op) {
  const isT = ctx.role === 'teacher', ins = op === 'insert';
  if (t === 'profiles') {
    if (ins) {
      r.first_name = String(r.first_name || '').trim(); r.last_name = String(r.last_name || '').trim();
      must_(NAME_RE.test(r.first_name) && r.last_name.split(/\s+/).every((w) => NAME_RE.test(w)), 'Нужны настоящие имя и фамилия (только буквы)');
      r.code = String(r.code || '').trim().toUpperCase(); must_(/^[A-Z0-9]{4,16}$/.test(r.code), 'Некорректный код');
      must_(!db.t('profiles').rows.some((p) => p.code === r.code), 'duplicate key (code)');
    }
    if (r.mentor) must_(db.t('profiles').rows.some((p) => p.uid === r.mentor), 'Наставник не найден');
    if (r.level !== undefined && r.level !== null) must_(LEVELS[r.level], 'Уровень: beginner, intermediate или advanced');
  } else if (t === 'lessons') {
    if (ins || r.title !== undefined) must_(!blank_(r.title), 'Укажите название урока');
    if (r.num !== undefined) must_(r.num >= 1, 'Номер урока ≥ 1');
    ['test_minutes', 'test_attempts'].forEach((k) => { if (r[k] !== undefined) must_(r[k] >= 1 && r[k] <= 240, 'Некорректное значение ' + k); });
  } else if (t === 'cards') {
    if (ins || r.term !== undefined) must_(!blank_(r.term), 'Укажите слово');
    if (ins || r.translation !== undefined) must_(!blank_(r.translation), 'Укажите перевод');
    if (ins || r.explanation !== undefined) must_(r.explanation && String(r.explanation).trim().length >= 3, 'Объяснение обязательно (минимум 3 символа)');
    if (r.kind !== undefined) must_(r.kind === 'word' || r.kind === 'idea', 'Тип: word или idea');
    if (r.status !== undefined) must_(r.status === 'approved' || r.status === 'pending', 'bad status');
    if (ins) { const l = lessonOf_(db, r.lesson_id); must_(l, 'Урок не найден'); if (!isT) must_(l.published, 'Урок не опубликован'); }
  } else if (t === 'questions') {
    if (ins || r.question !== undefined) must_(!blank_(r.question), 'Укажите вопрос');
    if (ins || r.options !== undefined) must_(Array.isArray(r.options) && r.options.length === 4 && r.options.every((o) => !blank_(o)), 'Нужно 4 непустых варианта');
    if (ins || r.correct !== undefined) must_(r.correct >= 0 && r.correct <= 3 && Math.floor(r.correct) === r.correct, 'Неверный номер верного ответа');
    if (ins || r.explanation !== undefined) must_(r.explanation && String(r.explanation).trim().length >= 3, 'Объяснение обязательно (минимум 3 символа)');
    if (ins) { const l = lessonOf_(db, r.lesson_id); must_(l, 'Урок не найден'); if (!isT) must_(l.published, 'Урок не опубликован'); }
  } else if (t === 'progress') {
    if (r.card_id !== undefined) must_(db.t('cards').rows.some((c) => c.id === r.card_id), 'Карточка не найдена');
    if (r.box !== undefined) must_(r.box >= 0 && r.box <= 5, 'bad box');
    ['right_count', 'wrong_count'].forEach((k) => { if (r[k] !== undefined) must_(r[k] >= 0 && r[k] < 100000, 'bad ' + k); });
    if (r.due !== undefined) must_(/^\d{4}-\d{2}-\d{2}$/.test(r.due), 'bad due');
    if (r.learned) must_(r.right_count >= 2, 'bad learned');
  } else if (t === 'attempts') {
    const l = lessonOf_(db, r.lesson_id); must_(l, 'Урок не найден');
    must_(r.total >= 1 && r.total <= 200 && r.score >= 0 && r.score <= r.total, 'Некорректный результат');
    if (!isT) {
      must_(l.published && l.test_open, 'Тест закрыт');
      must_(db.t('attempts').rows.filter((a) => a.user_id === ctx.uid && a.lesson_id === r.lesson_id).length < l.test_attempts, 'Попытки закончились');
    }
  } else if (t === 'homework_answers') {
    const l = lessonOf_(db, r.lesson_id); must_(l && (isT || l.published), 'Урок не найден');
    must_(r.answer && String(r.answer).trim().length >= 3, 'Ответ слишком короткий');
  } else if (t === 'diary') {
    must_(r.day === today_(), 'Дневник можно вести только за сегодня');
    must_(r.body && String(r.body).trim().length >= 3, 'Запись слишком короткая');
  } else if (t === 'posts') {
    const l = lessonOf_(db, r.lesson_id); must_(l, 'Урок не найден');
    must_(isT || (l.published && l.discussion_open), 'Обсуждение закрыто');
    must_(r.body && String(r.body).trim().length >= 1 && String(r.body).length <= 2000, 'Сообщение пустое или слишком длинное');
    if (r.parent_id) must_(db.t('posts').rows.some((p) => p.id === r.parent_id && p.lesson_id === r.lesson_id), 'Родительское сообщение не найдено');
  } else if (t === 'attendance') {
    must_(lessonOf_(db, r.lesson_id), 'Урок не найден');
    must_(db.t('profiles').rows.some((p) => p.uid === r.user_id), 'Ученик не найден');
  }
}
function defaults_(t, ctx) {
  const now = nowIso_();
  switch (t) {
    case 'profiles': return { uid: uuid_(), role: 'student', pwv: 0, level: 'intermediate', created_at: now };
    case 'lessons': return { id: uuid_(), num: 1, discussion_open: false, test_open: false, test_minutes: 15, test_attempts: 2, published: false, created_at: now };
    case 'cards': return { id: uuid_(), kind: 'word', status: 'approved', created_at: now };
    case 'questions': return { id: uuid_(), status: 'pending', created_at: now };
    case 'progress': return { box: 0, due: today_(), right_count: 0, wrong_count: 0, learned: false, updated_at: now };
    case 'attempts': return { id: uuid_(), created_at: now };
    case 'homework_answers': return { created_at: now };
    case 'posts': return { id: uuid_(), created_at: now };
    case 'attendance': return { present: true };
    default: return {};
  }
}
function cascade_(db, t, gone) {
  if (!gone.length) return;
  const ids = {}; gone.forEach((r) => { ids[r.id || r.uid] = true; });
  if (t === 'lessons') {
    ['cards', 'questions', 'posts', 'attempts', 'homework_answers', 'attendance'].forEach((n) => {
      const removed = db.t(n).remove((r) => ids[r.lesson_id]); if (n === 'cards') cascade_(db, 'cards', removed);
    });
  } else if (t === 'cards') db.t('progress').remove((r) => ids[r.card_id]);
  else if (t === 'posts') db.t('posts').remove((r) => ids[r.parent_id]);
  else if (t === 'profiles') {
    ['progress', 'attempts', 'points_log', 'homework_answers', 'diary', 'attendance', 'posts'].forEach((n) => db.t(n).remove((r) => ids[r.user_id]));
    ['cards', 'questions'].forEach((n) => { const tb = db.t(n); tb.rows.forEach((r) => { if (ids[r.author]) { r.author = null; tb.touch(r); } }); });
    const tp = db.t('profiles'); tp.rows.forEach((r) => { if (ids[r.mentor]) { r.mentor = null; tp.touch(r); } });
  }
}
function queryCall_(db, ctx, q) {
  const t = q.t, isT = ctx.role === 'teacher', uid = ctx.uid;
  if (t !== 'people' && !SCHEMA[t]) fail_('unknown table');
  if (q.op === 'select') {
    const rows = selectRows_(db, ctx, q);
    if (q.single || q.maybe) { if (rows.length === 1) return ok_(rows[0]); if (!rows.length && q.maybe) return ok_(null); fail_(rows.length ? 'multiple rows' : 'no rows'); }
    return ok_(rows);
  }
  if (t === 'people' || t === 'points_log') fail_('forbidden');
  const tab = db.t(t), match = makeMatcher_(q.filters || []);
  const ownTables = ['progress', 'homework_answers', 'diary'];
  if (q.op === 'insert' || q.op === 'upsert') {
    const arr = Array.isArray(q.payload) ? q.payload : [q.payload], out = [];
    arr.forEach((rec) => {
      const r = prepareWrite_(db, ctx, t, rec || {}, q.op);
      const hasNat = SCHEMA[t].pk.length > 1;
      const ex = hasNat ? tab.findPk(Object.assign({}, defaults_(t, ctx), r)) : null;
      if (ex) {
        if (q.op === 'insert') fail_('duplicate key');
        Object.keys(r).forEach((k) => { ex[k] = r[k]; }); tab.touch(ex); out.push(ex);
      } else {
        const row = tab.insert(Object.assign(defaults_(t, ctx), r));
        if (t === 'profiles') { row.role = 'student'; if (!row.level) row.level = 'intermediate'; }
        out.push(row);
      }
    });
    const pubd = out.map((r) => pub_(t, r));
    return ok_(q.single ? pubd[0] : pubd);
  }
  if (q.op === 'update') {
    const rows = tab.rows.filter(match), out = [];
    rows.forEach((row) => {
      if (ownTables.indexOf(t) >= 0) must_(row.user_id === uid, 'forbidden'); else must_(isT, 'forbidden');
      const r = prepareWrite_(db, ctx, t, q.payload || {}, 'update');
      Object.keys(r).forEach((k) => { row[k] = r[k]; }); tab.touch(row); out.push(pub_(t, row));
    });
    return ok_(out);
  }
  if (q.op === 'delete') {
    const gone = tab.remove((row) => {
      if (!match(row)) return false;
      if (isT) { if (t === 'profiles') must_(row.role !== 'teacher', 'Нельзя удалить учителя'); return ['lessons', 'cards', 'questions', 'posts', 'profiles', 'attendance'].indexOf(t) >= 0 || fail_('forbidden'); }
      if ((t === 'cards' || t === 'questions') && row.author === uid && row.status === 'pending') return true;
      if (t === 'posts' && row.user_id === uid) return true;
      return fail_('forbidden');
    });
    cascade_(db, t, gone);
    return ok_(gone.length);
  }
  return fail_('unsupported');
}

// ---------------------------------------------------------------- функции (RPC)
function rpcCall_(db, ctx, name, a) {
  if (name === 'check_invite') {
    const code = String(a.p_code || '').trim().toUpperCase(), p = db.t('profiles').rows.find((r) => r.code === code);
    return ok_(p ? [{ first_name: p.first_name, last_name: p.last_name, claimed: !!p.auth_id }] : []);
  }
  if (!ctx) fail_('unauthorized');
  const isT = ctx.role === 'teacher', uid = ctx.uid;
  const needT = () => must_(isT, 'forbidden');
  switch (name) {
    case 'claim_invite': {   // регистрация уже выполнена в signUp
      const me = db.t('profiles').rows.find((r) => r.uid === uid);
      must_(me && me.code === String(a.p_code || '').trim().toUpperCase(), 'invalid_code'); return ok_(null);
    }
    case 'touch': {
      const me = db.t('profiles').rows.find((r) => r.uid === uid);
      if (me && (!me.last_seen || Date.now() - new Date(me.last_seen).getTime() > 5 * 60000)) { me.last_seen = nowIso_(); db.t('profiles').touch(me); }
      return ok_(null);
    }
    case 'award': return ok_(award_(db, uid, a));
    case 'teacher_award': {
      needT();
      const d = Number(a.p_delta); must_(!isNaN(d) && d >= -100 && d <= 100, 'bad_delta');
      must_(db.t('profiles').rows.some((p) => p.uid === a.p_uid), 'Ученик не найден');
      const log = db.t('points_log'), ref = a.p_ref ? String(a.p_ref) : uuid_(), reason = String(a.p_reason || 'bonus');
      let row = log.rows.find((r) => r.user_id === a.p_uid && r.reason === reason && r.ref === ref);
      if (row) { row.delta = d; row.note = a.p_note || null; row.updated_at = nowIso_(); log.touch(row); }
      else log.insert({ user_id: a.p_uid, reason: reason, ref: ref, delta: d, note: a.p_note || null, updated_at: nowIso_() });
      return ok_(null);
    }
    case 'leaderboard': {
      const wsDate = weekStart_(today_()), off = Utilities.formatDate(new Date(), TZ, 'XXX');
      const thr = new Date(wsDate + 'T00:00:00' + off).toISOString(), m = {};
      db.t('points_log').rows.forEach((r) => {
        const o = m[r.user_id] || (m[r.user_id] = { user_id: r.user_id, total: 0, week: 0 });
        o.total += r.delta; if (r.reason !== 'weekly_top' && r.updated_at >= thr) o.week += r.delta;
      });
      return ok_(Object.keys(m).map((k) => m[k]));
    }
    case 'checkins': {
      const from = addDays_(today_(), -(Number(a.p_days) || 21));
      return ok_(db.t('points_log').rows.filter((r) => r.reason === 'checkin' && r.ref >= from).map((r) => ({ user_id: r.user_id, day: r.ref })));
    }
    case 'progress_summary': {
      needT(); const m = {};
      db.t('progress').rows.forEach((p) => { const o = m[p.user_id] || (m[p.user_id] = { user_id: p.user_id, seen: 0, learned: 0, right_total: 0, wrong_total: 0 }); o.seen++; if (p.learned) o.learned++; o.right_total += p.right_count; o.wrong_total += p.wrong_count; });
      return ok_(Object.keys(m).map((k) => m[k]));
    }
    case 'card_stats': {
      needT(); const m = {};
      db.t('progress').rows.forEach((p) => { const o = m[p.card_id] || (m[p.card_id] = { card_id: p.card_id, users: 0, right_total: 0, wrong_total: 0 }); o.users++; o.right_total += p.right_count; o.wrong_total += p.wrong_count; });
      return ok_(Object.keys(m).map((k) => m[k]));
    }
    case 'test_summary': {
      needT(); const m = {};
      db.t('attempts').rows.forEach((x) => { const k = x.user_id + x.lesson_id, o = m[k] || (m[k] = { user_id: x.user_id, lesson_id: x.lesson_id, best: 0, total: 0, tries: 0 }); o.best = Math.max(o.best, x.score); o.total = Math.max(o.total, x.total); o.tries++; });
      return ok_(Object.keys(m).map((k) => m[k]));
    }
    case 'reset_password': {
      needT();
      const p = db.t('profiles').rows.find((r) => r.uid === a.p_uid);
      must_(p && p.role === 'student', 'Ученик не найден');
      p.auth_id = null; p.salt = null; p.hash = null; p.pwv = (p.pwv || 0) + 1; db.t('profiles').touch(p);
      return ok_(null);
    }
    case 'upload_slide': {
      needT();
      const b64 = String(a.b64 || ''); must_(b64.length > 0 && b64.length * 0.75 <= MAX_UPLOAD_MB * 1048576, 'Файл пустой или больше ' + MAX_UPLOAD_MB + ' МБ');
      const name = String(a.name || 'presentation').replace(/[^\p{L}\p{N}._ \-]/gu, '_').slice(0, 120);
      const blob = Utilities.newBlob(Utilities.base64Decode(b64), String(a.mime || 'application/octet-stream'), name);
      const props = PropertiesService.getScriptProperties(); let folder;
      try { folder = DriveApp.getFolderById(props.getProperty('FOLDER')); }
      catch (e) { folder = DriveApp.createFolder('Лемалар — презентации'); props.setProperty('FOLDER', folder.getId()); }
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return ok_(file.getUrl());
    }
  }
  return fail_('no rpc ' + name);
}
function award_(db, uid, a) {
  const reason = String(a.p_reason), ref = String(a.p_ref), today = today_();
  const caps = { learn_card: 5, practice: 40, test: 150, checkin: 10, homework: 10, diary: 2 }, baseCap = caps[reason];
  if (baseCap === undefined) fail_('bad_reason');
  const me = db.t('profiles').rows.find((p) => p.uid === uid), lv = LEVELS[me && me.level] || LEVELS.intermediate;
  const mult = MULTIPLIED.indexOf(reason) >= 0 ? lv.mult : 1;
  const cap = Math.round(baseCap * mult);
  const pts = Math.min(Math.round(Math.min(Math.max(Math.floor(Number(a.p_delta) || 0), 0), baseCap) * mult), cap);
  if (['practice', 'checkin', 'diary'].indexOf(reason) >= 0) must_(ref === today, 'bad_ref');
  if (reason === 'learn_card') must_(db.t('progress').rows.some((p) => p.user_id === uid && p.card_id === ref && p.learned), 'not_learned');
  if (reason === 'homework') must_(db.t('homework_answers').rows.some((h) => h.user_id === uid && h.lesson_id === ref), 'no_homework');
  if (reason === 'diary') must_(db.t('diary').rows.some((d) => d.user_id === uid && d.day === ref), 'no_diary');
  if (reason === 'test') must_(db.t('attempts').rows.some((x) => x.user_id === uid && x.lesson_id === ref), 'no_attempt');
  const log = db.t('points_log'); let row = log.rows.find((r) => r.user_id === uid && r.reason === reason && r.ref === ref);
  const before = row ? row.delta : 0;
  if (!row) row = log.insert({ user_id: uid, reason: reason, ref: ref, delta: pts, note: null, updated_at: nowIso_() });
  else if (reason === 'practice') { row.delta = Math.min(cap, row.delta + pts); row.updated_at = nowIso_(); log.touch(row); }
  else if (reason === 'test' && pts > row.delta) { row.delta = pts; row.updated_at = nowIso_(); log.touch(row); }
  const gained = row.delta - before;
  if (gained > 0 && MULTIPLIED.indexOf(reason) >= 0) mentorShare_(db, me, gained, today);
  return gained;
}
// Наставник уровнем выше получает долю баллов подопечного (до MENTOR_DAILY_CAP в день).
function mentorShare_(db, mentee, gained, today) {
  if (!mentee || !mentee.mentor) return;
  const mentor = db.t('profiles').rows.find((p) => p.uid === mentee.mentor);
  if (!mentor) return;
  const rm = (LEVELS[mentor.level] || LEVELS.intermediate).rank, re = (LEVELS[mentee.level] || LEVELS.intermediate).rank;
  if (rm <= re) return;
  const share = Math.max(1, Math.round(gained * MENTOR_SHARE)), log = db.t('points_log'), ref = mentee.uid + ':' + today;
  let row = log.rows.find((r) => r.user_id === mentor.uid && r.reason === 'mentor_share' && r.ref === ref);
  if (!row) log.insert({ user_id: mentor.uid, reason: 'mentor_share', ref: ref, delta: Math.min(MENTOR_DAILY_CAP, share), note: 'за помощь: ' + mentee.first_name + ' ' + mentee.last_name, updated_at: nowIso_() });
  else { row.delta = Math.min(MENTOR_DAILY_CAP, row.delta + share); row.updated_at = nowIso_(); log.touch(row); }
}

// ---------------------------------------------------------------- установка и сервис
/** Запустить ОДИН раз из редактора: создаёт листы и запись учителя. */
function setup() {
  const ss = SpreadsheetApp.getActive(), props = PropertiesService.getScriptProperties();
  props.setProperty('SSID', ss.getId());
  if (!props.getProperty('SECRET')) props.setProperty('SECRET', uuid_() + uuid_() + uuid_());
  Object.keys(SCHEMA).forEach((name) => {
    const cols = SCHEMA[name].cols;
    let sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols.map((c) => c.n)]).setFontWeight('bold').setBackground('#e3f0ec');
    sh.setFrozenRows(1);
  });
  ['Sheet1', 'Лист1'].forEach((n) => { const s = ss.getSheetByName(n); if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s); });
  const db = new DB_(), profs = db.t('profiles');
  let t = profs.rows.find((r) => r.role === 'teacher');
  if (!t) {
    const code = (TEACHER_CODE || '').trim().toUpperCase() || randomCode_(10);
    must_(NAME_RE.test(TEACHER_FIRST) && NAME_RE.test(TEACHER_LAST) && TEACHER_FIRST !== 'Имя', 'Впишите свои имя и фамилию в настройках вверху файла и запустите setup() снова');
    t = profs.insert({ uid: uuid_(), code: code, first_name: TEACHER_FIRST, last_name: TEACHER_LAST, role: 'teacher', pwv: 0, level: 'advanced', created_at: nowIso_() });
  }
  db.commit();
  const msg = 'Готово! Код учителя для регистрации: ' + t.code + ' (он же виден на листе profiles).';
  Logger.log(msg); ss.toast(msg, 'Лемалар', 30);
  return msg;
}
function randomCode_(n) {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s = '';
  for (let i = 0; i < n; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Лемалар').addItem('Обновить лист «Сводка»', 'refreshSummary').addToUi();
}
/** Лист «Сводка» — удобная таблица по ученикам для печати/диаграмм. Обновляется из меню «Лемалар». */
function refreshSummary() {
  const db = new DB_(), ss = db.ss, today = today_();
  const profs = db.t('profiles').rows.filter((p) => p.role === 'student');
  const log = db.t('points_log').rows, prog = db.t('progress').rows, att = db.t('attempts').rows, hw = db.t('homework_answers').rows, at = db.t('attendance').rows;
  const pub = db.t('lessons').rows.filter((l) => l.published), pubIds = {}; pub.forEach((l) => { pubIds[l.id] = true; });
  const wsDate = weekStart_(today), off = Utilities.formatDate(new Date(), TZ, 'XXX'), thr = new Date(wsDate + 'T00:00:00' + off).toISOString();
  const head = ['Фамилия', 'Имя', 'Команда', 'Уровень турецкого', 'Баллы всего', 'За неделю', 'Серия, дн.', 'Слов выучено', 'Средний тест, %', 'ДЗ сдано', 'Посещений', 'Последний вход'];
  const rows = profs.sort((a, b) => String(a.last_name).localeCompare(String(b.last_name))).map((p) => {
    const mine = log.filter((r) => r.user_id === p.uid);
    const total = mine.reduce((s, r) => s + r.delta, 0), week = mine.filter((r) => r.reason !== 'weekly_top' && r.updated_at >= thr).reduce((s, r) => s + r.delta, 0);
    const days = {}; mine.filter((r) => r.reason === 'checkin').forEach((r) => { days[r.ref] = true; });
    let d = days[today] ? today : addDays_(today, -1), streak = 0; while (days[d]) { streak++; d = addDays_(d, -1); }
    const best = {}; att.filter((x) => x.user_id === p.uid && pubIds[x.lesson_id]).forEach((x) => { const v = x.total ? x.score / x.total : 0; if (!(x.lesson_id in best) || v > best[x.lesson_id]) best[x.lesson_id] = v; });
    const bl = Object.keys(best), avg = bl.length ? Math.round(bl.reduce((s, k) => s + best[k], 0) / bl.length * 100) : '';
    return [p.last_name, p.first_name, p.team || '', p.level || '', total, week, streak, prog.filter((x) => x.user_id === p.uid && x.learned).length, avg,
      hw.filter((h) => h.user_id === p.uid && pubIds[h.lesson_id]).length, at.filter((x) => x.user_id === p.uid && x.present).length, p.last_seen || ''];
  });
  let sh = ss.getSheetByName('Сводка') || ss.insertSheet('Сводка', 0);
  sh.clear(); sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#e3f0ec'); sh.setFrozenRows(1);
  if (rows.length) sh.getRange(2, 1, rows.length, head.length).setValues(rows);
  sh.autoResizeColumns(1, head.length);
  ss.toast('Сводка обновлена: ' + today, 'Лемалар', 5);
}
