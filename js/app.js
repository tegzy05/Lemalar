// ============================================================
//  Каркас: вход, маршрутизация, события
// ============================================================
const $app = () => document.getElementById("app");
let auth = { mode: "login", step: 1, code: "", info: null };
let lastHash = null;

function route() {
  const h = (location.hash || "").replace(/^#\/?/, "");
  const [name = "", a, b] = h.split("/");
  return { name, a, b };
}

// ---------- вход / регистрация ----------
function authView() {
  const demo = S.demo;
  return html`<div class="auth">
    <img class="logo" src="icons/icon-192.png" alt="">
    <h1 class="center">Lessons</h1>
    <div class="card">
      <div class="seg"><button class="${auth.mode === "login" ? "on" : ""}" data-act="authMode" data-m="login">Вход</button><button class="${auth.mode === "reg" ? "on" : ""}" data-act="authMode" data-m="reg">Регистрация</button></div>
      ${auth.mode === "login" ? html`<form data-form="login">
          <label>Ваш код</label><input type="text" name="code" required autocomplete="username" autocapitalize="characters" placeholder="например, K7MQ4XTP" value="${auth.code}">
          <label>Пароль</label><input type="password" name="password" required autocomplete="current-password">
          <button class="btn block mt">Войти</button></form>`
      : auth.step === 1 ? html`<form data-form="reg1">
          <p class="small muted">Код вам выдал учитель. Имя и фамилия подтянутся из списка группы.</p>
          <label>Код регистрации</label><input type="text" name="code" required autocapitalize="characters" placeholder="например, K7MQ4XTP" value="${auth.code}">
          <button class="btn block mt">Продолжить</button></form>`
      : html`<form data-form="reg2">
          <div class="card gold flat center" style="margin-bottom:0"><div class="small muted">Вы регистрируетесь как</div><h2 style="margin:4px 0">${auth.info.first_name} ${auth.info.last_name}</h2><div class="small">Это вы? Если нет — вернитесь и проверьте код.</div></div>
          <label>Придумайте пароль (минимум 6 символов)</label><input type="password" name="p1" required minlength="6" autocomplete="new-password">
          <label>Повторите пароль</label><input type="password" name="p2" required minlength="6" autocomplete="new-password">
          <button class="btn block mt">Создать аккаунт</button>
          <button type="button" class="btn ghost block mt" data-act="authBack">← Назад</button></form>`}
    </div>
    ${demo ? html`<div class="card gold"><b>Сервер не подключён</b><p class="small">В файле config.js не указан адрес Google Apps Script (API_URL). Вход станет доступен после подключения.</p></div>` : ""}
  </div>`;
}
ACT.authMode = (el) => { auth = { mode: el.dataset.m, step: 1, code: "", info: null }; render(); };
ACT.authBack = () => { auth.step = 1; render(); };
// Просмотр «глазами ученика»: настоящие данные выбранного ученика, только чтение (ничего не сохраняется и баллы не начисляются)
const PREVIEW_WRITES = new Set(["insert", "update", "upsert", "delete"]), PREVIEW_RPC_OK = new Set(["leaderboard", "checkins", "progress_summary", "card_stats", "test_summary", "check_invite"]);
function readOnlyClient(real) {
  let warned = 0;
  const note = () => { if (Date.now() - warned > 4000) { warned = Date.now(); toast("Режим просмотра: изменения не сохраняются", ""); } };
  const noop = () => { note(); const r = { data: [], error: null }; const o = { then: (res, rej) => Promise.resolve(r).then(res, rej) }; ["select", "eq", "single", "maybeSingle", "order", "in", "limit"].forEach((m) => (o[m] = () => o)); return o; };
  return {
    from: (t) => new Proxy(real.from(t), { get: (tg, p) => (PREVIEW_WRITES.has(p) ? noop : typeof tg[p] === "function" ? tg[p].bind(tg) : tg[p]) }),
    rpc: (name, args) => (PREVIEW_RPC_OK.has(name) ? real.rpc(name, args) : (note(), Promise.resolve({ data: 0, error: null }))),
    auth: real.auth,
  };
}
FORM.preview = async (f, fd) => {
  if (!isTeacher() || S.preview) return;
  const st = S.people.find((p) => p.uid === fd.get("uid") && p.role === "student");
  if (!st) throw new Error("Выберите ученика");
  S.real = { sb: S.sb, me: S.me }; S.preview = st;
  S.sb = readOnlyClient(S.real.sb); S.me = st;
  await loadAll(); location.hash = "#/home"; render();
};
ACT.exitPreview = () => { location.hash = "#/"; location.reload(); };
FORM.login = async (f, fd) => { auth.code = fd.get("code").trim(); await doLogin(auth.code, fd.get("password")); go(); };
FORM.reg1 = async (f, fd) => {
  const code = fd.get("code").trim().toUpperCase(); auth.code = code;
  const r = await q(S.sb.rpc("check_invite", { p_code: code }));
  if (!r || !r.length) throw new Error("Код не найден. Проверьте, нет ли опечатки, или спросите учителя.");
  if (r[0].claimed) throw new Error("Этот код уже зарегистрирован — перейдите на вкладку «Вход».");
  auth.info = r[0]; auth.step = 2; render();
};
FORM.reg2 = async (f, fd) => {
  if (fd.get("p1") !== fd.get("p2")) throw new Error("Пароли не совпадают");
  await doRegister(auth.code, fd.get("p1")); toast("Добро пожаловать!", "ok"); go();
};
function go() { location.hash = isTeacher() ? "#/t/overview" : "#/home"; render(); }

// ---------- каркас ----------
function navItems() {
  return isTeacher()
    ? [["#/t/overview", "⚙️", "Панель", ["t"]], ["#/lessons", "📖", "Уроки", ["lessons", "lesson", "learn", "test"]], ["#/board", "🏆", "Рейтинг", ["board"]], ["#/me", "👤", "Я", ["me"]]]
    : [["#/home", "🏠", "Главная", ["home"]], ["#/lessons", "📖", "Уроки", ["lessons", "lesson", "learn", "test"]], ["#/board", "🏆", "Рейтинг", ["board"]], ["#/me", "✍️", "Дневник", ["me"]]];
}
function chrome(r) {
  const on = !!S.me;
  document.getElementById("topbar").classList.toggle("hidden", !on);
  document.getElementById("nav").classList.toggle("hidden", !on);
  const bn = document.getElementById("demo-banner"); bn.classList.toggle("hidden", !S.preview);
  if (S.preview) bn.innerHTML = `👁 Вы смотрите глазами: <b>${esc(S.preview.first_name + " " + S.preview.last_name)}</b> — только просмотр, ничего не сохраняется. <a href="#" data-act="exitPreview">Выйти в аккаунт учителя</a>`;
  if (!on) return;
  document.getElementById("who").textContent = `${S.me.first_name} ${S.me.last_name}${isTeacher() ? " · учитель" : ""}`;
  updateChip();
  const cur = r.name === "learn" && r.a === "daily" ? "home" : r.name;
  document.getElementById("nav-inner").innerHTML = navItems().map(([h, ic, n, names]) => `<a href="${h}" class="${names.includes(cur) ? "on" : ""}"><span class="ic">${ic}</span>${n}</a>`).join("");
}

function render() {
  if (!S.sb) return;
  const r = route(), root = $app();
  stopTimer();
  if (sess && r.name !== "learn") { const s = sess; sess = null; flushSession(s); }
  if (!S.me) { chrome(r); root.innerHTML = authView().s; return; }
  if (!r.name || (r.name === "home" && isTeacher())) { return void (location.hash = isTeacher() ? "#/t/overview" : "#/home"); }
  if (r.name === "t" && !isTeacher()) { return void (location.hash = "#/home"); }
  chrome(r);
  let v;
  try {
    switch (r.name) {
      case "home": v = homeView(); break;
      case "lessons": v = lessonsView(); break;
      case "lesson": v = lessonView(r.a, r.b || "info"); break;
      case "learn": v = learnView(r.a, r.b || "mix"); break;
      case "test": v = testView(r.a); break;
      case "board": v = boardView(r.a || "week"); break;
      case "me": v = meView(); break;
      case "t": v = teacherView(r.a || "overview", r.b); break;
      default: v = homeView();
    }
  } catch (e) { console.error(e); v = html`<div class="card"><h3>Ошибка отображения</h3><p class="small">${e.message}</p><a href="#/home">На главную</a></div>`; }
  root.innerHTML = v.s;
  const h = location.hash;
  if (h !== lastHash) { window.scrollTo(0, 0); lastHash = h; }
  if (r.name === "t" && r.a === "points") loadPointsLog();
  if (r.name === "test" && tst && tst.started && !tst.done) startTimer();
}
function startTimer() {
  const tick = () => {
    const left = Math.max(0, Math.round((tst.endsAt - Date.now()) / 1000));
    const el = document.getElementById("timer");
    if (el) { el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`; el.classList.toggle("low", left <= 60); }
    if (left <= 0) { stopTimer(); toast("Время вышло — тест завершён"); finishTest(); }
  };
  tick(); tstTimer = setInterval(tick, 1000);
}

// ---------- события ----------
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  const href = el.getAttribute("href");
  if (!(el.tagName === "A" && href && href.startsWith("#/"))) e.preventDefault();
  if (el.disabled || el.dataset.busy) return;
  el.dataset.busy = "1";
  try { await fn(el, e); } catch (err) { console.error(err); toast(errMsg(err), "err"); }
  finally { delete el.dataset.busy; }
});
document.addEventListener("submit", async (e) => {
  const f = e.target.closest("form[data-form]"); if (!f) return;
  e.preventDefault();
  const h = FORM[f.dataset.form]; if (!h) return;
  const btn = f.querySelector("button:not([type=button])"); if (btn) btn.disabled = true;
  try { await h(f, new FormData(f)); } catch (err) { console.error(err); toast(errMsg(err), "err"); }
  finally { if (btn && btn.isConnected) btn.disabled = false; }
});
document.addEventListener("change", async (e) => {
  const el = e.target.closest("[data-change]"); if (!el) return;
  const fn = CHG[el.dataset.change]; if (!fn) return;
  try { await fn(el, e); } catch (err) { console.error(err); toast(errMsg(err), "err"); render(); }
});
window.addEventListener("hashchange", render);
window.addEventListener("lemalar-unauthorized", () => { if (!S.me) return; S.me = null; auth = { mode: "login", step: 1, code: "", info: null }; toast("Сессия истекла — войдите снова", "err"); location.hash = ""; render(); });

// ---------- запуск ----------
async function boot() {
  initClient();
  try {
    const { data } = await S.sb.auth.getSession();
    if (data.session) await afterAuth();
  } catch (e) { console.error(e); toast(errMsg(e), "err"); }
  render();
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("sw.js").catch(() => {});
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && S.me) { try { await refreshBoard(); updateChip(); } catch {} }
  });
}
boot();
