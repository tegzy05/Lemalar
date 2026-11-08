// ============================================================
//  Клиент для Google Apps Script (база = Google Таблица).
//  Те же методы, что у демо-режима: from(...).select/insert/..., rpc(...), auth.
//  Запросы, отправленные одновременно, склеиваются в один HTTP-запрос — так быстрее.
// ============================================================
function createGasClient(url) {
  const TOKEN_KEY = "lemalar_token_v2", UID_KEY = "lemalar_uid_v2";
  let token = null, uid = null;
  try { token = localStorage.getItem(TOKEN_KEY); uid = localStorage.getItem(UID_KEY); } catch {}
  let queue = [], timer = null;

  const setSession = (t, u) => { token = t; uid = u; try { t ? (localStorage.setItem(TOKEN_KEY, t), localStorage.setItem(UID_KEY, u)) : (localStorage.removeItem(TOKEN_KEY), localStorage.removeItem(UID_KEY)); } catch {} };
  const codeOf = (email) => String(email).split("@")[0];

  function send(call) {
    return new Promise((resolve) => { queue.push({ call, resolve }); if (!timer) timer = setTimeout(flush, 15); });
  }
  async function flush() {
    timer = null; const batch = queue; queue = [];
    let results;
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 60000);
    try {
      const resp = await fetch(url, { method: "POST", body: JSON.stringify({ token, calls: batch.map((b) => b.call) }), signal: ctl.signal, redirect: "follow" });
      const text = await resp.text();
      let json; try { json = JSON.parse(text); } catch { throw new Error("Сервер вернул неожиданный ответ. Проверьте развёртывание Apps Script: доступ «Все» и актуальная версия."); }
      if (!json.results || json.error) throw new Error(json.error?.message || "Ошибка сервера");
      results = json.results;
    } catch (e) {
      const msg = e.name === "AbortError" ? "Сервер не ответил вовремя, попробуйте ещё раз" : e.message || String(e);
      batch.forEach((b) => b.resolve({ data: null, error: { message: msg } })); return;
    } finally { clearTimeout(to); }
    let expired = false;
    batch.forEach((b, i) => {
      const r = results[i] || { data: null, error: { message: "Пустой ответ сервера" } };
      if (r.error && /unauthorized/.test(r.error.message)) expired = true;
      b.resolve(r);
    });
    if (expired) { setSession(null, null); window.dispatchEvent(new Event("lemalar-unauthorized")); }
  }

  class Q {
    constructor(t) { this.q = { k: "q", t, op: "select", filters: [] }; }
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
    then(res, rej) { return send(this.q).then(res, rej); }
  }

  return {
    isGas: true,
    from: (t) => new Q(t),
    rpc: (name, args = {}) => send({ k: "rpc", name, args }),
    auth: {
      async signUp({ email, password }) { const r = await send({ k: "auth", op: "signUp", code: codeOf(email), password }); if (!r.error) setSession(r.data.session.access_token, r.data.user.id); return r; },
      async signInWithPassword({ email, password }) { const r = await send({ k: "auth", op: "signIn", code: codeOf(email), password }); if (!r.error) setSession(r.data.session.access_token, r.data.user.id); return r; },
      async changePassword(oldPw, newPw) { const r = await send({ k: "rpc", name: "change_password", args: { p_old: oldPw, p_new: newPw } }); if (!r.error && r.data?.token) setSession(r.data.token, uid); return r; },
      async signOut() { setSession(null, null); return { error: null }; },
      async getSession() { return { data: { session: token ? { user: { id: uid } } : null }, error: null }; },
    },
  };
}
