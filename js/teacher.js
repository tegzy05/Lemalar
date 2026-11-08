// ============================================================
//  Панель учителя
// ============================================================
const TTABS = [["overview", "Обзор"], ["lessons", "Уроки"], ["cards", "Карточки"], ["mod", "Проверка"], ["people", "Группа"], ["att", "Посещаемость"], ["points", "Баллы"]];
let tLesson = null;           // выбранный урок во вкладках «Карточки» / «Посещаемость»
let editLessonId = null, editCardId = null;

function teacherView(tab = "overview", arg) {
  const pend = S.cards.filter((c) => c.status === "pending").length + S.questions.filter((x) => x.status === "pending").length;
  const fn = { overview: tOverview, lessons: tLessons, cards: tCards, mod: tMod, people: tPeople, att: tAtt, points: tPoints, student: tStudent }[tab] || tOverview;
  return html`<h1>Панель учителя</h1>
  <div class="tabs">${TTABS.map(([k, n]) => html`<a href="#/t/${k}" class="${k === tab ? "on" : ""}">${n}${k === "mod" && pend ? html` <span class="badge bad">${pend}</span>` : ""}</a>`)}</div>
  ${fn(arg)}`;
}
const pubLessons = () => S.lessons.filter((l) => l.published);
function pickLesson() {
  if (!S.lessons.find((l) => l.id === tLesson)) tLesson = (S.lessons[S.lessons.length - 1] || {}).id || null;
  return tLesson;
}
const lessonSelect = (name = "lesson") => html`<select data-change="pickLesson" name="${name}">${S.lessons.map((l) => html`<option value="${l.id}" ${l.id === tLesson ? "selected" : ""}>Урок ${l.num}: ${l.title}${l.published ? "" : " (черновик)"}</option>`)}</select>`;
CHG.pickLesson = (el) => { tLesson = el.value; render(); };

// ---------- ОБЗОР ----------
function studentRows() {
  const totalCards = S.cards.filter((c) => c.status === "approved" && lessonById(c.lesson_id)?.published).length;
  const pubIds = new Set(pubLessons().map((l) => l.id));
  return students().map((p) => {
    const b = S.board[p.uid] || { total: 0, week: 0 }, pr = S.tProg[p.uid] || { learned: 0, seen: 0, right_total: 0, wrong_total: 0 };
    const tests = S.tTests.filter((t) => t.user_id === p.uid && pubIds.has(t.lesson_id));
    const avg = tests.length ? Math.round(sum(tests, (t) => (t.total ? t.best / t.total : 0)) / tests.length * 100) : null;
    const hwDone = S.hw.filter((h) => h.user_id === p.uid && pubIds.has(h.lesson_id)).length;
    const hwTotal = pubLessons().filter((l) => l.homework).length;
    const att = S.att.filter((a) => a.user_id === p.uid && a.present).length;
    const acc = pr.right_total + pr.wrong_total ? Math.round(pr.right_total / (pr.right_total + pr.wrong_total) * 100) : null;
    return { p, b, pr, avg, hwDone, hwTotal, att, acc, streak: streakOf(p.uid), totalCards, idle: daysSince(p.last_seen) };
  });
}
function tOverview() {
  const rows = studentRows().sort((a, b) => a.p.last_name.localeCompare(b.p.last_name));
  const reg = rows.filter((r) => r.p.registered).length;
  const risk = rows.filter((r) => r.p.registered && (r.idle >= 5 || (r.streak === 0 && !checkedToday(r.p.uid) && r.idle >= 3)));
  const waiting = rows.filter((r) => !r.p.registered);
  // трудные слова
  const hard = S.cards.map((c) => ({ c, s: S.tCards[c.id] })).filter((x) => x.s && x.s.right_total + x.s.wrong_total >= 3)
    .map((x) => ({ ...x, err: x.s.wrong_total / (x.s.right_total + x.s.wrong_total) })).sort((a, b) => b.err - a.err).slice(0, 8).filter((x) => x.err > 0);
  return html`
  <div class="card"><div class="row between"><h3 style="margin:0">Группа: ${reg} из ${rows.length} в системе</h3><button class="btn sm soft" data-act="csv">⬇ CSV</button></div>
    <div class="tbl-wrap mt"><table><thead><tr><th>Ученик</th><th class="num">Баллы</th><th class="num">Нед.</th><th class="num">🔥</th><th class="num">Слова</th><th class="num">Тесты</th><th class="num">ДЗ</th><th class="num">Посещ.</th><th>Был(а)</th></tr></thead>
    <tbody>${rows.map((r) => html`<tr><td><a href="#/t/student/${r.p.uid}">${fullName(r.p)}</a>${r.p.team ? html` <span class="badge">${r.p.team}</span>` : ""} <span class="badge grey">${levelOf(r.p).ru}</span>${r.p.registered ? "" : html` <span class="badge grey">не вошёл</span>`}</td>
      <td class="num"><b>${r.b.total}</b></td><td class="num">${r.b.week}</td><td class="num">${r.streak}</td>
      <td class="num">${r.pr.learned}/${r.totalCards}${r.acc != null ? html` <span class="muted tiny">(${r.acc}%)</span>` : ""}</td>
      <td class="num">${r.avg != null ? r.avg + "%" : "—"}</td><td class="num">${r.hwDone}/${r.hwTotal}</td><td class="num">${r.att}/${S.lessons.filter((l) => l.published).length}</td>
      <td class="${r.idle >= 5 ? "flame" : "muted"}">${r.p.last_seen ? (r.idle === 0 ? "сегодня" : r.idle + " дн. назад") : "—"}</td></tr>`)}</tbody></table></div></div>
  ${risk.length ? html`<div class="card"><h3>Давно не заходили</h3><p class="small muted">Стоит написать лично:</p>${risk.map((r) => html`<span class="badge bad" style="margin:2px">${fullName(r.p)} · ${r.idle === Infinity ? "не заходил" : r.idle + " дн."}</span>`)}</div>` : ""}
  ${waiting.length ? html`<div class="card"><h3>Ещё не зарегистрировались (${waiting.length})</h3><p class="small muted">Код для входа — во вкладке «Группа».</p>${waiting.map((r) => html`<span class="badge grey" style="margin:2px">${fullName(r.p)}</span>`)}</div>` : ""}
  <div class="card"><h3>Трудные слова</h3><p class="small muted">Доля ошибок по всей группе — разберите эти слова на уроке ещё раз.</p>
    ${hard.length ? html`<div class="list">${hard.map((x) => html`<div class="item row between"><div><b dir="auto">${x.c.term}</b> — ${x.c.translation}</div><span class="badge bad">${Math.round(x.err * 100)}% ошибок</span></div>`)}</div>` : html`<p class="muted">Данных пока мало.</p>`}</div>`;
}
ACT.csv = () => {
  const rows = studentRows();
  const head = ["Имя", "Фамилия", "Команда", "Уровень турецкого", "Баллы", "За неделю", "Серия", "Выучено слов", "Средний тест %", "ДЗ сдано", "Посещаемость", "Последний вход"];
  const lines = [head.map(csvCell).join(";")].concat(rows.map((r) => [r.p.first_name, r.p.last_name, r.p.team || "", levelOf(r.p).ru, r.b.total, r.b.week, r.streak, r.pr.learned, r.avg ?? "", r.hwDone, r.att, r.p.last_seen || ""].map(csvCell).join(";")));
  download(`lemalar_${todayKZ()}.csv`, lines.join("\n"));
};

// ---------- ЛИЧНАЯ СТРАНИЦА УЧЕНИКА ----------
function tStudent(uid) {
  const p = person(uid); if (!p) return html`<div class="card">Не найдено</div>`;
  const r = studentRows().find((x) => x.p.uid === uid);
  const tests = S.tTests.filter((t) => t.user_id === uid);
  const sd = window._tDiary?.[uid], sh = window._tHw?.[uid];
  if (!sd) loadStudentDetail(uid);
  return html`<a href="#/t/overview" class="small">← Обзор</a><div class="card mt"><h2>${fullName(p)}</h2>
    <div class="row wrap"><span class="chip">${r.b.total} ★</span><span class="badge">${r.b.week} за неделю</span><span class="badge gold">🔥 ${r.streak}</span>${p.team ? html`<span class="badge">${p.team}</span>` : ""}</div>
    <p class="small muted mt">Выучено слов: ${r.pr.learned} · точность ответов: ${r.acc ?? "—"}% · последний вход: ${p.last_seen ? fmtDateTime(p.last_seen) : "—"}</p></div>
  <div class="card"><h3>Тесты</h3>${tests.length ? html`<div class="list">${tests.map((t) => html`<div class="item row between"><span>${lessonById(t.lesson_id) ? "Урок " + lessonById(t.lesson_id).num : "—"} (попыток: ${t.tries})</span><b>${t.best}/${t.total}</b></div>`)}</div>` : html`<p class="muted">Нет попыток.</p>`}</div>
  <div class="card"><h3>Домашние задания</h3>${sh ? (sh.length ? html`<div class="list">${sh.map((h) => html`<div class="item"><div class="small muted">Урок ${lessonById(h.lesson_id)?.num ?? "?"}: ${lessonById(h.lesson_id)?.homework || ""}</div><div style="white-space:pre-wrap">${h.answer}</div></div>`)}</div>` : html`<p class="muted">Пока не сдавал(а).</p>`) : html`<p class="muted">Загрузка…</p>`}</div>
  <div class="card"><h3>Дневник размышлений</h3>${sd ? (sd.length ? html`<div class="list">${sd.map((d) => html`<div class="item"><div class="tiny muted">${fmtDate(d.day)}</div><div style="white-space:pre-wrap">${d.body}</div></div>`)}</div>` : html`<p class="muted">Записей нет.</p>`) : html`<p class="muted">Загрузка…</p>`}</div>`;
}
async function loadStudentDetail(uid) {
  window._tDiary ||= {}; window._tHw ||= {};
  if (window._tDiary[uid] !== undefined) return;
  window._tDiary[uid] = null;
  try {
    const [d, h] = await Promise.all([q(S.sb.from("diary").select("*").eq("user_id", uid).order("day", { ascending: false }).limit(60)), q(S.sb.from("homework_answers").select("*").eq("user_id", uid))]);
    window._tDiary[uid] = d; window._tHw[uid] = h; render();
  } catch (e) { toast(errMsg(e), "err"); }
}

// ---------- УРОКИ ----------
function lessonForm(l) {
  const n = l || { num: (S.lessons.reduce((m, x) => Math.max(m, x.num), 0) + 1), title: "", test_minutes: 15, test_attempts: 2 };
  return html`<form data-form="lesson"><input type="hidden" name="id" value="${l?.id || ""}">
    <div class="row"><div style="width:90px"><label>№</label><input type="number" name="num" value="${n.num}" min="1" required></div><div class="grow"><label>Название <span class="req">*</span></label><input type="text" name="title" value="${n.title}" required></div></div>
    <label>Дата урока</label><input type="date" name="lesson_date" value="${n.lesson_date || ""}">
    <label>Краткое описание / план</label><textarea name="summary">${n.summary || ""}</textarea>
    <label>Презентация: ссылка (Google Slides / Drive / PDF)</label><input type="url" name="slides_url" value="${n.slides_url || ""}" placeholder="https://…">
    <label>…или загрузить файл (PDF / PPTX, до 10 МБ — сохранится на вашем Google Диске)</label><input type="file" name="slides_file" accept=".pdf,.ppt,.pptx,.key">
    <label>Тема обсуждения</label><textarea name="discussion_topic" style="min-height:70px">${n.discussion_topic || ""}</textarea>
    <label>Домашнее задание</label><textarea name="homework" style="min-height:70px">${n.homework || ""}</textarea>
    <div class="row"><div class="grow"><label>Срок ДЗ</label><input type="date" name="homework_due" value="${n.homework_due || ""}"></div>
      <div class="grow"><label>Тест, мин.</label><input type="number" name="test_minutes" value="${n.test_minutes}" min="1" max="120"></div>
      <div class="grow"><label>Попыток</label><input type="number" name="test_attempts" value="${n.test_attempts}" min="1" max="10"></div></div>
    <div class="row mt"><button class="btn grow">${l ? "Сохранить" : "Создать урок"}</button>${l ? html`<button type="button" class="btn ghost" data-act="cancelEdit">Отмена</button>` : ""}</div></form>`;
}
function tLessons() {
  const ls = S.lessons.slice().sort((a, b) => b.num - a.num);
  return html`<div class="card"><h3>${editLessonId ? "Редактирование урока" : "Новый урок"}</h3>${lessonForm(editLessonId ? lessonById(editLessonId) : null)}</div>
  ${ls.map((l) => html`<div class="card"><div class="row between"><h3 style="margin:0">Урок ${l.num}: ${l.title}</h3><span class="small muted">${fmtDate(l.lesson_date)}</span></div>
    <label class="switch"><input type="checkbox" data-change="toggle" data-id="${l.id}" data-f="published" ${l.published ? "checked" : ""}>Опубликован (виден ученикам)</label>
    <label class="switch"><input type="checkbox" data-change="toggle" data-id="${l.id}" data-f="test_open" ${l.test_open ? "checked" : ""}>Тест открыт</label>
    <label class="switch"><input type="checkbox" data-change="toggle" data-id="${l.id}" data-f="discussion_open" ${l.discussion_open ? "checked" : ""}>Обсуждение открыто</label>
    <div class="row wrap mt"><button class="btn sm soft" data-act="editLesson" data-id="${l.id}">Изменить</button>
      <a class="btn sm soft" href="#/test/${l.id}">Пробный тест</a>
      <button class="btn sm ghost" data-act="delLesson" data-id="${l.id}">Удалить</button></div>
    <p class="small muted mt">${lessonCards(l.id).length} карточек · ${S.hw.filter((h) => h.lesson_id === l.id).length} ДЗ сдано · ${l.slides_url ? "презентация загружена" : "нет презентации"}</p></div>`)}`;
}
CHG.toggle = async (el) => {
  const id = el.dataset.id, f = el.dataset.f, v = el.checked;
  await q(S.sb.from("lessons").update({ [f]: v }).eq("id", id));
  lessonById(id)[f] = v; toast(v ? "Включено" : "Выключено", "ok"); render();
};
ACT.editLesson = (el) => { editLessonId = el.dataset.id; render(); window.scrollTo(0, 0); };
ACT.cancelEdit = () => { editLessonId = null; render(); };
ACT.delLesson = async (el) => {
  const l = lessonById(el.dataset.id);
  if (!confirm(`Удалить урок «${l.title}» вместе с карточками, тестами и обсуждением? Это нельзя отменить.`)) return;
  await q(S.sb.from("lessons").delete().eq("id", l.id)); await loadAll(); render();
};
FORM.lesson = async (f, fd) => {
  const id = fd.get("id");
  const row = { num: Number(fd.get("num")), title: fd.get("title").trim(), lesson_date: fd.get("lesson_date") || null, summary: fd.get("summary").trim() || null,
    slides_url: fd.get("slides_url").trim() || null, discussion_topic: fd.get("discussion_topic").trim() || null, homework: fd.get("homework").trim() || null,
    homework_due: fd.get("homework_due") || null, test_minutes: Number(fd.get("test_minutes")), test_attempts: Number(fd.get("test_attempts")) };
  const file = fd.get("slides_file");
  if (file && file.size) {
    if (file.size > 10 * 1024 * 1024) throw new Error("Файл больше 10 МБ — загрузите его на Google Диск и вставьте ссылку");
    toast("Загружаю презентацию на Google Диск…");
    const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = () => rej(new Error("Не удалось прочитать файл")); r.readAsDataURL(file); });
    row.slides_url = await q(S.sb.rpc("upload_slide", { name: file.name, mime: file.type, b64 }));
  }
  if (id) await q(S.sb.from("lessons").update(row).eq("id", id));
  else { row.published = false; const s = await q(S.sb.from("lessons").insert(row).select().single()); tLesson = s?.id || tLesson; }
  editLessonId = null; await loadAll(); toast("Сохранено", "ok"); render();
};

// ---------- КАРТОЧКИ ----------
function cardForm(c) {
  return html`<form data-form="card"><input type="hidden" name="id" value="${c?.id || ""}"><input type="hidden" name="lesson_id" value="${tLesson}">
    <div class="row"><div class="grow"><label>Слово / понятие <span class="req">*</span></label><input type="text" name="term" value="${c?.term || ""}" required dir="auto"></div>
      <div style="width:120px"><label>Тип</label><select name="kind"><option value="word" ${c?.kind !== "idea" ? "selected" : ""}>Слово</option><option value="idea" ${c?.kind === "idea" ? "selected" : ""}>Идея</option></select></div></div>
    <label>Перевод / краткий ответ <span class="req">*</span></label><input type="text" name="translation" value="${c?.translation || ""}" required>
    <label>Объяснение <span class="req">*</span> <span class="muted" style="font-weight:400">— обязательно</span></label><textarea name="explanation" required minlength="3" placeholder="Смысл в контексте Лемала, как понимать, чем отличается от похожих понятий">${c?.explanation || ""}</textarea>
    <label>Пример</label><input type="text" name="example" value="${c?.example || ""}">
    <label>Источник (Лема, страница)</label><input type="text" name="source_ref" value="${c?.source_ref || ""}">
    <div class="row mt"><button class="btn grow">${c ? "Сохранить" : "Добавить карточку"}</button>${c ? html`<button type="button" class="btn ghost" data-act="cancelCard">Отмена</button>` : ""}</div></form>`;
}
function tCards() {
  const lid = pickLesson();
  if (!lid) return html`<div class="card">Сначала создайте урок во вкладке «Уроки».</div>`;
  const cs = S.cards.filter((c) => c.lesson_id === lid && c.status === "approved");
  return html`<div class="card"><label style="margin-top:0">Урок</label>${lessonSelect()}</div>
  <div class="card"><h3>${editCardId ? "Редактирование карточки" : "Добавить карточку"}</h3>${cardForm(editCardId ? cardById(editCardId) : null)}</div>
  <div class="card"><details><summary>📥 Массовая вставка (из таблицы или текста)</summary>
    <form data-form="bulk" class="mt"><input type="hidden" name="lesson_id" value="${lid}">
    <p class="small muted">Одна карточка — одна строка, поля через « | »:<br><code>слово | перевод | объяснение | пример | источник</code><br>Первые три поля обязательны (объяснение — обязательно!). Для идеи добавьте в начало <code>#</code>.</p>
    <textarea name="text" style="min-height:160px" required placeholder="Ихлас | искренность | Делать дело ради Бога без показности | Помогать, не рассказывая | Лема 1"></textarea>
    <button class="btn block mt">Импортировать</button></form></details></div>
  <div class="card"><h3>Карточки урока (${cs.length})</h3><div class="list">${cs.map((c) => html`<div class="item"><div class="row between"><div class="grow"><b dir="auto">${c.term}</b> — ${c.translation} ${c.kind === "idea" ? html`<span class="badge">идея</span>` : ""}</div>
    <button class="btn sm soft" data-act="editCard" data-id="${c.id}">✎</button><button class="btn sm ghost" data-act="delCard" data-id="${c.id}">✕</button></div>
    <div class="small muted">${c.explanation}</div></div>`)}${cs.length ? "" : html`<div class="muted item">Пока пусто.</div>`}</div></div>`;
}
ACT.editCard = (el) => { editCardId = el.dataset.id; render(); window.scrollTo(0, 0); };
ACT.cancelCard = () => { editCardId = null; render(); };
ACT.delCard = async (el) => {
  if (!confirm("Удалить карточку? Прогресс учеников по ней тоже удалится.")) return;
  await q(S.sb.from("cards").delete().eq("id", el.dataset.id));
  S.cards = S.cards.filter((c) => c.id !== el.dataset.id); render();
};
FORM.card = async (f, fd) => {
  const id = fd.get("id");
  const row = { lesson_id: fd.get("lesson_id"), kind: fd.get("kind"), term: fd.get("term").trim(), translation: fd.get("translation").trim(), explanation: fd.get("explanation").trim(),
    example: fd.get("example").trim() || null, source_ref: fd.get("source_ref").trim() || null };
  if (row.explanation.length < 3) throw new Error("Объяснение обязательно");
  if (id) { await q(S.sb.from("cards").update(row).eq("id", id)); Object.assign(cardById(id), row); }
  else { row.status = "approved"; const s = await q(S.sb.from("cards").insert(row).select().single()); S.cards.push(s || { ...row, id: uuid() }); }
  editCardId = null; toast("Сохранено", "ok"); render();
};
FORM.bulk = async (f, fd) => {
  const lid = fd.get("lesson_id"), rows = [], bad = [];
  fd.get("text").split(/\r?\n/).map((s) => s.trim()).filter(Boolean).forEach((line, i) => {
    let kind = "word"; if (line.startsWith("#")) { kind = "idea"; line = line.slice(1).trim(); }
    const [term, translation, explanation, example, source_ref] = line.split("|").map((s) => s.trim());
    if (!term || !translation || !explanation || explanation.length < 3) bad.push(i + 1);
    else rows.push({ lesson_id: lid, kind, term, translation, explanation, example: example || null, source_ref: source_ref || null, status: "approved" });
  });
  if (bad.length) throw new Error(`Строки без слова, перевода или объяснения: ${bad.join(", ")}. Исправьте и повторите — ничего не добавлено.`);
  if (!rows.length) throw new Error("Нет строк для импорта");
  const saved = await q(S.sb.from("cards").insert(rows).select());
  S.cards.push(...(saved || rows.map((r) => ({ ...r, id: uuid() })))); toast(`Добавлено карточек: ${rows.length}`, "ok"); render();
};

// ---------- ПРОВЕРКА предложений ----------
function tMod() {
  const pc = S.cards.filter((c) => c.status === "pending"), pq = S.questions.filter((x) => x.status === "pending");
  const au = (id) => fullName(person(id));
  return html`<div class="card"><h3>Предложенные карточки (${pc.length})</h3>${pc.length ? html`<div class="list">${pc.map((c) => html`<div class="item"><div class="small muted">${au(c.author)} · урок ${lessonById(c.lesson_id)?.num}</div>
    <b dir="auto">${c.term}</b> — ${c.translation}<div class="small">${c.explanation}</div>
    <div class="row mt"><button class="btn sm ok" data-act="approveCard" data-id="${c.id}">✓ Одобрить (+5)</button><button class="btn sm ghost" data-act="rejectCard" data-id="${c.id}">Отклонить</button></div></div>`)}</div>` : html`<p class="muted">Нет предложений.</p>`}</div>
  <div class="card"><h3>Предложенные вопросы (${pq.length})</h3>${pq.length ? html`<div class="list">${pq.map((x) => html`<div class="item"><div class="small muted">${au(x.author)} · урок ${lessonById(x.lesson_id)?.num}</div>
    <b>${x.question}</b>${x.options.map((o, i) => html`<div class="small">${i === x.correct ? "✅" : "▫️"} ${o}</div>`)}<div class="small muted">${x.explanation}</div>
    <div class="row mt"><button class="btn sm ok" data-act="approveQ" data-id="${x.id}">✓ Одобрить (+5)</button><button class="btn sm ghost" data-act="rejectQ" data-id="${x.id}">Отклонить</button></div></div>`)}</div>` : html`<p class="muted">Нет предложений.</p>`}</div>`;
}
ACT.approveCard = async (el) => {
  const c = cardById(el.dataset.id);
  await q(S.sb.from("cards").update({ status: "approved" }).eq("id", c.id)); c.status = "approved";
  if (c.author) await q(S.sb.rpc("teacher_award", { p_uid: c.author, p_reason: "suggestion", p_ref: c.id, p_delta: 5, p_note: "Одобрена карточка: " + c.term }));
  await refreshBoard(); toast("Одобрено, автору +5", "ok"); render();
};
ACT.rejectCard = async (el) => { await q(S.sb.from("cards").delete().eq("id", el.dataset.id)); S.cards = S.cards.filter((c) => c.id !== el.dataset.id); render(); };
ACT.approveQ = async (el) => {
  const x = S.questions.find((y) => y.id === el.dataset.id);
  await q(S.sb.from("questions").update({ status: "approved" }).eq("id", x.id)); x.status = "approved";
  if (x.author) await q(S.sb.rpc("teacher_award", { p_uid: x.author, p_reason: "suggestion", p_ref: x.id, p_delta: 5, p_note: "Одобрен вопрос" }));
  await refreshBoard(); toast("Одобрено, автору +5", "ok"); render();
};
ACT.rejectQ = async (el) => { await q(S.sb.from("questions").delete().eq("id", el.dataset.id)); S.questions = S.questions.filter((c) => c.id !== el.dataset.id); render(); };

// ---------- ГРУППА ----------
let lastAdded = null;
function tPeople() {
  const list = S.people.slice().sort((a, b) => (a.role === "teacher" ? -1 : 0) - (b.role === "teacher" ? -1 : 0) || a.last_name.localeCompare(b.last_name));
  const codes = window._tCodes || null;
  if (!codes) loadCodes();
  const st = students();
  return html`<div class="card"><h3>Добавить участников</h3>
    <p class="small muted">Настоящие <b>имя и фамилия</b> обязательны. По одному человеку на строку: <code>Имя Фамилия</code> (через запятую можно добавить команду и <b>уровень турецкого</b>: <code>Айгерим Сейтова, Бирлик, продвинутый</code>; уровни — начинающий / средний / продвинутый, без указания — средний). Каждому будет создан личный код для регистрации.</p>
    <p class="small muted">Уровень задаёт множитель баллов за учёбу: начинающий ×2, средний ×1,5, продвинутый ×1. Продвинутый наставник получает +25% от баллов своего подопечного-новичка за учёбу (до 10 в день).</p>
    <form data-form="roster"><textarea name="text" required style="min-height:150px" placeholder="Айгерим Сейтова, Бирлик, продвинутый&#10;Данияр Ахметов, Нур, начинающий"></textarea><button class="btn block mt">Добавить в группу</button></form></div>
  ${lastAdded ? html`<div class="card gold"><b>Только что добавлены — разошлите коды:</b><pre style="white-space:pre-wrap;font:inherit;margin:8px 0">${lastAdded}</pre><button class="btn sm" data-act="copyAdded">Скопировать</button></div>` : ""}
  <div class="card"><div class="row between"><h3 style="margin:0">Группа (${st.length})</h3><button class="btn sm soft" data-act="copyAll">Скопировать все коды</button></div>
    <p class="small muted">Ученик заходит на сайт → «Регистрация» → вводит свой код и придумывает пароль. Имя берётся из этого списка.</p>
    <div class="tbl-wrap"><table><thead><tr><th>Имя Фамилия</th><th>Код</th><th>Турецкий</th><th>Команда</th><th>Наставник</th><th></th></tr></thead><tbody>
    ${list.map((p) => html`<tr><td>${fullName(p)} ${p.role === "teacher" ? html`<span class="badge gold">учитель</span>` : p.registered ? html`<span class="badge ok">в системе</span>` : html`<span class="badge grey">ждёт</span>`}</td>
      <td><code>${codes?.[p.uid] || "…"}</code></td>
      <td><select style="padding:6px 8px;width:140px" data-change="setLevel" data-id="${p.uid}">${Object.entries(LEVEL_INFO).map(([k, v]) => html`<option value="${k}" ${levelOf(p) === v ? "selected" : ""}>${v.ru} ×${String(v.mult).replace(".", ",")}</option>`)}</select></td>
      <td><input type="text" style="width:110px;padding:6px 8px" value="${p.team || ""}" data-change="setTeam" data-id="${p.uid}" placeholder="—"></td>
      <td>${p.role === "student" ? html`<select style="padding:6px 8px;width:150px" data-change="setMentor" data-id="${p.uid}"><option value="">—</option>${st.filter((x) => x.uid !== p.uid && levelOf(x).rank > levelOf(p).rank).map((x) => html`<option value="${x.uid}" ${p.mentor === x.uid ? "selected" : ""}>${fullName(x)}</option>`)}</select>` : ""}</td>
      <td style="white-space:nowrap">${p.role === "student" ? html`${p.registered ? html`<button class="btn sm soft" data-act="resetPw" data-id="${p.uid}" title="Сбросить пароль">🔑</button> ` : ""}<button class="btn sm ghost" data-act="delPerson" data-id="${p.uid}">✕</button>` : ""}</td></tr>`)}</tbody></table></div>
    <p class="hint">🔑 — сброс пароля: прогресс сохранится, ученик заново зарегистрируется по тому же коду и придумает новый пароль.</p></div>`;
}
async function loadCodes() {
  if (window._tCodesLoading) return; window._tCodesLoading = true;
  try { const rows = await q(S.sb.from("profiles").select("uid,code")); window._tCodes = Object.fromEntries(rows.map((r) => [r.uid, r.code])); render(); }
  catch (e) { toast(errMsg(e), "err"); } finally { window._tCodesLoading = false; }
}
FORM.roster = async (f, fd) => {
  const lines = fd.get("text").split(/\r?\n/).map((s) => s.trim()).filter(Boolean), rows = [], bad = [];
  lines.forEach((line, i) => {
    const [namePart, team, lvl] = line.split(",").map((s) => s.trim());
    const level = parseLevel(lvl);
    if (level === null) { bad.push(`${i + 1}: уровень «${lvl}» — напишите начинающий, средний или продвинутый`); return; }
    const w = namePart.split(/\s+/);
    if (w.length < 2 || !w.every((x) => NAME_RE.test(x))) { bad.push(`${i + 1}: «${line}»`); return; }
    rows.push({ code: genCode(), first_name: w[0], last_name: w.slice(1).join(" "), role: "student", team: team || null, level });
  });
  if (bad.length) throw new Error(`Нужны имя и фамилия (только буквы). Проверьте строки — ${bad.join("; ")}`);
  const saved = await q(S.sb.from("profiles").insert(rows).select());
  lastAdded = (saved || rows).map((r) => `${r.last_name} ${r.first_name} — ${r.code}`).join("\n");
  window._tCodes = null; await loadAll(); toast(`Добавлено: ${rows.length}`, "ok"); render();
};
CHG.setTeam = async (el) => { await q(S.sb.from("profiles").update({ team: el.value.trim() || null }).eq("uid", el.dataset.id)); person(el.dataset.id).team = el.value.trim() || null; toast("Команда сохранена", "ok"); };
CHG.setLevel = async (el) => { await q(S.sb.from("profiles").update({ level: el.value }).eq("uid", el.dataset.id)); person(el.dataset.id).level = el.value; toast("Уровень сохранён (действует на новые баллы)", "ok"); };
CHG.setMentor = async (el) => { await q(S.sb.from("profiles").update({ mentor: el.value || null }).eq("uid", el.dataset.id)); person(el.dataset.id).mentor = el.value || null; toast("Наставник назначен", "ok"); };
ACT.delPerson = async (el) => {
  const p = person(el.dataset.id);
  if (!confirm(`Удалить ${fullName(p)} из группы вместе со всем прогрессом? Это нельзя отменить.`)) return;
  await q(S.sb.from("profiles").delete().eq("uid", p.uid)); window._tCodes = null; await loadAll(); render();
};
ACT.resetPw = async (el) => {
  const p = person(el.dataset.id);
  if (!confirm(`Сбросить пароль для ${fullName(p)}? Прогресс сохранится. Ученик зарегистрируется заново по своему коду.`)) return;
  await q(S.sb.rpc("reset_password", { p_uid: p.uid }));
  p.registered = false; toast("Пароль сброшен — пусть зарегистрируется заново по коду", "ok"); render();
};
ACT.copyAdded = () => copyText(lastAdded);
ACT.copyAll = () => copyText(students().map((p) => `${p.last_name} ${p.first_name} — ${window._tCodes?.[p.uid] || ""}`).join("\n"));

// ---------- ПОСЕЩАЕМОСТЬ ----------
function tAtt() {
  const lid = pickLesson();
  if (!lid) return html`<div class="card">Нет уроков.</div>`;
  const st = students().filter((p) => p.registered);
  return html`<div class="card"><label style="margin-top:0">Урок</label>${lessonSelect()}</div>
  <div class="card"><h3>Отметьте присутствовавших</h3><p class="small muted">За присутствие начисляется +10 баллов (повторное сохранение баллы не дублирует).</p>
  <form data-form="att"><input type="hidden" name="lesson_id" value="${lid}">
    <div class="list">${st.map((p) => { const a = S.att.find((x) => x.lesson_id === lid && x.user_id === p.uid); return html`<label class="switch item" style="margin:0"><input type="checkbox" name="p_${p.uid}" ${a?.present ? "checked" : ""}>${fullName(p)}</label>`; })}</div>
    <button class="btn block mt">Сохранить посещаемость</button></form></div>`;
}
FORM.att = async (f, fd) => {
  const lid = fd.get("lesson_id"), st = students().filter((p) => p.registered);
  const rows = st.map((p) => ({ lesson_id: lid, user_id: p.uid, present: fd.get("p_" + p.uid) === "on" }));
  await q(S.sb.from("attendance").upsert(rows));
  for (const r of rows) {
    const i = S.att.findIndex((x) => x.lesson_id === lid && x.user_id === r.user_id); if (i >= 0) S.att[i] = r; else S.att.push(r);
    await q(S.sb.rpc("teacher_award", { p_uid: r.user_id, p_reason: "attendance", p_ref: lid, p_delta: r.present ? 10 : 0, p_note: "Посещение урока" }));
  }
  await refreshBoard(); toast("Посещаемость сохранена", "ok"); render();
};

// ---------- БАЛЛЫ ----------
const AWARD_REASONS = [["mentor", "Помощь товарищу (наставничество)"], ["discussion", "Лучший вопрос / ответ в обсуждении"], ["bonus", "Другое поощрение"], ["penalty", "Корректировка (минус)"]];
function tPoints() {
  const ws = weekStart(), weekRef = "week:" + ws;
  const closed = false;
  const top = rankRows("week").slice(0, 3);
  return html`<div class="card"><h3>Закрыть неделю</h3><p class="small muted">Бонус топ-3 недели (пн–вс): 15 / 10 / 5 баллов. Неделя с ${fmtDate(ws)}.</p>
    ${top.length ? html`<div class="list">${top.map((r, i) => html`<div class="item row between"><span><span class="rank r${r.rank}">${r.rank}</span> ${fullName(r.p)}</span><span>${r.pts} → <b>+${[15, 10, 5][r.rank - 1] ?? 0}</b></span></div>`)}</div>
    <button class="btn gold block mt" data-act="closeWeek">Начислить бонус топ-3</button><p class="hint">Повторное нажатие бонус не удвоит — он привязан к неделе. Ничья делит одно место: бонус получают все с рангом 1–3.</p>` : html`<p class="muted">За эту неделю баллов пока нет.</p>`}</div>
  <div class="card"><h3>Начислить вручную</h3>
    <form data-form="award"><label>Ученик</label><select name="uid" required>${students().filter((p) => p.registered).map((p) => html`<option value="${p.uid}">${fullName(p)}</option>`)}</select>
    <label>За что</label><select name="reason">${AWARD_REASONS.map(([k, n]) => html`<option value="${k}">${n}</option>`)}</select>
    <div class="row"><div class="grow"><label>Баллы</label><input type="number" name="delta" value="5" min="1" max="100" required></div></div>
    <label>Комментарий (увидит только учитель)</label><input type="text" name="note"><button class="btn block mt">Начислить</button></form></div>
  <div class="card"><h3>Последние начисления от учителя</h3><div id="plog" class="small muted">Загрузка…</div></div>`;
}
FORM.award = async (f, fd) => {
  const reason = fd.get("reason"), d = Number(fd.get("delta")) * (reason === "penalty" ? -1 : 1);
  await q(S.sb.rpc("teacher_award", { p_uid: fd.get("uid"), p_reason: reason, p_ref: null, p_delta: d, p_note: fd.get("note").trim() || null }));
  await refreshBoard(); toast("Начислено", "ok"); render();
};
ACT.closeWeek = async () => {
  const ws = weekStart(), top = rankRows("week").filter((r) => r.rank <= 3 && r.pts > 0);
  if (!confirm(`Начислить бонус: ${top.map((r) => fullName(r.p)).join(", ")}?`)) return;
  for (const r of top) await q(S.sb.rpc("teacher_award", { p_uid: r.p.uid, p_reason: "weekly_top", p_ref: "week:" + ws, p_delta: [15, 10, 5][r.rank - 1], p_note: `Топ-${r.rank} недели ${ws}` }));
  await refreshBoard(); toast("Бонус начислен", "ok"); render();
};
async function loadPointsLog() {
  const el = document.getElementById("plog"); if (!el) return;
  try {
    const rows = await q(S.sb.from("points_log").select("*").neq("reason", "practice").order("updated_at", { ascending: false }).limit(25));
    const t = rows.filter((r) => ["mentor", "mentor_share", "discussion", "bonus", "penalty", "weekly_top", "suggestion", "attendance"].includes(r.reason)).slice(0, 15);
    const names = { mentor: "наставничество", mentor_share: "доля наставника", discussion: "обсуждение", bonus: "поощрение", penalty: "корректировка", weekly_top: "топ недели", suggestion: "одобрено предложение", attendance: "посещение" };
    el.innerHTML = t.length ? t.map((r) => `<div style="padding:6px 0;border-top:1px solid var(--line)">${esc(fullName(person(r.user_id)))} · <b>${r.delta > 0 ? "+" : ""}${r.delta}</b> · ${esc(names[r.reason] || r.reason)}${r.note ? " · " + esc(r.note) : ""}</div>`).join("") : "Пока нет.";
  } catch (e) { el.textContent = errMsg(e); }
}
