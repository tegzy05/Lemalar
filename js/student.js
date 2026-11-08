// ============================================================
//  Экраны ученика
// ============================================================
const ACT = {}, FORM = {}, CHG = {};
const initials = (p) => ((p?.first_name?.[0] || "") + (p?.last_name?.[0] || "")).toUpperCase();
const students = () => S.people.filter((p) => p.role === "student");

function cardDetail(c) {
  return html`<div class="expl"><b class="lbl">Объяснение</b>${c.explanation}</div>
    ${c.example ? html`<div class="ex"><b class="lbl">Пример</b>${c.example}</div>` : ""}
    ${c.source_ref ? html`<div class="src">Источник: ${c.source_ref}</div>` : ""}`;
}

// ---------- ГЛАВНАЯ ----------
function homeView() {
  const me = S.me, b = myBoard(), streak = streakOf(me.uid), done = checkedToday(me.uid);
  const { due, fresh } = dueCards();
  const newN = Math.min(NEW_PER_DAY, fresh.length), dailyN = Math.min(due.length, 20) + newN;
  const pubs = S.lessons.filter((l) => l.published);
  const latest = pubs[pubs.length - 1];
  const rows = rankRows("week").slice(0, 3);
  const mentor = person(me.mentor);
  const mentees = S.people.filter((p) => p.mentor === me.uid);
  const bonus = 3 + Math.min(streak, 7);   // сколько даст отметка сегодня
  return html`
  <div class="card hero">
    <div class="small" style="opacity:.8">Ассаламу алейкум,</div>
    <h1 style="margin:0 0 8px">${me.first_name} ${me.last_name}</h1>
    <div class="row wrap">
      <span class="chip">${b.total} ★ всего</span>
      <span class="chip" style="background:#ffffff26;color:#fff">${b.week} за неделю</span>
      <span class="chip" style="background:#ffffff26;color:#fff">🔥 серия: ${streak}</span>
    </div>
    <div class="small mt" style="opacity:.85">Турецкий: ${levelOf(me).ru} · баллы за учёбу ×${String(levelOf(me).mult).replace(".", ",")}</div>
  </div>

  <div class="card ${done ? "flat" : "gold"}">
    ${done
      ? html`<div class="row"><span style="font-size:1.6rem">✅</span><div><b>Сегодня отмечено</b><div class="small muted">Серия: ${streak} дн. Так держать — понимание приходит через ежедневное чтение.</div></div></div>`
      : html`<h3>Ежедневное чтение</h3>
        <p class="small">Прочитали сегодня свою порцию Лемалар? Отметьте — получите <b>+${bonus}</b> баллов${streak ? ` (серия продолжится: ${streak + 1} дн.)` : ""}.</p>
        <button class="btn gold block" data-act="checkin">Я прочитал(а) сегодня</button>`}
  </div>

  <div class="card">
    <h3>Повторение дня</h3>
    ${dailyN
      ? html`<p class="small muted">${due.length} на повторение · ${newN} новых слов. Занимает ~5 минут.</p>
         <a class="btn block" href="#/learn/daily/mix">Начать (${dailyN})</a>`
      : html`<p class="muted">На сегодня всё повторено 🎉 Загляните завтра — или потренируйтесь по любому уроку.</p>
         <a class="btn soft block" href="#/lessons">К урокам</a>`}
  </div>

  ${latest ? html`<div class="card">
    <div class="row between"><h3 style="margin:0">Урок ${latest.num}: ${latest.title}</h3></div>
    <div class="row wrap mt">${lessonBadges(latest)}</div>
    <a class="btn soft block mt" href="#/lesson/${latest.id}">Открыть урок</a>
  </div>` : html`<div class="card muted">Первый урок появится после воскресного занятия.</div>`}

  <div class="card">
    <div class="row between"><h3 style="margin:0">Лидеры недели</h3><a href="#/board" class="small">Весь рейтинг →</a></div>
    <div class="list mt">${rows.length ? rows.map((r) => html`
      <div class="item row"><span class="rank r${r.rank}">${r.rank}</span><div class="grow">${fullName(r.p)}</div><b>${r.pts}</b></div>`) : html`<div class="muted small">Пока нет баллов за эту неделю.</div>`}</div>
  </div>

  ${mentor || mentees.length ? html`<div class="card">
    <h3>Наставничество</h3>
    ${mentor ? html`<p class="small">Ваш наставник: <b>${fullName(mentor)}</b>. Задавайте вопросы — он поможет разобраться.</p>` : ""}
    ${mentees.length ? html`<p class="small">Вы помогаете: ${mentees.map((m) => html`<b>${fullName(m)}</b> (🔥${streakOf(m.uid)})`).map((x, i) => html`${i ? ", " : ""}${x}`)}. Когда подопечный набирает баллы за учёбу, вы автоматически получаете +25% от них (до 10 в день за каждого), а учитель может добавить бонус за особую помощь.</p>` : ""}
  </div>` : ""}`;
}
function lessonBadges(l) {
  const out = [];
  if (!l.published) out.push(html`<span class="badge grey">Черновик</span>`);
  if (l.lesson_date) out.push(html`<span class="badge">${fmtDate(l.lesson_date)}</span>`);
  if (l.test_open) out.push(html`<span class="badge gold">Тест открыт</span>`);
  if (l.homework) {
    const d = S.hw.find((h) => h.lesson_id === l.id && h.user_id === S.me.uid);
    out.push(d ? html`<span class="badge ok">ДЗ сдано</span>` : html`<span class="badge ${l.homework_due && todayKZ() > l.homework_due ? "bad" : "gold"}">ДЗ${l.homework_due ? " до " + fmtDate(l.homework_due) : ""}</span>`);
  }
  if (l.discussion_open) out.push(html`<span class="badge">Обсуждение</span>`);
  return out;
}
ACT.checkin = async () => {
  const streak = streakOf(S.me.uid), today = todayKZ();
  const yesterdayDone = S.checkins[S.me.uid]?.has(addDays(today, -1));
  const newStreak = yesterdayDone ? streak + 1 : 1;
  const gained = await award("checkin", today, 3 + Math.min(newStreak - 1, 7));
  (S.checkins[S.me.uid] ||= new Set()).add(today);
  toast(gained ? `+${gained} баллов · серия ${newStreak} 🔥` : "Уже отмечено", "ok");
  render();
};

// ---------- УРОКИ ----------
function lessonsView() {
  const ls = S.lessons.slice().sort((a, b) => b.num - a.num);
  return html`<h1>Уроки</h1>
  ${ls.length ? ls.map((l) => { const st = lessonStats(l.id); return html`
    <a class="card" href="#/lesson/${l.id}" style="display:block;text-decoration:none;color:inherit">
      <div class="row between"><h3 style="margin:0">Урок ${l.num}: ${l.title}</h3></div>
      <div class="row wrap mt">${lessonBadges(l)}</div>
      <div class="row mt"><div class="bar grow"><i style="width:${st.pct}%"></i></div><span class="small muted">${st.learned}/${st.total} слов</span></div>
    </a>`; }) : html`<div class="card muted">Уроков пока нет.</div>`}`;
}

const LTABS = [["info", "Обзор"], ["words", "Слова"], ["test", "Тест"], ["hw", "ДЗ"], ["talk", "Обсуждение"]];
function lessonView(id, tab = "info") {
  const l = lessonById(id);
  if (!l) return html`<div class="card">Урок не найден. <a href="#/lessons">К урокам</a></div>`;
  const body = { info: lessonInfo, words: lessonWords, test: lessonTest, hw: lessonHw, talk: lessonTalk }[tab] || lessonInfo;
  return html`<a href="#/lessons" class="small">← Все уроки</a>
  <h1 class="mt">Урок ${l.num}: ${l.title}</h1>
  <div class="tabs">${LTABS.map(([k, n]) => html`<a href="#/lesson/${id}/${k}" class="${k === tab ? "on" : ""}">${n}</a>`)}</div>
  ${body(l)}`;
}
function lessonInfo(l) {
  const st = lessonStats(l.id), best = bestAttempt(l.id);
  const att = S.att.find((a) => a.lesson_id === l.id && a.user_id === S.me.uid);
  return html`
  <div class="card">
    <div class="row wrap">${lessonBadges(l)}</div>
    ${l.summary ? html`<p class="mt" style="white-space:pre-wrap">${l.summary}</p>` : ""}
    ${l.slides_url ? html`<a class="btn gold block mt" href="${l.slides_url}" target="_blank" rel="noopener">📑 Открыть презентацию урока</a>` : html`<p class="small muted">Презентация пока не загружена.</p>`}
  </div>
  <div class="card">
    <h3>Мой прогресс по уроку</h3>
    <div class="row"><div class="bar grow"><i style="width:${st.pct}%"></i></div><b>${st.pct}%</b></div>
    <p class="small muted">Выучено слов: ${st.learned} из ${st.total}${best ? ` · лучший результат теста: ${best.score}/${best.total}` : ""}${att ? ` · посещение: ${att.present ? "✓" : "—"}` : ""}</p>
  </div>
  <div class="card">
    <h3>Тренировка</h3>
    <div class="row wrap" style="gap:8px">
      <a class="btn" href="#/learn/${l.id}/mix">▶ Умная тренировка</a>
      <a class="btn soft" href="#/learn/${l.id}/flash">Карточки</a>
      <a class="btn soft" href="#/learn/${l.id}/choice">Выбор ответа</a>
      <a class="btn soft" href="#/learn/${l.id}/write">Письмо</a>
      <a class="btn soft" href="#/learn/${l.id}/match">Пары</a>
    </div>
    <p class="hint">В каждом режиме после ответа показывается объяснение. Баллы дают режимы с проверкой ответа (выбор, письмо, пары).</p>
  </div>`;
}

// ---------- СЛОВА ----------
function lessonWords(l) {
  const cs = lessonCards(l.id);
  const mine = S.cards.filter((c) => c.lesson_id === l.id && c.status === "pending" && c.author === S.me.uid);
  const myQ = S.questions.filter((x) => x.lesson_id === l.id && x.status === "pending" && x.author === S.me.uid);
  return html`
  <div class="card">
    <div class="row between"><h3 style="margin:0">Словарь урока (${cs.length})</h3><a class="btn sm" href="#/learn/${l.id}/mix">Учить</a></div>
    <div class="list mt">${cs.map((c) => { const p = S.progress[c.id]; return html`
      <details class="item"><summary><span class="row" style="display:inline-flex;gap:8px"><b dir="auto">${c.term}</b> — ${c.translation}
        ${p?.learned ? html`<span class="badge ok">выучено</span>` : p ? html`<span class="badge">в процессе</span>` : ""}</span></summary>
        <div class="mt">${cardDetail(c)}</div></details>`; })}
      ${cs.length ? "" : html`<div class="muted item">Слова появятся после урока.</div>`}</div>
  </div>
  <div class="card">
    <h3>Предложить своё</h3>
    <p class="small muted">Лучшие карточки и вопросы попадут в общий словарь и в тест. За одобренное — баллы от учителя.</p>
    <details><summary>➕ Предложить карточку</summary>
      <form data-form="suggestCard" class="mt"><input type="hidden" name="lesson_id" value="${l.id}">
        <label>Слово / понятие <span class="req">*</span></label><input type="text" name="term" required>
        <label>Перевод <span class="req">*</span></label><input type="text" name="translation" required>
        <label>Объяснение своими словами <span class="req">*</span></label><textarea name="explanation" required minlength="10" placeholder="Что это значит и как понимать в контексте Лемала?"></textarea>
        <label>Пример</label><input type="text" name="example">
        <label>Где в тексте (Лема, страница)</label><input type="text" name="source_ref">
        <button class="btn block mt">Отправить на проверку</button></form></details>
    <details class="mt"><summary>❓ Предложить вопрос для теста</summary>
      <form data-form="suggestQ" class="mt"><input type="hidden" name="lesson_id" value="${l.id}">
        <label>Вопрос <span class="req">*</span></label><textarea name="question" required style="min-height:60px"></textarea>
        ${[0, 1, 2, 3].map((i) => html`<label>Вариант ${i + 1} <span class="req">*</span></label>
          <div class="row"><input type="text" name="opt${i}" required><label class="switch" style="margin:0"><input type="radio" name="correct" value="${i}" ${i === 0 ? "checked" : ""}>верный</label></div>`)}
        <label>Объяснение верного ответа <span class="req">*</span></label><textarea name="explanation" required minlength="10"></textarea>
        <button class="btn block mt">Отправить на проверку</button></form></details>
    ${mine.length + myQ.length ? html`<h3 class="mt2">Ждут проверки</h3><div class="list">${mine.map((c) => html`<div class="item small"><b>${c.term}</b> — ${c.translation} <span class="badge grey">карточка</span></div>`)}${myQ.map((x) => html`<div class="item small">${x.question} <span class="badge grey">вопрос</span></div>`)}</div>` : ""}
  </div>`;
}
FORM.suggestCard = async (f, fd) => {
  const row = { lesson_id: fd.get("lesson_id"), term: fd.get("term").trim(), translation: fd.get("translation").trim(), explanation: fd.get("explanation").trim(),
    example: fd.get("example").trim() || null, source_ref: fd.get("source_ref").trim() || null, kind: "word", status: "pending", author: S.me.uid };
  const saved = await q(S.sb.from("cards").insert(row).select().single());
  S.cards.push(saved || { ...row, id: uuid() }); toast("Отправлено на проверку учителю", "ok"); render();
};
FORM.suggestQ = async (f, fd) => {
  const row = { lesson_id: fd.get("lesson_id"), question: fd.get("question").trim(), options: [0, 1, 2, 3].map((i) => fd.get("opt" + i).trim()),
    correct: Number(fd.get("correct")), explanation: fd.get("explanation").trim(), status: "pending", author: S.me.uid };
  const saved = await q(S.sb.from("questions").insert(row).select().single());
  S.questions.push(saved || { ...row, id: uuid() }); toast("Вопрос отправлен на проверку", "ok"); render();
};

// ---------- ДЗ ----------
function lessonHw(l) {
  if (!l.homework) return html`<div class="card muted">К этому уроку домашнего задания нет.</div>`;
  const mine = S.hw.find((h) => h.lesson_id === l.id && h.user_id === S.me.uid);
  const late = l.homework_due && todayKZ() > l.homework_due;
  return html`<div class="card">
    <div class="row wrap"><span class="badge ${late && !mine ? "bad" : "gold"}">${l.homework_due ? "Срок: " + fmtDate(l.homework_due) : "Без срока"}</span>${mine ? html`<span class="badge ok">сдано</span>` : ""}</div>
    <p class="mt" style="white-space:pre-wrap"><b>${l.homework}</b></p>
    <form data-form="hw" class="mt"><input type="hidden" name="lesson_id" value="${l.id}">
      <label>Ваш ответ <span class="req">*</span></label>
      <textarea name="answer" required minlength="15" style="min-height:140px" placeholder="Напишите своими словами…">${mine?.answer || ""}</textarea>
      <p class="hint">${late && !mine ? "Срок прошёл — ответ примется, но баллы за ДЗ не начисляются." : "За сданное вовремя ДЗ — +10 баллов."} Ответ можно исправить до проверки.</p>
      <button class="btn block mt">${mine ? "Сохранить изменения" : "Сдать ДЗ"}</button></form></div>`;
}
FORM.hw = async (f, fd) => {
  const l = lessonById(fd.get("lesson_id")), answer = fd.get("answer").trim();
  if (answer.length < 15) throw new Error("Ответ слишком короткий — напишите хотя бы пару предложений");
  const first = !S.hw.find((h) => h.lesson_id === l.id && h.user_id === S.me.uid);
  const row = { lesson_id: l.id, user_id: S.me.uid, answer };
  await q(S.sb.from("homework_answers").upsert(row));
  const i = S.hw.findIndex((h) => h.lesson_id === l.id && h.user_id === S.me.uid);
  if (i >= 0) S.hw[i] = row; else S.hw.push(row);
  let gained = 0;
  if (first && !(l.homework_due && todayKZ() > l.homework_due)) gained = await award("homework", l.id, 10);
  toast(gained ? `ДЗ сдано · +${gained} баллов` : "Сохранено", "ok"); render();
};

// ---------- ОБСУЖДЕНИЕ ----------
let replyTo = null;
function lessonTalk(l) {
  const posts = S.posts.filter((p) => p.lesson_id === l.id);
  const top = posts.filter((p) => !p.parent_id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const open = l.discussion_open || isTeacher();
  const postHtml = (p, isReply) => { const a = person(p.user_id); return html`
    <div class="post ${isReply ? "reply" : ""}">
      <div class="row"><span class="avatar">${initials(a)}</span><div class="grow"><b>${fullName(a)}</b>${a?.role === "teacher" ? html` <span class="badge gold">учитель</span>` : ""}
        <div class="meta">${fmtDateTime(p.created_at)}</div></div></div>
      <p style="white-space:pre-wrap;margin:6px 0">${p.body}</p>
      <div class="row small">${!isReply && open ? html`<a href="#" data-act="reply" data-id="${p.id}">Ответить</a>` : ""}
        ${p.user_id === S.me.uid || isTeacher() ? html`<a href="#" data-act="delpost" data-id="${p.id}" class="muted">Удалить</a>` : ""}</div>
      ${replyTo === p.id ? html`<form data-form="post" class="mt"><input type="hidden" name="lesson_id" value="${l.id}"><input type="hidden" name="parent_id" value="${p.id}">
        <textarea name="body" required style="min-height:70px" placeholder="Ваш ответ…"></textarea><button class="btn sm mt">Отправить</button></form>` : ""}
    </div>`; };
  return html`<div class="card gold"><b>Тема обсуждения</b>
    <p style="white-space:pre-wrap;margin:6px 0 0">${l.discussion_topic || "Тема пока не задана."}</p>
    ${l.discussion_topic && !l.discussion_open ? html`<p class="small muted">Обсуждение откроется после урока.</p>` : ""}</div>
  ${open && l.discussion_topic ? html`<div class="card"><form data-form="post"><input type="hidden" name="lesson_id" value="${l.id}">
    <label>Ваш вклад</label><textarea name="body" required placeholder="Поделитесь мыслью или вопросом…"></textarea>
    <button class="btn block mt">Опубликовать</button></form></div>` : ""}
  <div class="card list">${top.length ? top.map((p) => html`<div class="item" style="padding:0">${postHtml(p, false)}${posts.filter((r) => r.parent_id === p.id).map((r) => postHtml(r, true))}</div>`) : html`<div class="muted">Пока никто не написал.</div>`}</div>`;
}
ACT.reply = (el) => { replyTo = replyTo === el.dataset.id ? null : el.dataset.id; render(); };
ACT.delpost = async (el) => {
  if (!confirm("Удалить сообщение?")) return;
  await q(S.sb.from("posts").delete().eq("id", el.dataset.id));
  const gone = new Set([el.dataset.id]); S.posts.forEach((p) => p.parent_id === el.dataset.id && gone.add(p.id));
  S.posts = S.posts.filter((p) => !gone.has(p.id)); render();
};
FORM.post = async (f, fd) => {
  const row = { lesson_id: fd.get("lesson_id"), parent_id: fd.get("parent_id") || null, user_id: S.me.uid, body: fd.get("body").trim() };
  const saved = await q(S.sb.from("posts").insert(row).select().single());
  S.posts.push(saved || { ...row, id: uuid(), created_at: new Date().toISOString() }); replyTo = null; toast("Опубликовано", "ok"); render();
};

// ============================================================
//  ТРЕНИРОВКА
// ============================================================
let sess = null;
function makeOptions(c) {
  const same = S.cards.filter((x) => x.id !== c.id && x.status === "approved" && x.translation !== c.translation);
  let d = shuffle(same.filter((x) => x.kind === c.kind)).map((x) => x.translation);
  d = [...new Set(d)].slice(0, 3);
  if (d.length < 3) d = [...new Set(d.concat(shuffle(same).map((x) => x.translation)))].slice(0, 3);
  return shuffle([{ t: c.translation, ok: true }, ...d.map((t) => ({ t, ok: false }))]);
}
function startSession(target, mode) {
  const today = todayKZ();
  let cards;
  if (target === "daily") {
    const { due, fresh } = dueCards();
    cards = shuffle(due).slice(0, 20).concat(shuffle(fresh).slice(0, NEW_PER_DAY));
  } else {
    const all = lessonCards(target);
    const need = all.filter((c) => !S.progress[c.id] || S.progress[c.id].due <= today);
    cards = shuffle(need.length ? need : all).slice(0, 20);
  }
  let queue = [];
  if (mode === "mix") {
    const intros = [], rest = [];
    for (const c of cards) {
      const p = S.progress[c.id];
      if (!p) { intros.push({ c, type: "intro" }); rest.push({ c, type: "choice" }); }
      else rest.push({ c, type: p.box >= 2 && c.kind !== "idea" ? "write" : "choice" });
    }
    queue = intros.concat(shuffle(rest));
  } else if (mode === "match") {
    for (let i = 0; i < cards.length; i += 5) queue.push({ type: "match", group: cards.slice(i, i + 5) });
    if (queue.length > 1 && queue[queue.length - 1].group.length < 3) { const last = queue.pop(); queue[queue.length - 1].group.push(...last.group); }
    if (queue.length === 1 && queue[0].group.length < 3) queue = [];
  } else queue = cards.map((c) => ({ c, type: mode === "write" && c.kind === "idea" ? "choice" : mode }));
  sess = { key: target + "/" + mode, target, mode, queue, i: 0, correct: 0, wrong: 0, unflushed: 0, learned: [], gained: 0, missed: {}, total: cards.length };
}
async function flushSession(s = sess) {
  if (!s || !s.unflushed) return;
  const n = s.unflushed; s.unflushed = 0;
  try { const g = await award("practice", todayKZ(), n); s.gained += g; } catch (e) { console.warn(e); }
}
async function gradeInSession(c, ok, opts) {
  try {
    const r = await grade(c, ok, opts);
    if (r.becameLearned) { sess.learned.push(c); sess.gained += r.gained; if (r.gained) toast(`«${c.term}» выучено! +${r.gained}`, "ok"); }
  } catch (e) { toast(errMsg(e), "err"); }
}
function learnView(target, mode) {
  const key = target + "/" + mode;
  if (!sess || sess.key !== key) startSession(target, mode);
  const back = target === "daily" ? "#/home" : `#/lesson/${target}`;
  if (!sess.queue.length) return html`<div class="card center"><h2>Пока нечего учить</h2><p class="muted">${mode === "match" ? "Для режима «Пары» нужно минимум 3 карточки." : "Карточки появятся после урока."}</p><a class="btn" href="${back}">Назад</a></div>`;
  if (sess.i >= sess.queue.length) return sessionSummary(back);
  const e = sess.queue[sess.i]; e.st ||= {};
  const pct = Math.round((sess.i / sess.queue.length) * 100);
  const head = html`<div class="progress-top"><a href="${back}" data-act="exitSession" class="small">✕</a><div class="bar grow"><i style="width:${pct}%"></i></div><span class="small muted">${sess.i + 1}/${sess.queue.length}</span></div>`;
  if (e.type === "intro" || e.type === "flash") {
    const c = e.c, fl = e.st.flipped;
    return html`${head}<div class="card flash" data-act="flip">
      ${fl ? html`<div class="small muted" dir="auto">${c.term}</div><div class="tr">${c.translation}</div>${cardDetail(c)}`
           : html`<div class="term" dir="auto">${c.term}</div><div class="tap">нажмите, чтобы увидеть перевод и объяснение</div>`}</div>
      ${fl ? (e.type === "intro"
        ? html`<button class="btn block" data-act="introNext">Понятно, дальше →</button><p class="hint center">Это слово вы увидите ещё раз в виде вопроса.</p>`
        : html`<div class="row"><button class="btn bad grow" data-act="self" data-v="0">Не знаю</button><button class="btn ok grow" data-act="self" data-v="1">Знаю</button></div>`)
        : html`<button class="btn soft block" data-act="flip">Показать ответ</button>`}`;
  }
  if (e.type === "choice") {
    const c = e.c; e.st.opts ||= makeOptions(c);
    const ans = e.st.chosen != null;
    return html`${head}<div class="card"><div class="small muted">${c.kind === "idea" ? "Понятие / вопрос" : "Что означает слово?"}</div>
      <div class="term" dir="auto">${c.term}</div>
      ${e.st.opts.map((o, i) => html`<button class="opt ${ans ? (o.ok ? "right" : e.st.chosen === i ? "wrong" : "") : ""}" data-act="pick" data-i="${i}" ${ans ? "disabled" : ""}>${o.t}</button>`)}
      ${ans ? feedback(e, c) : ""}</div>`;
  }
  if (e.type === "write") {
    const c = e.c, ans = e.st.checked;
    return html`${head}<div class="card"><div class="small muted">Напишите перевод</div><div class="term" dir="auto">${c.term}</div>
      <form data-form="writeAns" class="mt"><input type="text" name="a" autocomplete="off" autocapitalize="off" ${ans ? "disabled" : "autofocus"} value="${e.st.text || ""}" placeholder="Ваш ответ">
      ${ans ? "" : html`<button class="btn block mt">Проверить</button><button type="button" class="btn ghost block mt" data-act="idk">Не знаю</button>`}</form>
      ${ans ? feedback(e, c) : ""}</div>`;
  }
  if (e.type === "match") return matchView(e, head);
  return "";
}
function feedback(e, c) {
  const ok = e.st.ok;
  return html`<div class="feedback ${ok ? "ok" : "bad"}"><b>${ok ? "Верно! " : "Правильный ответ: " + c.translation}</b></div>
    ${cardDetail(c)}<div class="sticky-actions"><button class="btn block" data-act="next">Дальше →</button></div>`;
}
async function advance() { sess.i++; render(); if (sess.i >= sess.queue.length) { await flushSession(); render(); } }
async function answered(e, ok) {
  e.st.ok = ok;
  if (ok) { if (!e.retry) { sess.correct++; sess.unflushed++; } }
  else { sess.wrong++; sess.missed[e.c.id] = e.c; if (!e.retry) sess.queue.push({ c: e.c, type: e.type, retry: true }); }
  render();
  await gradeInSession(e.c, ok);
}
ACT.flip = () => { const e = sess.queue[sess.i]; e.st.flipped = true; render(); };
ACT.introNext = () => advance();
ACT.self = async (el) => {
  const e = sess.queue[sess.i], ok = el.dataset.v === "1";
  if (!ok) { sess.wrong++; sess.missed[e.c.id] = e.c; sess.queue.push({ c: e.c, type: e.type, retry: true }); }
  else sess.correct++;
  gradeInSession(e.c, ok, { self: true }); advance();
};
ACT.pick = (el) => { const e = sess.queue[sess.i]; if (e.st.chosen != null) return; e.st.chosen = Number(el.dataset.i); return answered(e, e.st.opts[e.st.chosen].ok); };
ACT.next = () => advance();
ACT.idk = () => { const e = sess.queue[sess.i]; e.st.checked = true; e.st.text = ""; return answered(e, false); };
FORM.writeAns = (f, fd) => { const e = sess.queue[sess.i]; if (e.st.checked) return; e.st.checked = true; e.st.text = fd.get("a"); return answered(e, isCorrectAnswer(e.st.text, e.c.translation)); };
ACT.exitSession = async (el, ev) => { await flushSession(); sess = null; };

// ----- режим «пары» -----
function matchView(e, head) {
  const st = e.st; st.right ||= shuffle(e.group); st.done ||= {}; st.bad ||= new Set(); st.sel ||= null;
  const all = Object.keys(st.done).length === e.group.length;
  return html`${head}<div class="card"><div class="small muted">Соедините слово с переводом: нажмите слово, затем перевод</div>
    <div class="mt">${e.group.map((c) => html`<button class="pill ${st.done[c.id] ? "done" : ""} ${st.sel === c.id ? "sel" : ""}" data-act="mterm" data-id="${c.id}" dir="auto">${c.term}</button>`)}</div>
    <hr style="border:0;border-top:1px dashed var(--line);margin:10px 0">
    <div>${st.right.map((c) => html`<button class="pill ${st.done[c.id] ? "done" : ""} ${st.err === c.id ? "err" : ""}" data-act="mtr" data-id="${c.id}">${c.translation}</button>`)}</div>
    ${all ? html`<div class="mt">${e.group.map((c) => html`<details open class="item"><summary><b dir="auto">${c.term}</b> — ${c.translation}</summary>${cardDetail(c)}</details>`)}
      <button class="btn block mt" data-act="next">Дальше →</button></div>` : ""}</div>`;
}
ACT.mterm = (el) => { const e = sess.queue[sess.i]; e.st.sel = el.dataset.id; e.st.err = null; render(); };
ACT.mtr = async (el) => {
  const e = sess.queue[sess.i], st = e.st, id = el.dataset.id;
  if (!st.sel) { toast("Сначала выберите слово слева"); return; }
  const c = cardById(st.sel);
  if (id === st.sel) {
    st.done[id] = true; st.sel = null; st.err = null;
    if (!st.bad.has(c.id)) { sess.correct++; sess.unflushed++; }
    render(); await gradeInSession(c, !st.bad.has(c.id));
  } else {
    st.err = id; const first = !st.bad.has(c.id); st.bad.add(c.id); sess.wrong++; sess.missed[c.id] = c; render();
    if (first) await gradeInSession(c, false);
    setTimeout(() => { st.err = null; if (sess && sess.queue[sess.i] === e) render(); }, 700);
  }
};

function sessionSummary(back) {
  const missed = Object.values(sess.missed);
  const total = sess.correct + sess.wrong, pct = total ? Math.round((sess.correct / total) * 100) : 0;
  return html`<div class="card center"><div style="font-size:3rem">${pct >= 80 ? "🌟" : pct >= 50 ? "👍" : "💪"}</div>
    <h2>Сессия завершена</h2>
    <p>Верных ответов с первого раза: <b>${sess.correct}</b> из ${total} (${pct}%)</p>
    ${sess.learned.length ? html`<p class="ok-t">Выучено новых слов: <b>${sess.learned.length}</b> — ${sess.learned.map((c) => c.term).join(", ")}</p>` : ""}
    <p><span class="chip" id="sess-pts">+${sess.gained} баллов</span></p>
    <div class="row wrap" style="justify-content:center"><a class="btn" href="${back}" data-act="exitSession">Готово</a><button class="btn soft" data-act="again">Ещё раз</button></div></div>
  ${missed.length ? html`<div class="card"><h3>Стоит повторить</h3><div class="list">${missed.map((c) => html`<details class="item"><summary><b dir="auto">${c.term}</b> — ${c.translation}</summary><div class="mt">${cardDetail(c)}</div></details>`)}</div></div>` : ""}`;
}
ACT.again = async () => { await flushSession(); const [t, m] = sess.key.split("/"); sess = null; startSession(t, m); render(); };

// ============================================================
//  ТЕСТ
// ============================================================
let tst = null, tstTimer = null;
function stopTimer() { clearInterval(tstTimer); tstTimer = null; }
function testView(lid) {
  const l = lessonById(lid);
  if (!l) return html`<div class="card">Урок не найден.</div>`;
  if (!tst || tst.lid !== lid) tst = { lid, started: false, preview: false };
  const used = myAttempts(lid).length, left = l.test_attempts - used;
  const back = `#/lesson/${lid}/test`;
  if (!tst.started) {
    const n = lessonCards(lid).length + lessonQuestions(lid).length;
    return html`<a href="${back}" class="small">← Назад</a><div class="card mt center"><h2>Итоговый тест</h2><p>Урок ${l.num}: ${l.title}</p>
      <p class="small muted">Вопросов: ${Math.min(n, 30)} · время: ${l.test_minutes} мин. · попыток осталось: ${Math.max(left, 0)} из ${l.test_attempts}<br>Засчитывается лучшая попытка. После завершения вы увидите объяснение к каждому вопросу.</p>
      ${!l.test_open && !isTeacher() ? html`<p class="badge bad">Тест сейчас закрыт</p>` : n < 1 ? html`<p class="muted">В уроке нет карточек для теста.</p>`
        : (left <= 0 && !isTeacher()) ? html`<p class="badge bad">Попытки закончились</p>`
        : html`<button class="btn block" data-act="testStart">${isTeacher() && (!l.test_open || left <= 0) ? "Пробный запуск (не сохраняется)" : "Начать тест"}</button>`}</div>`;
  }
  if (tst.done) return testResult(l);
  const it = tst.items[tst.i], last = tst.i === tst.items.length - 1;
  const answeredN = tst.answers.filter((a) => a != null).length;
  return html`<div class="progress-top"><span class="small muted">Вопрос ${tst.i + 1}/${tst.items.length}</span><div class="bar grow"><i style="width:${(answeredN / tst.items.length) * 100}%"></i></div><span class="timer" id="timer">--:--</span></div>
    <div class="card"><div class="small muted">${it.label}</div><div class="${it.kind === "card" ? "term" : ""}" style="${it.kind === "card" ? "" : "font-size:1.15rem;font-weight:600"}" dir="auto">${it.text}</div>
      ${it.opts.map((o, i) => html`<button class="opt ${tst.answers[tst.i] === i ? "sel" : ""}" data-act="tpick" data-i="${i}">${o.t}</button>`)}</div>
    <div class="row"><button class="btn ghost grow" data-act="tprev" ${tst.i === 0 ? "disabled" : ""}>←</button>
      ${last ? html`<button class="btn gold grow" data-act="tfinish">Завершить</button>` : html`<button class="btn grow" data-act="tnext">Далее →</button>`}</div>
    <div class="center mt">${tst.items.map((_, i) => html`<a href="#" data-act="tgo" data-i="${i}" class="badge ${tst.answers[i] != null ? "ok" : "grey"}" style="margin:2px;${i === tst.i ? "outline:2px solid var(--green)" : ""}">${i + 1}</a>`)}</div>`;
}
ACT.testStart = () => {
  const l = lessonById(tst.lid);
  const cards = shuffle(lessonCards(tst.lid)).map((c) => ({ kind: "card", c, label: c.kind === "idea" ? "Выберите верное пояснение" : "Что означает слово?", text: c.term, opts: makeOptions(c), explanation: c.explanation, correctText: c.translation }));
  const qs = shuffle(lessonQuestions(tst.lid)).map((x) => ({ kind: "q", x, label: "Вопрос", text: x.question, opts: shuffle(x.options.map((t, i) => ({ t, ok: i === x.correct }))), explanation: x.explanation, correctText: x.options[x.correct] }));
  const items = shuffle(cards.concat(qs)).slice(0, 30);
  tst = { ...tst, started: true, done: false, items, answers: items.map(() => null), i: 0, endsAt: Date.now() + l.test_minutes * 60000, t0: Date.now(), preview: isTeacher() && (!l.test_open || l.test_attempts - myAttempts(tst.lid).length <= 0) };
  render();
};
ACT.tpick = (el) => { tst.answers[tst.i] = Number(el.dataset.i); render(); };
ACT.tnext = () => { tst.i++; render(); };
ACT.tprev = () => { tst.i--; render(); };
ACT.tgo = (el) => { tst.i = Number(el.dataset.i); render(); };
ACT.tfinish = async () => {
  const un = tst.answers.filter((a) => a == null).length;
  if (un && !confirm(`Без ответа осталось: ${un}. Завершить тест?`)) return;
  await finishTest();
};
async function finishTest() {
  if (tst.done) return; stopTimer();
  tst.done = true;
  tst.score = tst.items.reduce((s, it, i) => s + (tst.answers[i] != null && it.opts[tst.answers[i]].ok ? 1 : 0), 0);
  tst.pts = Math.min(150, tst.score * 2);
  render();
  if (tst.preview) return;
  try {
    const row = { user_id: S.me.uid, lesson_id: tst.lid, score: tst.score, total: tst.items.length, duration_s: Math.round((Date.now() - tst.t0) / 1000) };
    const saved = await q(S.sb.from("attempts").insert(row).select().single());
    S.attempts.push(saved || { ...row, id: uuid(), created_at: new Date().toISOString() });
    tst.gained = await award("test", tst.lid, tst.pts); render();
  } catch (e) { toast(errMsg(e), "err"); }
}
function testResult(l) {
  const pct = Math.round((tst.score / tst.items.length) * 100);
  return html`<div class="card center"><div style="font-size:3rem">${pct >= 80 ? "🌟" : pct >= 50 ? "👍" : "💪"}</div><h2>Результат: ${tst.score} из ${tst.items.length} (${pct}%)</h2>
    ${tst.preview ? html`<p class="badge grey">Пробный запуск — не сохранён</p>` : html`<p><span class="chip">${tst.gained != null ? "+" + tst.gained : "…"} баллов</span></p><p class="small muted">Засчитывается лучшая попытка.</p>`}
    <a class="btn" href="#/lesson/${l.id}/test" data-act="testReset">Готово</a></div>
    <div class="card"><h3>Разбор ответов</h3><div class="list">${tst.items.map((it, i) => { const a = tst.answers[i], ok = a != null && it.opts[a].ok; return html`
      <div class="item"><div class="row"><span class="badge ${ok ? "ok" : "bad"}">${ok ? "верно" : a == null ? "нет ответа" : "ошибка"}</span><b dir="auto">${it.text}</b></div>
      ${ok ? "" : html`<p class="small">Ваш ответ: ${a != null ? it.opts[a].t : "—"}<br>Правильно: <b>${it.correctText}</b></p>`}
      <div class="expl"><b class="lbl">Объяснение</b>${it.explanation}</div></div>`; })}</div></div>`;
}
ACT.testReset = () => { tst = null; };
function lessonTest(l) {
  const at = myAttempts(l.id), best = bestAttempt(l.id), left = l.test_attempts - at.length;
  return html`<div class="card"><h3>Итоговый тест</h3>
    ${l.test_open ? html`<span class="badge gold">открыт</span>` : html`<span class="badge grey">закрыт — откроет учитель в конце урока</span>`}
    <p class="small muted mt">Время: ${l.test_minutes} мин. · попыток: ${at.length} из ${l.test_attempts}</p>
    ${best ? html`<p>Лучший результат: <b>${best.score} из ${best.total}</b></p>` : ""}
    ${at.length ? html`<div class="list">${at.map((a, i) => html`<div class="item small row between"><span>Попытка ${i + 1} · ${fmtDateTime(a.created_at)}</span><b>${a.score}/${a.total}</b></div>`)}</div>` : ""}
    <a class="btn block mt ${(!l.test_open || left <= 0) && !isTeacher() ? "ghost" : ""}" href="#/test/${l.id}">${isTeacher() ? "Открыть (учитель)" : left > 0 ? "К тесту" : "Подробнее"}</a></div>`;
}

// ============================================================
//  РЕЙТИНГ
// ============================================================
function rankRows(kind) {
  const rows = students().map((p) => ({ p, pts: (S.board[p.uid] || { total: 0, week: 0 })[kind === "week" ? "week" : "total"] || 0 }))
    .filter((r) => r.p.registered || r.pts > 0).sort((a, b) => b.pts - a.pts || a.p.last_name.localeCompare(b.p.last_name));
  let rank = 0, prev = null, i = 0;
  for (const r of rows) { i++; if (r.pts !== prev) { rank = i; prev = r.pts; } r.rank = rank; }
  return rows.filter((r) => r.pts > 0 || kind !== "week").map((r) => r);
}
function boardView(tab = "week") {
  const tabs = [["week", "Неделя"], ["all", "Всё время"], ["teams", "Команды"]];
  let body;
  if (tab === "teams") {
    const teams = {};
    for (const p of students()) { if (!p.team) continue; const t = (teams[p.team] ||= { name: p.team, n: 0, week: 0, total: 0 }); t.n++; t.week += S.board[p.uid]?.week || 0; t.total += S.board[p.uid]?.total || 0; }
    const arr = Object.values(teams).sort((a, b) => b.week / b.n - a.week / a.n);
    body = arr.length ? html`<div class="card"><p class="small muted">Считается среднее на участника — чтобы размер команды не влиял на результат.</p><div class="list">${arr.map((t, i) => html`
      <div class="item row"><span class="rank r${i + 1}">${i + 1}</span><div class="grow"><b>${t.name}</b><div class="small muted">${t.n} уч. · всего ${t.total}</div></div><div class="center"><b>${(t.week / t.n).toFixed(1)}</b><div class="tiny muted">за неделю</div></div></div>`)}</div></div>`
      : html`<div class="card muted">Команды ещё не созданы. Учитель распределит участников.</div>`;
  } else {
    const rows = rankRows(tab);
    body = html`<div class="card">${tab === "week" ? html`<p class="small muted">Неделя: пн–вс. В воскресенье учитель закрывает неделю — топ-3 получают бонус (15 / 10 / 5).</p>` : ""}
      <div class="list">${rows.length ? rows.map((r) => html`<div class="item row ${r.p.uid === S.me.uid ? "me" : ""}" style="${r.p.uid === S.me.uid ? "background:var(--gold-2);margin:0 -16px;padding:12px 16px" : ""}">
        <span class="rank r${r.rank}">${r.rank}</span><div class="grow">${fullName(r.p)}${r.p.team ? html` <span class="badge">${r.p.team}</span>` : ""} <span class="badge grey">${levelOf(r.p).ru}</span><div class="tiny muted"><span class="flame">🔥${streakOf(r.p.uid)}</span></div></div><b>${r.pts}</b></div>`) : html`<div class="muted item">Пока никого.</div>`}</div></div>`;
  }
  return html`<h1>Рейтинг</h1><div class="tabs">${tabs.map(([k, n]) => html`<a href="#/board/${k}" class="${k === tab ? "on" : ""}">${n}</a>`)}</div>${body}
    <div class="card flat small muted">Баллы — это помощь в регулярности, а не соревнование за славу. Главное — понять и применить прочитанное.</div>`;
}

// ============================================================
//  Я: дневник, профиль
// ============================================================
function meView() {
  const me = S.me, today = todayKZ(), todays = S.diary.find((d) => d.day === today);
  const mentor = person(me.mentor), mentees = S.people.filter((p) => p.mentor === me.uid);
  return html`<h1>Мой профиль</h1>
  <div class="card"><div class="row"><span class="avatar" style="width:52px;height:52px;font-size:1.2rem">${initials(me)}</span>
    <div class="grow"><b style="font-size:1.1rem">${me.first_name} ${me.last_name}</b><div class="small muted">${me.role === "teacher" ? "Учитель" : "Тьютор"}${me.team ? " · команда «" + me.team + "»" : ""}</div></div></div>
    ${me.role === "student" ? html`<p class="small mt">Уровень турецкого: <b>${levelOf(me).ru}</b> — баллы за выученные слова, тренировку и тесты ×${String(levelOf(me).mult).replace(".", ",")}. Уровень задаёт учитель.</p>` : ""}
    ${mentor ? html`<p class="small mt">Наставник: <b>${fullName(mentor)}</b></p>` : ""}
    ${mentees.length ? html`<p class="small">Вы наставник для: ${mentees.map((m) => fullName(m)).join(", ")}</p>` : ""}
    <p class="hint">Имя и фамилия заданы учителем и не меняются.</p></div>

  <div class="card"><h3>Дневник размышлений</h3>
    <p class="small muted">Одна мысль в день: «что я понял из сегодняшнего чтения». +2 балла. Записи видны вам и учителю.</p>
    <form data-form="diary"><textarea name="body" required minlength="10" placeholder="Сегодня я понял(а), что…">${todays?.body || ""}</textarea>
      <button class="btn block mt">${todays ? "Обновить запись" : "Сохранить"}</button></form>
    ${S.diary.filter((d) => d.day !== today).length ? html`<h3 class="mt2">Прошлые записи</h3><div class="list">${S.diary.filter((d) => d.day !== today).slice(0, 30).map((d) => html`<div class="item"><div class="tiny muted">${fmtDate(d.day)}</div><div style="white-space:pre-wrap">${d.body}</div></div>`)}</div>` : ""}
  </div>

  <div class="card"><h3>Приложение на главный экран</h3>
    <p class="small"><b>iPhone (Safari):</b> кнопка «Поделиться» → «На экран “Домой”».<br><b>Android (Chrome):</b> меню ⋮ → «Установить приложение» / «Добавить на главный экран».</p></div>
  <button class="btn ghost block" data-act="logout">Выйти</button>`;
}
FORM.diary = async (f, fd) => {
  const day = todayKZ(), body = fd.get("body").trim();
  await q(S.sb.from("diary").upsert({ user_id: S.me.uid, day, body }));
  const i = S.diary.findIndex((d) => d.day === day); const row = { user_id: S.me.uid, day, body };
  if (i >= 0) S.diary[i] = row; else S.diary.unshift(row);
  const g = await award("diary", day, 2);
  toast(g ? `Сохранено · +${g}` : "Сохранено", "ok"); render();
};
ACT.logout = () => doLogout();
