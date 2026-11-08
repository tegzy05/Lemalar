// ============================================================
//  ДЕМО-режим: имитация Supabase в localStorage (только для проверки интерфейса).
//  Реализует ту же часть API, которую использует приложение.
// ============================================================
function createMock() {
  const KEY = "lemalar_demo_v1";
  const PK = {
    profiles: ["uid"], lessons: ["id"], cards: ["id"], questions: ["id"], progress: ["user_id", "card_id"],
    attempts: ["id"], points_log: ["user_id", "reason", "ref"], homework_answers: ["lesson_id", "user_id"],
    diary: ["user_id", "day"], posts: ["id"], attendance: ["lesson_id", "user_id"],
  };
  const DEFAULTS = {
    lessons: () => ({ id: uuid(), num: 1, discussion_open: false, test_open: false, test_minutes: 15, test_attempts: 2, published: false, created_at: new Date().toISOString() }),
    cards: () => ({ id: uuid(), kind: "word", status: "approved", created_at: new Date().toISOString() }),
    questions: () => ({ id: uuid(), status: "pending", created_at: new Date().toISOString() }),
    progress: () => ({ box: 0, due: todayKZ(), right_count: 0, wrong_count: 0, learned: false, updated_at: new Date().toISOString() }),
    attempts: () => ({ id: uuid(), created_at: new Date().toISOString() }),
    posts: () => ({ id: uuid(), created_at: new Date().toISOString() }),
    homework_answers: () => ({ created_at: new Date().toISOString() }),
    profiles: () => ({ uid: uuid(), auth_id: null, role: "student", team: null, mentor: null, level: "intermediate", last_seen: null, created_at: new Date().toISOString() }),
    diary: () => ({}), attendance: () => ({ present: true }), points_log: () => ({ updated_at: new Date().toISOString() }),
  };

  function seed() {
    const t = todayKZ();
    const db = { accounts: [], session: null };
    for (const k of Object.keys(PK)) db[k] = [];
    const mk = (code, f, l, role, team, level = "intermediate") => {
      const p = { ...DEFAULTS.profiles(), code, first_name: f, last_name: l, role, team, level };
      db.profiles.push(p); return p;
    };
    const teacher = mk("TEACHER01", "Демо", "Учитель", "teacher", null, "advanced");
    const st = [
      mk("AIGERIM1", "Айгерим", "Сейтова", "student", "Бирлик", "advanced"),
      mk("DANIYAR2", "Данияр", "Ахметов", "student", "Нур", "beginner"),
      mk("ZHANSAYA", "Жансая", "Нурланова", "student", "Бирлик"),
      mk("ERLAN333", "Ерлан", "Касымов", "student", "Нур", "beginner"),
      mk("MADINA44", "Мадина", "Оразова", "student", "Бирлик"),
      mk("TEMIRLAN", "Темирлан", "Бекенов", "student", "Нур"),
    ];
    st[1].mentor = st[0].uid; st[3].mentor = st[0].uid;
    // зарегистрируем учителя и трёх учеников (пароль demo123)
    [teacher, st[0], st[1], st[2]].forEach((p) => {
      const id = uuid(); p.auth_id = id; p.last_seen = new Date(Date.now() - Math.random() * 3 * 86400000).toISOString();
      db.accounts.push({ id, email: `${p.code.toLowerCase()}@tutors.lemalar.app`, password: "demo123" });
    });
    const L1 = { ...DEFAULTS.lessons(), num: 1, title: "Основы: размышление и благодарность", lesson_date: addDays(t, -2), published: true, test_open: true,
      summary: "Разбираем ключевые понятия вступительной части: тафаккур, шукр, ихлас. Цель — понимать, а не только переводить.",
      slides_url: "", discussion_topic: "Где в вашей повседневной жизни есть место для «тафаккура»? Приведите конкретный пример.", discussion_open: true,
      homework: "Своими словами объясните в 2–3 предложениях, что такое ихлас и чем он отличается от показного поведения.", homework_due: addDays(t, 5) };
    const L2 = { ...DEFAULTS.lessons(), num: 2, title: "Терпение и упование (черновик)", lesson_date: addDays(t, 5), published: false, summary: "Черновик следующего урока." };
    db.lessons.push(L1, L2);
    const cards = [
      ["Тафаккур", "размышление", "Осознанное размышление над окружающим миром и над собой с целью сделать выводы и прийти к истине. Это не просто «подумать», а рассматривать явления как знаки и смыслы.", "Размышление над устройством живого организма как повод задуматься о Творце.", "Пример (демо)", "word"],
      ["Шукр", "благодарность", "Осознанная признательность за дарованное: не только слова, но и отношение к благам и их правильное использование.", "Благодарность за здоровье выражается заботой о нём.", "Пример (демо)", "word"],
      ["Ихлас", "искренность", "Совершать дело ради Всевышнего, без показности и ожидания похвалы людей. Чистота намерения.", "Помогать, не рассказывая об этом.", "Пример (демо)", "word"],
      ["Сабр", "терпение", "Стойкость в трудностях, а также в послушании и в удержании себя от запретного. Не пассивность, а активная выдержка.", "Продолжать учёбу, несмотря на усталость.", "Пример (демо)", "word"],
      ["Таухид", "единобожие", "Признание единственности Бога как основа мировоззрения: всё в мире указывает на единого Творца.", "", "Пример (демо)", "word"],
      ["Хикмет", "мудрость", "Умение видеть цель и смысл вещей и поступать в соответствии с ними.", "Увидеть смысл трудности и извлечь урок.", "Пример (демо)", "word"],
      ["Почему важно ежедневное чтение?", "регулярность помогает понять", "Смыслы раскрываются постепенно: повторение и регулярность превращают текст из набора слов в понятую мысль. Небольшая ежедневная доза лучше редкого длинного чтения.", "", "Идея урока (демо)", "idea"],
      ["Намерение (ният)", "основа поступка", "Один и тот же внешний поступок может иметь разную ценность в зависимости от того, ради чего он совершён.", "", "Идея урока (демо)", "idea"],
    ];
    cards.forEach(([term, tr, ex, exm, src, kind]) => db.cards.push({ ...DEFAULTS.cards(), lesson_id: L1.id, term, translation: tr, explanation: ex, example: exm, source_ref: src, kind }));
    db.cards.push({ ...DEFAULTS.cards(), lesson_id: L1.id, term: "Кульфет", translation: "забота", explanation: "Предложено учеником (демо) — ждёт проверки.", status: "pending", author: st[0].uid });
    db.questions.push({ id: uuid(), lesson_id: L1.id, author: st[2].uid, question: "Что отличает ихлас от показного поведения?", options: ["Количество поступков", "Чистота намерения", "Громкость слов", "Время суток"], correct: 1, explanation: "Ихлас — это намерение совершать дело ради Всевышнего, без расчёта на похвалу людей.", status: "approved", created_at: new Date().toISOString() });
    // немного истории баллов
    const addPts = (u, reason, ref, delta, ago = 0) => db.points_log.push({ user_id: u.uid, reason, ref, delta, updated_at: new Date(Date.now() - ago * 86400000).toISOString() });
    [[st[0], 5], [st[1], 3], [st[2], 4]].forEach(([u, n]) => { for (let i = 0; i < n; i++) addPts(u, "checkin", addDays(t, -i - (u === st[1] ? 1 : 0)), 3 + Math.min(i, 5), i); });
    addPts(st[0], "test", L1.id, 24, 2); addPts(st[1], "test", L1.id, 16, 2); addPts(st[2], "test", L1.id, 20, 2);
    addPts(st[0], "attendance", L1.id, 10, 2); addPts(st[1], "attendance", L1.id, 10, 2);
    addPts(st[0], "practice", addDays(t, -1), 22, 1); addPts(st[2], "practice", addDays(t, -1), 12, 1); addPts(st[1], "practice", addDays(t, -2), 8, 2);
    addPts(st[0], "homework", L1.id, 10, 1);
    db.homework_answers.push({ lesson_id: L1.id, user_id: st[0].uid, answer: "Ихлас — это когда я делаю доброе дело только ради Бога, а не чтобы меня похвалили.", created_at: new Date().toISOString() });
    db.attempts.push({ id: uuid(), user_id: st[0].uid, lesson_id: L1.id, score: 12, total: 9 + 0, duration_s: 300, created_at: new Date(Date.now() - 2 * 86400000).toISOString() });
    db.attempts[0].score = 9; db.attempts[0].total = 9;
    db.posts.push({ id: uuid(), lesson_id: L1.id, parent_id: null, user_id: st[0].uid, body: "Мне кажется, тафаккур — это ещё и привычка останавливаться перед сном и вспоминать день.", created_at: new Date(Date.now() - 86400000).toISOString() });
    return db;
  }

  let db = null;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (!db) db = seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
  const authUid = () => db.session;
  const meRow = () => db.profiles.find((p) => p.auth_id === db.session);
  const meUid = () => meRow()?.uid || null;
  const isTeacher = () => meRow()?.role === "teacher";
  const ok = (data) => ({ data, error: null });
  const fail = (message) => ({ data: null, error: { message } });
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function execQuery(q) {
    let table = q.table;
    let rows;
    if (table === "people") {
      rows = db.profiles.map((p) => ({ uid: p.uid, first_name: p.first_name, last_name: p.last_name, role: p.role, team: p.team, mentor: p.mentor, level: p.level, last_seen: p.last_seen, registered: !!p.auth_id }));
    } else rows = db[table];
    if (!rows) return fail("unknown table " + table);
    const match = (r) => q.filters.every(([op, k, v]) => {
      const x = r[k];
      if (op === "eq") return x === v; if (op === "neq") return x !== v;
      if (op === "in") return v.includes(x); if (op === "gte") return x >= v; if (op === "lte") return x <= v;
      return true;
    });
    // простая проверка прав для демо
    const teacher = isTeacher(), uid = meUid();
    if (table !== "people" && q.op !== "select" && !db.session) return fail("not authenticated");
    if (q.op === "select") {
      let out = rows.filter(match);
      if (!teacher) {
        if (table === "profiles") out = out.filter((r) => r.auth_id === db.session);
        if (["progress", "attempts", "homework_answers", "diary", "attendance"].includes(table)) out = out.filter((r) => r.user_id === uid);
        if (table === "lessons") out = out.filter((r) => r.published);
        if (table === "cards" || table === "questions") {
          const pub = new Set(db.lessons.filter((l) => l.published).map((l) => l.id));
          out = out.filter((r) => r.author === uid || (r.status === "approved" && pub.has(r.lesson_id)));
        }
      }
      if (q.order) out = out.slice().sort((a, b) => { const x = a[q.order.col], y = b[q.order.col]; return (x > y ? 1 : x < y ? -1 : 0) * (q.order.asc ? 1 : -1); });
      if (q.limit) out = out.slice(0, q.limit);
      out = clone(out);
      if (q.single || q.maybe) { if (out.length === 1) return ok(out[0]); if (!out.length) return q.maybe ? ok(null) : fail("no rows"); return fail("multiple rows"); }
      return ok(out);
    }
    if (table === "people") return fail("read-only");
    const needTeacher = ["lessons", "attendance"].includes(table) || (table === "profiles") || ((table === "cards" || table === "questions") && q.op !== "insert");
    if (needTeacher && !teacher && !(table === "cards" || table === "questions")) return fail("forbidden");
    const pkOf = (r) => PK[table].map((k) => r[k]).join("|");
    if (q.op === "insert" || q.op === "upsert") {
      const arr = Array.isArray(q.payload) ? q.payload : [q.payload];
      const out = [];
      if ((table === "cards" || table === "questions") && !teacher) {
        if (arr.some((r) => r.author !== uid || r.status !== "pending")) return fail("forbidden");
      } else if (needTeacher && !teacher) return fail("forbidden");
      for (const r of arr) {
        if (table === "cards" && (!r.explanation || r.explanation.trim().length < 3)) return fail("Объяснение обязательно");
        const full = { ...DEFAULTS[table](), ...r };
        const ex = db[table].find((e) => pkOf(e) === pkOf(full));
        if (ex) {
          if (q.op === "insert") return fail("duplicate key");
          Object.assign(ex, r); if ("updated_at" in ex) ex.updated_at = new Date().toISOString(); out.push(clone(ex));
        } else {
          if (table === "profiles" && db.profiles.some((p) => p.code === full.code)) return fail("duplicate key (code)");
          db[table].push(full); out.push(clone(full));
        }
      }
      save(); return ok(q.single ? out[0] : out);
    }
    if (q.op === "update") {
      const out = [];
      for (const r of db[table]) if (match(r)) {
        if (!teacher && !(["progress", "homework_answers", "diary"].includes(table) && r.user_id === uid)) return fail("forbidden");
        Object.assign(r, q.payload); out.push(clone(r));
      }
      save(); return ok(out);
    }
    if (q.op === "delete") {
      const before = db[table].length;
      db[table] = db[table].filter((r) => {
        if (!match(r)) return true;
        if (teacher || r.user_id === uid || (r.author === uid && r.status === "pending")) return false;
        return true;
      });
      if (table === "lessons") { const ids = new Set(db.lessons.map((l) => l.id)); ["cards","questions","posts","attempts"].forEach((t) => (db[t] = db[t].filter((r) => ids.has(r.lesson_id)))); }
      if (table === "cards") { const ids = new Set(db.cards.map((c) => c.id)); db.progress = db.progress.filter((p) => ids.has(p.card_id)); }
      save(); return ok(before - db[table].length);
    }
    return fail("unsupported");
  }

  class Q {
    constructor(table) { this.q = { table, op: "select", filters: [] }; }
    select() { return this; }
    insert(p) { this.q.op = "insert"; this.q.payload = p; return this; }
    upsert(p) { this.q.op = "upsert"; this.q.payload = p; return this; }
    update(p) { this.q.op = "update"; this.q.payload = p; return this; }
    delete() { this.q.op = "delete"; return this; }
    eq(k, v) { this.q.filters.push(["eq", k, v]); return this; }
    neq(k, v) { this.q.filters.push(["neq", k, v]); return this; }
    in(k, v) { this.q.filters.push(["in", k, v]); return this; }
    gte(k, v) { this.q.filters.push(["gte", k, v]); return this; }
    lte(k, v) { this.q.filters.push(["lte", k, v]); return this; }
    order(col, o = {}) { this.q.order = { col, asc: o.ascending !== false }; return this; }
    limit(n) { this.q.limit = n; return this; }
    range() { return this; }
    single() { this.q.single = true; return this; }
    maybeSingle() { this.q.maybe = true; return this; }
    then(res, rej) { return Promise.resolve().then(() => execQuery(this.q)).then(res, rej); }
  }

  const points = () => db.points_log;
  const rpcs = {
    check_invite({ p_code }) {
      const p = db.profiles.find((x) => x.code === String(p_code).trim().toUpperCase());
      return ok(p ? [{ first_name: p.first_name, last_name: p.last_name, claimed: !!p.auth_id }] : []);
    },
    claim_invite({ p_code }) {
      const p = db.profiles.find((x) => x.code === String(p_code).trim().toUpperCase() && !x.auth_id);
      if (!p || !db.session) return fail("invalid_code");
      p.auth_id = db.session; save(); return ok(null);
    },
    touch() { const p = meRow(); if (p) { p.last_seen = new Date().toISOString(); save(); } return ok(null); },
    award({ p_reason, p_ref, p_delta }) {
      const uid = meUid(); if (!uid) return fail("not_registered");
      const caps = { learn_card: 5, practice: 40, test: 150, checkin: 10, homework: 10, diary: 2 };
      const base = caps[p_reason]; if (base == null) return fail("bad_reason");
      const LV = { beginner: [2, 0], intermediate: [1.5, 1], advanced: [1, 2] };
      const me = meRow(), mult = ["learn_card", "practice", "test"].includes(p_reason) ? (LV[me.level] || LV.intermediate)[0] : 1;
      const cap = Math.round(base * mult), pts = Math.min(Math.round(Math.min(Math.max(p_delta, 0), base) * mult), cap);
      let row = points().find((r) => r.user_id === uid && r.reason === p_reason && r.ref === p_ref);
      const before = row ? row.delta : 0;
      if (!row) { row = { user_id: uid, reason: p_reason, ref: p_ref, delta: pts, updated_at: new Date().toISOString() }; points().push(row); }
      else if (p_reason === "practice") { row.delta = Math.min(cap, row.delta + pts); row.updated_at = new Date().toISOString(); }
      else if (p_reason === "test" && pts > row.delta) { row.delta = pts; row.updated_at = new Date().toISOString(); }
      const gained = row.delta - before;
      const mentor = db.profiles.find((x) => x.uid === me.mentor);
      if (gained > 0 && ["learn_card", "practice", "test"].includes(p_reason) && mentor) {
        if ((LV[mentor.level] || LV.intermediate)[1] > (LV[me.level] || LV.intermediate)[1]) {
          const share = Math.max(1, Math.round(gained * 0.25)), ref = me.uid + ":" + todayKZ();
          let m = points().find((r) => r.user_id === mentor.uid && r.reason === "mentor_share" && r.ref === ref);
          if (!m) points().push({ user_id: mentor.uid, reason: "mentor_share", ref, delta: Math.min(10, share), note: "за помощь: " + me.first_name + " " + me.last_name, updated_at: new Date().toISOString() });
          else { m.delta = Math.min(10, m.delta + share); m.updated_at = new Date().toISOString(); }
        }
      }
      save(); return ok(gained);
    },
    teacher_award({ p_uid, p_reason, p_ref, p_delta, p_note }) {
      if (!isTeacher()) return fail("forbidden");
      const ref = p_ref || uuid();
      let row = points().find((r) => r.user_id === p_uid && r.reason === p_reason && r.ref === ref);
      if (row) { row.delta = p_delta; row.note = p_note; row.updated_at = new Date().toISOString(); }
      else points().push({ user_id: p_uid, reason: p_reason, ref, delta: p_delta, note: p_note, updated_at: new Date().toISOString() });
      save(); return ok(null);
    },
    reset_password({ p_uid }) {
      if (!isTeacher()) return fail("forbidden");
      const p = db.profiles.find((x) => x.uid === p_uid); if (!p) return fail("Ученик не найден");
      db.accounts = db.accounts.filter((a) => a.id !== p.auth_id); p.auth_id = null; save(); return ok(null);
    },
    upload_slide() { return fail("В демо-режиме загрузка файлов недоступна — вставьте ссылку"); },
    leaderboard() {
      const ws = weekStart(); const m = {};
      for (const r of points()) {
        const o = (m[r.user_id] ||= { user_id: r.user_id, total: 0, week: 0 });
        o.total += r.delta;
        if (r.reason !== "weekly_top" && new Date(r.updated_at).toLocaleDateString("en-CA", { timeZone: TZ }) >= ws) o.week += r.delta;
      }
      return ok(Object.values(m));
    },
    checkins({ p_days }) {
      const from = addDays(todayKZ(), -(p_days ?? 21));
      return ok(points().filter((r) => r.reason === "checkin" && r.ref >= from).map((r) => ({ user_id: r.user_id, day: r.ref })));
    },
    progress_summary() {
      if (!isTeacher()) return fail("forbidden");
      const m = {};
      for (const p of db.progress) { const o = (m[p.user_id] ||= { user_id: p.user_id, seen: 0, learned: 0, right_total: 0, wrong_total: 0 }); o.seen++; if (p.learned) o.learned++; o.right_total += p.right_count; o.wrong_total += p.wrong_count; }
      return ok(Object.values(m));
    },
    card_stats() {
      if (!isTeacher()) return fail("forbidden");
      const m = {};
      for (const p of db.progress) { const o = (m[p.card_id] ||= { card_id: p.card_id, users: 0, right_total: 0, wrong_total: 0 }); o.users++; o.right_total += p.right_count; o.wrong_total += p.wrong_count; }
      return ok(Object.values(m));
    },
    test_summary() {
      if (!isTeacher()) return fail("forbidden");
      const m = {};
      for (const a of db.attempts) { const k = a.user_id + a.lesson_id; const o = (m[k] ||= { user_id: a.user_id, lesson_id: a.lesson_id, best: 0, total: 0, tries: 0 }); o.best = Math.max(o.best, a.score); o.total = Math.max(o.total, a.total); o.tries++; }
      return ok(Object.values(m));
    },
  };

  return {
    isMock: true,
    resetDemo() { localStorage.removeItem(KEY); db = seed(); save(); },
    from: (t) => new Q(t),
    rpc: (name, args = {}) => Promise.resolve().then(() => (rpcs[name] ? rpcs[name](args) : fail("no rpc " + name))),
    auth: {
      async signUp({ email, password }) {
        if (db.accounts.some((a) => a.email === email)) return { data: null, error: { message: "User already registered" } };
        const id = uuid(); db.accounts.push({ id, email, password }); db.session = id; save();
        return { data: { user: { id }, session: { user: { id } } }, error: null };
      },
      async signInWithPassword({ email, password }) {
        const a = db.accounts.find((x) => x.email === email && x.password === password);
        if (!a) return { data: null, error: { message: "Invalid login credentials" } };
        db.session = a.id; save(); return { data: { user: { id: a.id }, session: { user: { id: a.id } } }, error: null };
      },
      async signOut() { db.session = null; save(); return { error: null }; },
      async getSession() { return { data: { session: db.session ? { user: { id: db.session } } : null }, error: null }; },
    },
  };
}
