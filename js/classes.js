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
const OTABS = [["overview", "Обзор"], ["history", "История баллов"], ["lessons", "Уроки"]];
function observerView(tab = "overview", arg) {
  const fn = { overview: () => tOverview(), history: () => historyCard(), lessons: oLessons, student: () => tStudent(arg) }[tab] || (() => tOverview());
  return html`<h1>Класс «${curClass()?.name || ""}»</h1><p class="small muted">Наблюдательный аккаунт: только просмотр.</p>
  <div class="tabs">${OTABS.map(([k, n]) => html`<a href="#/o/${k}" class="${k === tab ? "on" : ""}">${n}</a>`)}</div>${fn()}`;
}
function oLessons() {
  const ls = S.lessons.slice().sort((a, b) => b.num - a.num), n = students().length;
  return html`${ls.map((l) => html`<div class="card"><div class="row between"><h3 style="margin:0">Урок ${l.num}: ${l.title}</h3><span class="small muted">${fmtDate(l.lesson_date)}</span></div>
    ${l.summary ? html`<p class="small" style="white-space:pre-wrap">${l.summary}</p>` : ""}
    <p class="small muted">${S.cards.filter((c) => c.lesson_id === l.id && c.status === "approved").length} карточек · присутствовало ${S.att.filter((a) => a.lesson_id === l.id && a.present).length} из ${n} · ДЗ сдали ${S.hw.filter((h) => h.lesson_id === l.id).length}${l.homework ? "" : " (ДЗ не задано)"} · тест: ${l.test_open ? "открыт" : "закрыт"}</p>
    ${l.homework ? html`<div class="small"><b>ДЗ:</b> ${l.homework}</div>` : ""}</div>`)}
  ${ls.length ? "" : html`<div class="card muted">Уроков пока нет.</div>`}`;
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
