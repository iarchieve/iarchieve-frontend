import { languages, resolveLocale, localeDirection, t } from "./admin-i18n.mjs";

const $ = id => document.getElementById(id);
const browserLanguages = navigator.languages?.length
  ? navigator.languages : [navigator.language];
let locale = resolveLocale(browserLanguages);
let session = null;
let accounts = [];
let selectedPublisher = null;
let activeTab = "accounts";
let busy = false;

function tr(key) { return t(locale, key); }

function setLanguage(next) {
  locale = next;
  document.documentElement.lang = locale;
  document.documentElement.dir = localeDirection(locale);
  document.title = `iarchieve Ads · ${tr("title")}`;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = tr(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.placeholder = tr(el.dataset.i18nPlaceholder);
  });
  $("language").value = locale;
  render();
}

function message(key) {
  $("notice").textContent = tr(key);
  $("notice").hidden = false;
}

function button(label, action, disabled = false) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = tr(label);
  el.disabled = disabled || busy;
  el.addEventListener("click", action);
  return el;
}

function row(title, subtitle, state, buttons = []) {
  const root = document.createElement("article");
  root.className = "record";

  const info = document.createElement("div");
  const heading = document.createElement("div");
  heading.className = "record-title";
  heading.textContent = title;
  info.appendChild(heading);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = subtitle;
  info.appendChild(meta);

  if (state) {
    const tag = document.createElement("span");
    tag.className = "state";
    tag.textContent = tr(state);
    info.appendChild(tag);
  }

  const actions = document.createElement("div");
  actions.className = "actions";
  buttons.forEach(el => actions.appendChild(el));

  root.append(info, actions);
  return root;
}

function showTab(tab) {
  activeTab = tab;
  for (const name of ["accounts", "credentials", "audit"]) {
    $(`panel-${name}`).hidden = name !== tab;
  }
  document.querySelectorAll("[data-tab]").forEach(el => {
    if (el.dataset.tab === tab) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
  render();
  if (session && tab === "credentials" && selectedPublisher) loadCredentials();
  if (session && tab === "audit") loadAudit();
}

async function api(path, options = {}) {
  if (!session?.authenticated) throw new Error("No active admin session");

  const { method = "GET", body } = options;
  const headers = { Accept: "application/json" };

  if (method !== "GET") {
    if (!session.csrf_token) throw new Error("CSRF protection unavailable");
    headers["Content-Type"] = "application/json";
    headers["X-CSRF-Token"] = session.csrf_token;
  }

  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return await response.json();
}

async function connect() {
  $("notice").hidden = true;
  $("connection").textContent = tr("loading");

  try {
    // This endpoint must be implemented server-side before enabling management.
    // No administrator API key is sent to or stored in the browser.
    const response = await fetch("/api/ads/admin/session", {
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error"
    });

    if (!response.ok) throw new Error("Session unavailable");

    const data = await response.json();
    if (data.authenticated !== true || !data.csrf_token) {
      throw new Error("Session not authenticated");
    }

    session = { authenticated: true, csrf_token: data.csrf_token };
    await loadAccounts();
    $("connection").textContent = "";
    if (activeTab === "audit") await loadAudit();
    if (activeTab === "credentials" && selectedPublisher) await loadCredentials();
  } catch {
    session = null;
    accounts = [];
    $("connection").textContent = tr("accessRequired");
    render();
  }
}

async function loadAccounts() {
  const data = await api("/api/ads/admin/publishers");
  accounts = Array.isArray(data.items) ? data.items : [];
  render();
}

async function changeStatus(account, status) {
  if (!confirm(tr("confirm"))) return;
  busy = true;
  try {
    await api(`/api/ads/admin/publishers/${encodeURIComponent(account.id)}`, {
      method: "PATCH", body: { status }
    });
    await loadAccounts();
  } catch {
    message("failed");
  } finally {
    busy = false;
    render();
  }
}

function date(value) {
  if (!value) return "";
  const parsed = new Date(value.endsWith?.("Z") || value.includes?.("+")
    ? value : value.replace(" ", "T") + "Z");
  return Number.isNaN(parsed.getTime()) ? String(value)
    : new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(parsed);
}

function render() {
  $("connection").textContent = session ? "" : tr("accessRequired");
  const container = $("accounts");
  container.replaceChildren();

  if (!session) {
    container.appendChild(empty("accessRequired"));
    $("credentials").replaceChildren(empty("accessRequired"));
    $("audit").replaceChildren(empty("accessRequired"));
    return;
  }

  const needle = $("search").value.trim().toLocaleLowerCase();
  const filtered = accounts.filter(x =>
    `${x.name ?? ""} ${x.id ?? ""}`.toLocaleLowerCase().includes(needle)
  );

  if (!filtered.length) container.appendChild(empty("empty"));

  for (const account of filtered) {
    const actions = [];
    if (account.status === "pending") {
      actions.push(button("approve", () => changeStatus(account, "active")));
    }
    if (account.status === "active") {
      actions.push(button("suspend", () => changeStatus(account, "suspended")));
    }
    if (account.status === "suspended") {
      actions.push(button("reactivate", () => changeStatus(account, "active")));
    }
    actions.push(button("credentials", () => {
      selectedPublisher = account;
      showTab("credentials");
    }));

    container.appendChild(row(
      account.name || account.id,
      `${account.id} · ${date(account.created_at)}`,
      ["pending", "active", "suspended"].includes(account.status)
        ? account.status : null,
      actions
    ));
  }
}

function empty(key) {
  const el = document.createElement("div");
  el.className = "empty";
  el.textContent = tr(key);
  return el;
}

function revealKey(token) {
  $("one-time-key").textContent = token;
  $("key-dialog").showModal();
}

async function keyAction(type, credentialId) {
  if (!selectedPublisher || !confirm(tr("confirm"))) return;
  busy = true;

  const base = "/api/ads/publisher-credentials";
  const path = type === "issue" ? base
    : `${base}/${encodeURIComponent(credentialId)}/${type}`;

  try {
    const data = await api(path, {
      method: "POST",
      body: type === "issue" ? { publisher_id: selectedPublisher.id } : undefined
    });

    if (data.token) revealKey(data.token);
    await loadCredentials();
  } catch {
    message("failed");
  } finally {
    busy = false;
  }
}

async function loadCredentials() {
  const root = $("credentials");
  root.replaceChildren();

  if (!session || !selectedPublisher) {
    root.appendChild(empty(session ? "selectAccount" : "accessRequired"));
    return;
  }

  try {
    const data = await api(
      `/api/ads/admin/publishers/${encodeURIComponent(selectedPublisher.id)}/credentials`
    );

    const issue = button("issue", () => keyAction("issue"));
    const toolbar = document.createElement("div");
    toolbar.className = "actions";
    toolbar.appendChild(issue);
    root.appendChild(toolbar);

    if (!data.items?.length) root.appendChild(empty("noCredentials"));

    for (const item of data.items || []) {
      const actions = [];

      if (item.status === "active" && selectedPublisher.status === "active") {
        actions.push(button("rotate", () => keyAction("rotate", item.id)));
      }
      if (item.status === "active") {
        actions.push(button("revoke", () => keyAction("revoke", item.id)));
      }

      root.appendChild(row(
        item.id,
        date(item.created_at),
        item.status === "revoked" ? "revoked" : "active",
        actions
      ));
    }
    issue.disabled = selectedPublisher.status !== "active";
  } catch {
    root.replaceChildren(empty("connectionUnavailable"));
  }
}

async function loadAudit() {
  const root = $("audit");
  root.replaceChildren();

  if (!session) {
    root.appendChild(empty("accessRequired"));
    return;
  }

  try {
    const data = await api("/api/ads/audit");
    if (!data.items?.length) root.appendChild(empty("noAudit"));

    for (const item of data.items || []) {
      root.appendChild(row(
        item.action,
        `${item.target_type} · ${item.target_id} · ${date(item.created_at)}`,
        null
      ));
    }
  } catch {
    root.replaceChildren(empty("connectionUnavailable"));
  }
}

for (const [code, label] of languages) {
  const option = document.createElement("option");
  option.value = code;
  option.textContent = label;
  $("language").appendChild(option);
}

$("language").addEventListener("change", event => setLanguage(event.target.value));
$("refresh").addEventListener("click", connect);
$("search").addEventListener("input", render);
document.querySelectorAll("[data-tab]").forEach(el =>
  el.addEventListener("click", () => showTab(el.dataset.tab))
);
$("close-key").addEventListener("click", () => {
  $("key-dialog").close();
  $("one-time-key").textContent = "";
});
$("key-dialog").addEventListener("close", () => {
  $("one-time-key").textContent = "";
});
$("copy-key").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("one-time-key").textContent);
    $("copy-key").textContent = tr("copied");
  } catch {
    message("failed");
  }
});

setLanguage(locale);
connect();
