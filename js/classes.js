// ============================================================
//  Классы, история баллов, наблюдательный аккаунт
// ============================================================

// ---------- переключатель класса (учитель) ----------
const classBar = () => html`<div class="card" style="padding:10px 14px"><div class="row"><span class="small muted">Класс:</span>
  <select class="grow" data-change="pickClass">${S.classes.map((c) => html`<option value="${c.id}" ${c.id === S.classId ? "selected" : ""}>${c.name}</option>`)}</select>
  <a class="btn sm soft" href="#/t/classes">Классы</a></div></div>`;
async function switchClass(id) {
  S.classId = id; try { localStorage.setItem("lemalar_class", id); } catch {}
  hist.rows = null; hist.uid = ""; window._tDiary = {}; window._tHw = {}; tLesson = null; editLessonId = null; editCardId = null;
  await loadAll();
}
CHG.pickClass = async (el) => { await switchClass(el.value); render(); };
const studentHref = (uid) => (isTeacher() ? "#/t/student/" : "#/o/student/") + uid;

// ---------- вкладка «Классы» ----------
function tClasses() {
  if (!window._tCodes) loadCodes();
  const base = location.origin + location.pathname;
  return html`<div class="card"><h3>Новый класс</h3>
    <form data-form="newClass"><label>Название класса</label><input type="text" name="name" required maxlength="60" placeholder="например, Бекзат"><button class="btn block mt">Создать класс</button></form>
    <p class="hint">В каждом классе свои ученики, уроки, карточки, рейтинг и баллы. Для нового класса сразу создаётся наблюдательный аккаунт (только просмотр).</p></div>
  ${(() => {
    const lost = S.allPeople.filter((p) => p.role === "student" && !p.class_id), lostL = S.allLessons.filter((l) => !l.class_id);
    return lost.length || lostL.length ? html`<div class="card gold"><h3>Без класса: ${lost.length} уч., ${lostL.length} ур.</h3>
      <p class="small">Эти данные не потеряны, просто не привязаны к классу и поэтому не видны. Выберите класс и привяжите.</p>
      <form data-form="adoptLost"><select name="cid">${S.classes.map((c) => html`<option value="${c.id}">${c.name}</option>`)}</select><button class="btn block mt">Привязать к выбранному классу</button></form>
      <div class="small muted mt">${lost.map(fullName).join(", ")}</div></div>` : "";
  })()}
  ${S.classes.map((c) => {
    const st = S.allPeople.filter((p) => p.role === "student" && p.class_id === c.id), obs = S.allPeople.find((p) => p.role === "observer" && p.class_id === c.id);
    const lessons = S.allLessons.filter((l) => l.class_id === c.id), code = obs ? window._tCodes?.[obs.uid] : null;
    return html`<div class="card"><div class="row between"><h3 style="margin:0">${c.name}${c.id === S.classId ? html` <span class="badge ok">выбран</span>` : ""}</h3>
      <span class="small muted">${st.length} уч. · ${lessons.length} ур.</span></div>
      <div class="row wrap mt"><button class="btn sm" data-act="openClass" data-id="${c.id}">Открыть</button><button class="btn sm soft" data-act="renameClass" data-id="${c.id}">Переименовать</button><button class="btn sm ghost" data-act="delClass" data-id="${c.id}">Удалить</button></div>
      ${obs ? html`<div class="item mt"><b>👁 Наблюдательный аккаунт</b>
        <div class="small muted">Видит только этот класс: учеников, баллы и их историю, прогресс, уроки. Ничего менять не может, дневники и тексты ответов не видит.</div>
        <div class="small mt">${obs.registered ? html`<span class="badge ok">в системе</span>` : html`<span class="badge grey">ждёт регистрации</span>`} · код: <code>${code || "…"}</code></div>
        <div class="row wrap mt">${code && !obs.registered ? html`<button class="btn sm soft" data-act="copyObs" data-id="${obs.uid}" data-name="${c.name}">Скопировать приглашение</button>` : ""}
          ${obs.registered ? html`<button class="btn sm soft" data-act="resetObs" data-id="${obs.uid}">🔑 Сбросить пароль</button>` : ""}</div>
        <p class="hint">Наблюдатель заходит на сайт: «Регистрация» → код → пароль. Ссылка: ${base}</p></div>` : ""}</div>`;
  })}`;
}
FORM.adoptLost = async (f, fd) => {
  const cid = fd.get("cid");
  for (const p of S.allPeople.filter((x) => x.role === "student" && !x.class_id)) await q(S.sb.from("profiles").update({ class_id: cid }).eq("uid", p.uid));
  for (const l of S.allLessons.filter((x) => !x.class_id)) await q(S.sb.from("lessons").update({ class_id: cid }).eq("id", l.id));
  await switchClass(cid); toast("Привязано", "ok"); render();
};
FORM.newClass = async (f, fd) => {
  const row = await q(S.sb.from("classes").insert({ name: fd.get("name").trim() }).select().single());
  window._tCodes = null; await switchClass(row.id); toast("Класс создан", "ok"); render();
};
ACT.openClass = async (el) => { await switchClass(el.dataset.id); location.hash = "#/t/overview"; render(); };
ACT.renameClass = async (el) => {
  const c = classById(el.dataset.id), name = prompt("Новое название класса:", c.name); if (!name || !name.trim() || name.trim() === c.name) return;
  await q(S.sb.from("classes").update({ name: name.trim() }).eq("id", c.id)); await loadAll(); render();
};
ACT.delClass = async (el) => {
  const c = classById(el.dataset.id);
  if (!confirm(`Удалить пустой класс «${c.name}» и его наблюдательный аккаунт? Класс с учениками или уроками удалить нельзя.`)) return;
  await q(S.sb.from("classes").delete().eq("id", c.id)); window._tCodes = null; await loadAll(); resetHist(); toast("Класс удалён", "ok"); render();
};
ACT.copyObs = (el) => copyText(`Наблюдательный аккаунт класса «${el.dataset.name}»: откройте ${location.origin + location.pathname}, вкладка «Регистрация», код ${window._tCodes?.[el.dataset.id] || ""}, затем придумайте пароль.`);
ACT.resetObs = async (el) => {
  if (!confirm("Сбросить пароль наблюдателя? Он заново зарегистрируется по тому же коду.")) return;
  await q(S.sb.rpc("reset_password", { p_uid: el.dataset.id }));
  const p = S.allPeople.find((x) => x.uid === el.dataset.id); if (p) p.registered = false; toast("Пароль сброшен", "ok"); render();
};

// ---------- история баллов ----------
// [значок, название, категория]
const PT_REASONS = {
  learn_card: ["📘", "Выучено слово", "study"], practice: ["🏋️", "Тренировка за день", "study"], test: ["📝", "Тест", "study"],
  checkin: ["🔥", "Ежедневное чтение", "habit"], homework: ["📚", "Домашнее задание", "habit"], diary: ["✍️", "Дневник", "habit"], attendance: ["🏫", "Посещение урока", "habit"],
  mentor_share: ["🤝", "Доля наставника", "mentor"], mentor: ["🤝", "Помощь товарищу", "mentor"],
  discussion: ["💬", "Обсуждение", "teacher"], bonus: ["🎁", "Поощрение", "teacher"], penalty: ["⚠️", "Корректировка", "teacher"], suggestion: ["💡", "Одобрено предложение", "teacher"],
  weekly_top: ["🏆", "Бонус недели", "week"],
};
const PT_CATS = [["", "Все причины"], ["study", "Учёба: слова, тренировка, тесты"], ["habit", "Чтение, ДЗ, дневник, посещение"], ["mentor", "Наставничество"], ["teacher", "От учителя"], ["week", "Топ недели"]];
const PT_SHORT = { study: "Учёба", habit: "Привычки", mentor: "Наставн.", teacher: "Учитель", week: "Топ недели" };
const hist = { uid: "", cat: "", days: "30", rows: null, busy: false, at: 0 };
const resetHist = () => { hist.rows = null; };
async function loadHist() {
  hist.busy = true;
  try { hist.rows = await q(S.sb.from("points_log").select("*").order("updated_at", { ascending: false })); }
  catch (e) { toast(errMsg(e), "err"); hist.rows = hist.rows || []; }
  finally { hist.busy = false; hist.at = Date.now(); }
  render();
}
CHG.histUid = (el) => { hist.uid = el.value; render(); };
CHG.histCat = (el) => { hist.cat = el.value; render(); };
CHG.histDays = (el) => { hist.days = el.value; render(); };
ACT.histReload = () => { hist.rows = null; render(); };

function ptDetail(r) {
  const les = (id) => { const l = lessonById(id); return l ? `Урок ${l.num}: ${l.title}` : "урок"; };
  switch (r.reason) {
    case "learn_card": { const c = S.cards.find((x) => x.id === r.ref); return c ? `«${c.term}» — ${c.translation}` : "слово"; }
    case "test": case "homework": case "attendance": return les(r.ref);
    case "practice": case "checkin": case "diary": return fmtDate(r.ref);
    default: return r.note || "";
  }
}
function histRows(fixedUid) {
  const ids = new Set(students().map((p) => p.uid)), cut = hist.days === "all" ? "" : new Date(Date.now() - Number(hist.days) * 864e5).toISOString(), uid = fixedUid || hist.uid;
  return (hist.rows || []).filter((r) => ids.has(r.user_id) && r.delta !== 0 && (!uid || r.user_id === uid) && (!cut || r.updated_at >= cut) && (!hist.cat || PT_REASONS[r.reason]?.[2] === hist.cat));
}
function historyCard(fixedUid) {
  if (hist.rows === null && !hist.busy || (hist.rows && !hist.busy && Date.now() - hist.at > 60000)) loadHist();
  if (hist.rows === null) return html`<div class="card"><h3>История баллов</h3><p class="muted">Загрузка…</p></div>`;
  const rows = histRows(fixedUid), uid = fixedUid || hist.uid, total = sum(rows, (r) => r.delta);
  const byUser = {};
  for (const r of rows) { const o = (byUser[r.user_id] ||= { uid: r.user_id, total: 0 }); const c = PT_REASONS[r.reason]?.[2] || "teacher"; o.total += r.delta; o[c] = (o[c] || 0) + r.delta; }
  const sums = Object.values(byUser).sort((a, b) => b.total - a.total);
  return html`<div class="card"><div class="row between"><h3 style="margin:0">История баллов</h3><div class="row"><button class="btn sm soft" data-act="histReload">↻</button><button class="btn sm soft" data-act="histCsv" data-uid="${fixedUid || ""}">⬇ CSV</button></div></div>
    <p class="small muted">Кто, когда и за что получил баллы. Для тренировки показан последний момент за день.</p>
    <div class="row wrap">${fixedUid ? "" : html`<select class="grow" data-change="histUid"><option value="">Все ученики</option>${students().map((p) => html`<option value="${p.uid}" ${uid === p.uid ? "selected" : ""}>${fullName(p)}</option>`)}</select>`}
      <select class="grow" data-change="histCat">${PT_CATS.map(([k, n]) => html`<option value="${k}" ${hist.cat === k ? "selected" : ""}>${n}</option>`)}</select>
      <select data-change="histDays">${[["7", "7 дней"], ["30", "30 дней"], ["all", "Всё время"]].map(([k, n]) => html`<option value="${k}" ${hist.days === k ? "selected" : ""}>${n}</option>`)}</select></div>
    <p class="mt">Записей: <b>${rows.length}</b> · итого <b>${total > 0 ? "+" : ""}${total}</b> баллов</p>
    ${!uid && sums.length ? html`<div class="tbl-wrap"><table><thead><tr><th>Ученик</th><th class="num">Всего</th>${Object.entries(PT_SHORT).map(([, n]) => html`<th class="num">${n}</th>`)}</tr></thead>
      <tbody>${sums.map((o) => html`<tr><td><a href="${studentHref(o.uid)}">${fullName(person(o.uid))}</a></td><td class="num"><b>${o.total}</b></td>${Object.keys(PT_SHORT).map((k) => html`<td class="num">${o[k] || "—"}</td>`)}</tr>`)}</tbody></table></div>` : ""}
    <div class="list mt">${rows.slice(0, 150).map((r) => { const m = PT_REASONS[r.reason] || ["•", r.reason, "teacher"], d = ptDetail(r); return html`<div class="item row between"><div class="grow"><div>${m[0]} <b>${m[1]}</b>${uid ? "" : html` · ${fullName(person(r.user_id))}`}</div>
      <div class="tiny muted">${fmtDateTime(r.updated_at)}${d ? " · " + d : ""}${r.note && d !== r.note ? " · " + r.note : ""}</div></div><span class="badge ${r.delta < 0 ? "bad" : "ok"}">${r.delta > 0 ? "+" : ""}${r.delta}</span></div>`; })}
      ${rows.length ? "" : html`<div class="muted item">За выбранный период начислений нет.</div>`}</div>
    ${rows.length > 150 ? html`<p class="hint">Показаны последние 150 из ${rows.length}. Полный список — в CSV.</p>` : ""}</div>`;
}
ACT.histCsv = (el) => {
  const rows = histRows(el.dataset.uid || null), head = ["Дата", "Ученик", "Причина", "Подробности", "Баллы"];
  const lines = [head.map(csvCell).join(";")].concat(rows.map((r) => [fmtDateTime(r.updated_at), fullName(person(r.user_id)), PT_REASONS[r.reason]?.[1] || r.reason, [ptDetail(r), r.note].filter(Boolean).join(" · "), r.delta].map(csvCell).join(";")));
  download(`lemalar_bally_${todayKZ()}.csv`, "﻿" + lines.join("\n"));
};

// ---------- наблюдательный аккаунт ----------
// Видит ту же статистику, что и учитель (обзор, уроки, карточки, группа, посещаемость, баллы, страницы учеников),
// но только для чтения. Не видит: коды входа, тексты домашних заданий, дневники, черновики.
const OTABS = [["overview", "Обзор"], ["lessons", "Уроки"], ["cards", "Карточки"], ["people", "Группа"], ["att", "Посещаемость"], ["points", "Баллы"], ["history", "История баллов"]];
function observerView(tab = "overview", arg) {
  const fn = { overview: () => tOverview(), lessons: oLessons, cards: oCards, people: oPeople, att: oAtt, points: oPoints, history: () => historyCard(), student: () => tStudent(arg) }[tab] || (() => tOverview());
  return html`<h1>Класс «${curClass()?.name || ""}»</h1><p class="small muted">Наблюдательный аккаунт: вся статистика, только просмотр.</p>
  <div class="tabs">${OTABS.map(([k, n]) => html`<a href="#/o/${k}" class="${k === tab || (tab === "student" && k === "overview") ? "on" : ""}">${n}</a>`)}</div>${fn()}`;
}
const pct = (a, b) => (b ? Math.round(a / b * 100) : null);
function oLessons() {
  const ls = S.lessons.slice().sort((a, b) => b.num - a.num), st = students(), reg = st.filter((p) => p.registered);
  return html`${ls.map((l) => {
    const present = S.att.filter((a) => a.lesson_id === l.id && a.present).length, hw = S.hw.filter((h) => h.lesson_id === l.id).length;
    const tt = S.tTests.filter((t) => t.lesson_id === l.id), avg = tt.length ? Math.round(sum(tt, (t) => (t.total ? t.best / t.total : 0)) / tt.length * 100) : null;
    const cs = S.cards.filter((c) => c.lesson_id === l.id && c.status === "approved");
    return html`<div class="card"><div class="row between"><h3 style="margin:0">Урок ${l.num}: ${l.title}</h3><span class="small muted">${fmtDate(l.lesson_date)}</span></div>
    ${l.summary ? html`<p class="small" style="white-space:pre-wrap">${l.summary}</p>` : ""}
    <div class="row wrap mt"><span class="badge">${cs.length} карточек</span><span class="badge ${present ? "ok" : "grey"}">присутствовало ${present} из ${st.length}</span>
      <span class="badge ${l.homework ? (hw ? "ok" : "grey") : "grey"}">${l.homework ? `ДЗ сдали ${hw} из ${reg.length}` : "ДЗ не задано"}</span>
      <span class="badge ${l.test_open ? "gold" : "grey"}">тест: ${l.test_open ? "открыт" : "закрыт"}</span>${avg != null ? html`<span class="badge">средний результат теста ${avg}% (${tt.length} чел.)</span>` : ""}</div>
    ${l.homework ? html`<div class="small mt"><b>ДЗ:</b> ${l.homework}${l.homework_due ? html` <span class="muted">· срок ${fmtDate(l.homework_due)}</span>` : ""}</div>` : ""}
    ${l.discussion_topic ? html`<div class="small mt"><b>Тема обсуждения:</b> ${l.discussion_topic}</div>` : ""}
    ${l.slides_url ? html`<div class="small mt"><a href="${l.slides_url}" target="_blank" rel="noopener">Презентация ↗</a></div>` : ""}
    ${tt.length ? html`<details class="mt"><summary>Результаты теста по ученикам</summary><div class="list mt">${tt.slice().sort((a, b) => (b.total ? b.best / b.total : 0) - (a.total ? a.best / a.total : 0)).map((t) => html`<div class="item row between"><a href="${studentHref(t.user_id)}">${fullName(person(t.user_id))}</a><span><b>${t.best}/${t.total}</b> <span class="muted tiny">попыток: ${t.tries}</span></span></div>`)}</div></details>` : ""}</div>`; })}
  ${ls.length ? "" : html`<div class="card muted">Уроков пока нет.</div>`}`;
}
function oCards() {
  const ls = S.lessons.slice().sort((a, b) => a.num - b.num);
  if (!ls.length) return html`<div class="card muted">Уроков пока нет.</div>`;
  const lid = (ls.find((l) => l.id === tLesson) || ls[ls.length - 1]).id; tLesson = lid;
  const cs = S.cards.filter((c) => c.lesson_id === lid && c.status === "approved");
  return html`<div class="card"><label style="margin-top:0">Урок</label><select data-change="pickLesson">${ls.map((l) => html`<option value="${l.id}" ${l.id === lid ? "selected" : ""}>Урок ${l.num}: ${l.title}</option>`)}</select></div>
  <div class="card"><h3>Карточки урока (${cs.length})</h3><p class="small muted">Справа — доля ошибок по классу (учитывается, когда слово встретилось не менее 3 раз).</p>
  <div class="list">${cs.map((c) => { const s = S.tCards[c.id], n = s ? s.right_total + s.wrong_total : 0, err = n ? Math.round(s.wrong_total / n * 100) : null;
    return html`<div class="item"><div class="row between"><div class="grow"><b dir="auto">${c.term}</b> — ${c.translation} ${c.kind === "idea" ? html`<span class="badge">идея</span>` : ""}</div>
      ${n >= 3 ? html`<span class="badge ${err >= 40 ? "bad" : err >= 20 ? "gold" : "ok"}">${err}% ошибок</span>` : html`<span class="badge grey">мало данных</span>`}</div>
      <div class="small muted">${c.explanation}</div>${c.example ? html`<div class="small mt"><i>${c.example}</i></div>` : ""}${c.source_ref ? html`<div class="tiny muted">${c.source_ref}</div>` : ""}</div>`; })}
    ${cs.length ? "" : html`<div class="muted item">Карточек пока нет.</div>`}</div></div>`;
}
function oPeople() {
  const st = students().slice().sort((a, b) => a.last_name.localeCompare(b.last_name)), nameOf = (uid) => (uid ? fullName(person(uid)) : "—");
  const teams = {}; st.forEach((p) => { if (p.team) (teams[p.team] ||= []).push(p); });
  return html`<div class="card"><h3 style="margin:0">Класс «${curClass()?.name || ""}»: ${st.length} уч., в системе ${st.filter((p) => p.registered).length}</h3>
    <div class="tbl-wrap mt"><table><thead><tr><th>Ученик</th><th>Турецкий</th><th>Команда</th><th>Наставник</th><th>Статус</th></tr></thead><tbody>
    ${st.map((p) => html`<tr><td><a href="${studentHref(p.uid)}">${fullName(p)}</a></td><td>${levelOf(p).ru}</td><td>${p.team || "—"}</td><td>${nameOf(p.mentor)}</td>
      <td>${p.registered ? html`<span class="badge ok">в системе</span>` : html`<span class="badge grey">ещё не вошёл(ла)</span>`}</td></tr>`)}</tbody></table></div></div>
  ${Object.keys(teams).length ? html`<div class="card"><h3>Команды</h3><div class="list">${Object.entries(teams).map(([n, m]) => html`<div class="item"><b>${n}</b> <span class="muted small">· ${m.length} уч. · баллы всего ${sum(m, (p) => S.board[p.uid]?.total || 0)}, за неделю ${sum(m, (p) => S.board[p.uid]?.week || 0)}</span>
    <div class="small">${m.map((p) => fullName(p) + (levelOf(p).rank === 3 ? " ★" : "")).join(", ")}</div></div>`)}</div><p class="hint">★ — продвинутый уровень (наставник).</p></div>` : ""}`;
}
function oAtt() {
  const ls = S.lessons.slice().sort((a, b) => a.num - b.num), st = students().filter((p) => p.registered).sort((a, b) => a.last_name.localeCompare(b.last_name));
  if (!ls.length) return html`<div class="card muted">Уроков пока нет.</div>`;
  const was = (l, p) => S.att.find((a) => a.lesson_id === l.id && a.user_id === p.uid);
  return html`<div class="card"><h3>Посещаемость</h3><p class="small muted">✓ был(а) · ✗ не был(а) · · не отмечено</p>
    <div class="tbl-wrap"><table><thead><tr><th>Ученик</th>${ls.map((l) => html`<th class="num">У${l.num}</th>`)}<th class="num">Итого</th></tr></thead><tbody>
    ${st.map((p) => { const n = ls.filter((l) => was(l, p)?.present).length; return html`<tr><td><a href="${studentHref(p.uid)}">${fullName(p)}</a></td>${ls.map((l) => { const a = was(l, p); return html`<td class="num">${a ? (a.present ? "✓" : "✗") : "·"}</td>`; })}<td class="num"><b>${n}/${ls.length}</b> <span class="muted tiny">${pct(n, ls.length)}%</span></td></tr>`; })}</tbody>
    <tfoot><tr><td><b>Присутствовало</b></td>${ls.map((l) => html`<td class="num"><b>${S.att.filter((a) => a.lesson_id === l.id && a.present).length}</b></td>`)}<td></td></tr></tfoot></table></div></div>`;
}
function oPoints() {
  const rows = rankRows("all"), wk = rankRows("week"), tot = sum(rows, (r) => r.pts);
  return html`<div class="card"><h3>Рейтинг за всё время</h3><p class="small muted">Всего баллов у класса: <b>${tot}</b> · в среднем на ученика: <b>${rows.length ? Math.round(tot / rows.length) : 0}</b></p>
    <div class="list">${rows.map((r) => html`<div class="item row between"><span><span class="rank r${r.rank}">${r.rank}</span> <a href="${studentHref(r.p.uid)}">${fullName(r.p)}</a> <span class="badge grey">${levelOf(r.p).ru}</span></span><span><b>${r.pts}</b> <span class="muted tiny">нед. ${S.board[r.p.uid]?.week || 0}</span></span></div>`)}</div></div>
  <div class="card"><h3>Лидеры недели</h3><div class="list">${wk.slice(0, 10).map((r) => html`<div class="item row between"><span><span class="rank r${r.rank}">${r.rank}</span> ${fullName(r.p)}</span><b>${r.pts}</b></div>`)}${wk.length ? "" : html`<div class="muted item">На этой неделе баллов пока нет.</div>`}</div></div>
  ${historyCard()}`;
}
// на странице ученика (для наблюдателя): сдача ДЗ и посещаемость без текстов ответов
function oStudentExtra(uid) {
  const ls = S.lessons.slice().sort((a, b) => a.num - b.num);
  return html`<div class="card"><h3>Уроки: посещаемость и ДЗ</h3><div class="list">${ls.map((l) => { const a = S.att.find((x) => x.lesson_id === l.id && x.user_id === uid), h = S.hw.find((x) => x.lesson_id === l.id && x.user_id === uid);
    return html`<div class="item row between"><span>Урок ${l.num}: ${l.title}</span><span>${a ? (a.present ? html`<span class="badge ok">был(а)</span>` : html`<span class="badge bad">не был(а)</span>`) : html`<span class="badge grey">не отмечено</span>`} ${l.homework ? (h ? html`<span class="badge ok">ДЗ сдано${h.created_at ? " " + fmtDate(h.created_at) : ""}</span>` : html`<span class="badge bad">ДЗ нет</span>`) : ""}</span></div>`; })}
    ${ls.length ? "" : html`<div class="muted item">Уроков пока нет.</div>`}</div><p class="hint">Тексты домашних заданий и дневники видит только учитель.</p></div>`;
}

function observerMe() {
  return html`<h1>Мой профиль</h1><div class="card"><b style="font-size:1.1rem">${S.me.first_name} ${S.me.last_name}</b>
    <div class="small muted">Наблюдатель класса «${curClass()?.name || ""}» · только просмотр</div></div>
  <div class="card"><h3>Сменить пароль</h3><form data-form="chpw"><label>Текущий пароль</label><input type="password" name="old" required autocomplete="current-password">
    <label>Новый пароль (минимум 6 символов)</label><input type="password" name="n1" required minlength="6" autocomplete="new-password">
    <label>Повторите новый пароль</label><input type="password" name="n2" required minlength="6" autocomplete="new-password">
    <button class="btn block mt">Сменить пароль</button></form></div>
  <button class="btn ghost block" data-act="logout">Выйти</button>`;
}
