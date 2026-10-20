const APP_VERSION = "1.0.3";
const STORAGE_KEY = "business-ledger-state";
const DEMO_FLAG_KEY = "business-ledger-demo";
const DEFAULT_COLORS = ["#1f5fbf", "#14B8A6", "#bd8728", "#16766a", "#d65b4a", "#7c3aed", "#db2777", "#0891b2"];

const localIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => localIso(new Date());
const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;

function slugify(name) {
  const base = String(name || "business").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "business";
  return `${base}-${Math.random().toString(16).slice(2, 6)}`;
}

function moneyFormatter(currency) {
  try { return new Intl.NumberFormat("en-ZA", { style: "currency", currency: currency || "ZAR" }); }
  catch { return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }); }
}

let money = moneyFormatter("ZAR");

const expenseCategories = [
  "Accounting fees", "Advertising and marketing", "Bank charges", "Courier and delivery",
  "Digital platform fees", "Domain and hosting", "Ingredients and stock", "Insurance",
  "Legal and professional fees", "Packaging", "Printing and production", "Software and subscriptions",
  "Stationery and office", "Supplier costs", "Travel", "Other general expenses"
];

const incomeCategories = [
  "Sales income", "Service income", "Product sales", "Consulting income",
  "Subscription income", "Custom project income", "Other income"
];

const viewLabels = {
  dashboard: "Dashboard",
  transactions: "Money In / Out",
  invoices: "Invoices",
  todos: "Checklists",
  reports: "Reports",
  settings: "Settings",
  quotes: "Quotes",
  projects: "Projects",
  orders: "Orders",
  suppliers: "Suppliers",
  assets: "Listings"
};

const booksViews = ["dashboard", "transactions", "invoices", "todos", "reports", "settings"];
const toolViews = ["quotes", "projects", "orders", "suppliers", "assets"];
const todoCadences = ["daily", "weekly", "monthly"];
const todoCadenceLabels = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

const periodLabels = {
  "this-month": "This month",
  "last-month": "Last month",
  "tax-year": "This tax year",
  all: "All time"
};

function emptySeed() {
  return {
    transactions: [], quotes: [], invoices: [], projects: [], orders: [],
    suppliers: [], todos: [], assets: [],
    settings: {
      setupComplete: false,
      workspaceName: "My Workspace",
      currency: "ZAR",
      vatRegistered: false,
      showListings: false,
      period: "this-month",
      lastAssetReview: "",
      lastBackupAt: "",
      businesses: {}
    }
  };
}

function refreshMoney() { money = moneyFormatter(state.settings?.currency || "ZAR"); }
function getBusinessList() { return Object.values(state.settings?.businesses || {}).filter(Boolean); }
function isSetupComplete() { return Boolean(state.settings?.setupComplete) && getBusinessList().length > 0; }

function normalizeTodo(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    id: raw.id || uid("todo"),
    text: String(raw.text || "").trim(),
    cadence: todoCadences.includes(raw.cadence) ? raw.cadence : "daily",
    businessId: raw.businessId || "all",
    completedPeriod: raw.completedPeriod || "",
    createdAt: raw.createdAt || today(),
    sort: Number(raw.sort || 0)
  };
}
function normalizeTodos(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeTodo).filter((t) => t && t.text);
}

const STORAGE_BACKUP_KEY = "business-ledger-state-bak";

function migrateState(parsed) {
  const base = emptySeed();
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Backup root must be an object");
  }
  const merged = {
    ...base,
    ...parsed,
    todos: normalizeTodos(parsed.todos),
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
    invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    orders: Array.isArray(parsed.orders) ? parsed.orders : [],
    suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : [],
    assets: Array.isArray(parsed.assets) ? parsed.assets : [],
    settings: { ...base.settings, ...(parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {}) }
  };
  if (!merged.settings.businesses || typeof merged.settings.businesses !== "object" || Array.isArray(merged.settings.businesses)) {
    merged.settings.businesses = {};
  }
  if (typeof merged.settings.showListings !== "boolean") merged.settings.showListings = false;
  if (typeof merged.settings.vatRegistered !== "boolean") merged.settings.vatRegistered = Boolean(merged.settings.vatRegistered);
  if (typeof merged.settings.setupComplete !== "boolean") merged.settings.setupComplete = Boolean(merged.settings.setupComplete);

  // Strip legacy personal marketing seeds if present
  if (Array.isArray(merged.todos)) {
    merged.todos = merged.todos.filter((t) => !(t && String(t.seedId || "").startsWith("pdw-mkt-")));
  }
  // Strip legacy personal catalog assets
  if (Array.isArray(merged.assets)) {
    merged.assets = merged.assets.filter((a) => !(a && String(a.id || "").startsWith("asset-nsr-")));
  }
  if (merged.settings.setupComplete == null) {
    merged.settings.setupComplete = Object.keys(merged.settings.businesses).length > 0
      && !Object.keys(merged.settings.businesses).some((k) => k.startsWith("power-designs") || k === "sunday-bakery" || k === "nervous-system-reset" || k === "custom-notebook-project");
    const keys = Object.keys(merged.settings.businesses);
    const legacy = new Set(["power-designs-web","power-designs-apps","sunday-bakery","nervous-system-reset","custom-notebook-project"]);
    if (keys.length && keys.every((k) => legacy.has(k))) {
      if (!(merged.transactions || []).length && !(merged.invoices || []).length) {
        merged.settings.businesses = {};
        merged.settings.setupComplete = false;
        merged.todos = [];
        merged.assets = [];
      } else {
        merged.settings.setupComplete = true;
      }
    }
  }
  return merged;
}

function loadState() {
  const tryParse = (raw, label) => {
    if (!raw) return null;
    try {
      return migrateState(JSON.parse(raw));
    } catch (err) {
      console.warn("Business Ledger: could not load " + label, err);
      return null;
    }
  };

  const primary = tryParse(localStorage.getItem(STORAGE_KEY), "primary state");
  if (primary) return { state: primary, recovered: false };

  const backup = tryParse(localStorage.getItem(STORAGE_BACKUP_KEY), "backup state");
  if (backup) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(backup)); } catch { /* ignore */ }
    return { state: backup, recovered: true };
  }

  return { state: emptySeed(), recovered: false };
}

function validateBackupPayload(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "This file is not a Business Ledger backup (expected a JSON object).";
  }
  if (!parsed.settings || typeof parsed.settings !== "object") {
    return "Backup is missing a settings object. Export a fresh backup from Business Ledger.";
  }
  const listKeys = ["transactions", "quotes", "invoices", "projects", "orders", "suppliers", "todos", "assets"];
  for (const key of listKeys) {
    if (parsed[key] != null && !Array.isArray(parsed[key])) {
      return `Backup field "${key}" must be a list.`;
    }
  }
  if (parsed.settings.businesses != null && (typeof parsed.settings.businesses !== "object" || Array.isArray(parsed.settings.businesses))) {
    return "Backup settings.businesses must be an object map.";
  }
  return null;
}

function parseMoneyAmount(value) {
  if (value == null || value === "") return { ok: false, message: "Enter an amount." };
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return { ok: false, message: "Amount must be a valid number." };
  if (n < 0) return { ok: false, message: "Amount cannot be negative." };
  if (n > 999999999.99) return { ok: false, message: "Amount is too large." };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

function isValidIsoDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function notifyUser(message, isError = true) {
  if (isError) {
    console.warn(message);
    alert(message);
    return;
  }
  console.info(message);
  let toast = document.querySelector("#appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "app-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(notifyUser._timer);
  notifyUser._timer = setTimeout(() => { toast.hidden = true; }, 4500);
}

const _loaded = loadState();
let state = _loaded.state;
const recoveredCorruptNotice = Boolean(_loaded.recovered);
let currentView = "dashboard";
let businessFilter = "all";
let periodFilter = state.settings?.period || "this-month";
let transactionTypeFilter = "all";
let transactionSearch = "";
let editingTransactionId = null;
let editingAttachment = null;
let wizardBusinessDraft = [];
refreshMoney();

function saveState() {
  state.settings.period = periodFilter;
  const payload = JSON.stringify(state);
  try {
    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous) {
      try { localStorage.setItem(STORAGE_BACKUP_KEY, previous); } catch { /* ignore secondary backup failure */ }
    }
    localStorage.setItem(STORAGE_KEY, payload);
  } catch (err) {
    const quota = err && (err.name === "QuotaExceededError" || err.code === 22 || err.code === 1014);
    if (quota) {
      notifyUser("Could not save: this browser is out of storage space. Export a backup, then remove large receipt attachments or clear unused site data.");
    } else {
      notifyUser("Could not save your books to this browser. Export a backup now so you do not lose work.");
    }
    throw err;
  }
}

function businessName(id) {
  return state.settings.businesses[id]?.name || id;
}

function businessLogo(id) {
  return state.settings.businesses[id]?.logo || "";
}

function businessColor(id) {
  return state.settings.businesses[id]?.color || "#68717a";
}

function businessInitials(id) {
  const name = businessName(id) || "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function businessLogoHtml(id) {
  const logo = businessLogo(id);
  const name = businessName(id);
  if (logo) return `<span class="business-logo"><img src="${escapeAttr(logo)}" alt="${escapeAttr(name)} logo"></span>`;
  return `<span class="business-logo business-logo-fallback" style="--biz-color:${escapeAttr(businessColor(id))}" aria-hidden="true">${escapeHtml(businessInitials(id))}</span>`;
}

function defaultIncomeCategory(businessId) {
  return state.settings.businesses[businessId]?.defaultIncome || "Other income";
}

function filteredBusinessIds() {
  return businessFilter === "all" ? getBusinessList().map(b => b.id) : [businessFilter];
}

function filteredRecords(records) {
  const ids = filteredBusinessIds();
  return records.filter(record => ids.includes(record.businessId));
}

function allowedViews() {
  const tools = toolViews.filter((view) => view !== "assets" || Boolean(state.settings?.showListings));
  return [...booksViews, ...tools];
}

function vatLabel() {
  return state.settings?.vatRegistered ? "VAT registered" : "No VAT";
}

function taxYearFor(dateString) {
  const d = new Date(dateString + "T00:00:00");
  const year = d.getFullYear();
  return d.getMonth() >= 2 ? year + 1 : year;
}

function currentTaxYear() {
  return taxYearFor(today());
}

function periodRange(period = periodFilter) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (period === "all") return { from: null, to: null };

  if (period === "this-month") {
    const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { from, to };
  }

  if (period === "last-month") {
    const d = new Date(y, m - 1, 1);
    const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { from, to };
  }

  if (period === "tax-year") {
    const ty = currentTaxYear();
    return {
      from: `${ty - 1}-03-01`,
      to: `${ty}-02-${isLeapYear(ty) ? "29" : "28"}`
    };
  }

  return { from: null, to: null };
}

function inPeriod(dateString, period = periodFilter) {
  if (!dateString) return false;
  const { from, to } = periodRange(period);
  if (!from && !to) return true;
  if (from && dateString < from) return false;
  if (to && dateString > to) return false;
  return true;
}

function periodRecords(records, period = periodFilter) {
  return filteredRecords(records).filter(r => inPeriod(r.date, period));
}

function renderNav() {
  const allowed = allowedViews();
  const books = booksViews.filter(v => allowed.includes(v));
  const tools = toolViews.filter(v => allowed.includes(v));

  const section = (label, views) => {
    if (!views.length) return "";
    return `<div class="nav-section"><span class="nav-label">${label}</span>${views.map(view =>
      `<button class="${currentView === view ? "active" : ""}" data-view-link="${view}">${viewLabels[view]}</button>`
    ).join("")}</div>`;
  };

  document.querySelector("#sideNav").innerHTML = section("Books", books) + section("Business tools", tools);
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("tab-unavailable", !allowed.includes(view.id)));
  document.querySelectorAll(".brand[data-view-link]").forEach(link => link.classList.toggle("active", currentView === link.dataset.viewLink));
  const brandSmall = document.querySelector(".brand small");
  if (brandSmall) brandSmall.textContent = state.settings.workspaceName || "Business books";
  const vatNote = document.querySelector("#sidebarVatNote");
  if (vatNote) {
    vatNote.innerHTML = state.settings.vatRegistered
      ? `<strong>VAT registered</strong><span>Confirm VAT with your practitioner. Export backups regularly.</span>`
      : `<strong>No VAT added</strong><span>Default for non-VAT setups. Change in Settings. Export backups regularly.</span>`;
  }
}

function parseItems(text, fallbackPackage) {
  const lines = (text || "").split("\n").map(line => line.trim()).filter(Boolean);
  if (!lines.length && fallbackPackage) {
    const amount = Number((fallbackPackage.match(/R([\d,]+)/) || [])[1]?.replace(",", "") || 0);
    return [{ description: fallbackPackage.replace(/\s-\sR.*/, ""), amount }];
  }
  return lines.map(line => {
    const [description, amount] = line.split("|").map(part => part.trim());
    return { description: description || "Line item", amount: Number((amount || "0").replace(/[^\d.]/g, "")) || 0 };
  });
}

function totalItems(items) {
  return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

async function fileToData(file) {
  if (!file) return null;
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result, size: file.size });
    reader.readAsDataURL(file);
  });
}

function fillBusinessSelects() {
  const list = getBusinessList();
  const options = list.map(b => `<option value="${b.id}">${escapeHtml(businessName(b.id))}</option>`).join("");
  document.querySelectorAll('select[name="businessId"]').forEach(select => {
    if (select.closest("#todoForm")) return;
    const current = select.value;
    select.innerHTML = options || `<option value="">Add a business in Settings</option>`;
    select.value = list.some(b => b.id === current) ? current : (select.options[0]?.value || "");
  });
  const filter = document.querySelector("#businessFilter");
  filter.innerHTML = `<option value="all">All businesses</option>${options}`;
  if (!(businessFilter === "all" || list.some(b => b.id === businessFilter))) businessFilter = "all";
  filter.value = businessFilter;
  fillTodoBusinessSelect();
}

function fillTodoBusinessSelect() {
  const select = document.querySelector("#todoBusiness") || document.querySelector('#todoForm [name="businessId"]');
  if (!select) return;
  const current = select.value;
  const list = getBusinessList();
  const options = list.map(b => `<option value="${b.id}">${escapeHtml(businessName(b.id))}</option>`).join("");
  select.innerHTML = `<option value="all">All / general</option>${options}`;
  const valid = current === "all" || list.some(b => b.id === current);
  select.value = valid && current ? current : "all";
}

function todoBusinessColor(businessId) {
  if (!businessId || businessId === "all") return "#68717a";
  return businessColor(businessId);
}

function todoBusinessLabel(businessId) {
  if (!businessId || businessId === "all") return "All / general";
  return businessName(businessId);
}

function todoMatchesBusinessFilter(todo) {
  if (businessFilter === "all") return true;
  const id = todo.businessId || "all";
  return id === businessFilter || id === "all";
}

function fillCategorySelect(preferred) {
  const type = document.querySelector('#transactionForm [name="type"]').value;
  const categories = type === "income" ? incomeCategories : expenseCategories;
  const select = document.querySelector('#transactionForm [name="category"]');
  select.innerHTML = categories.map(c => `<option>${c}</option>`).join("");
  if (preferred && categories.includes(preferred)) select.value = preferred;
}

function formatDate(value) {
  return value ? new Date(value + "T00:00:00").toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "";
}

function render() {
  if (!isSetupComplete()) { showWizard(true); return; }
  showWizard(false);
  refreshMoney();
  if (!allowedViews().includes(currentView)) currentView = "dashboard";
  document.querySelector("#periodFilter").value = periodFilter;
  renderNav();
  fillBusinessSelects();
  renderDashboard();
  renderTransactions();
  renderQuotes();
  renderInvoices();
  renderProjects();
  renderOrders();
  renderSuppliers();
  renderAssets();
  renderTodos();
  renderTaxYears();
  renderReports();
  renderSettings();
  renderBackupAlert();
  document.querySelector("#viewTitle").textContent = viewLabels[currentView] || "Dashboard";
}

function sumTransactions(records, type) {
  return records.filter(t => t.type === type).reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

function unpaidInvoices() {
  return filteredRecords(state.invoices).filter(i => i.status !== "Paid" && i.status !== "Cancelled");
}

function renderDashboard() {
  const records = periodRecords(state.transactions);
  const income = sumTransactions(records, "income");
  const expenses = sumTransactions(records, "expense");
  const unpaid = unpaidInvoices();
  const unpaidAmount = unpaid.reduce((sum, inv) => sum + Number(inv.total || 0), 0);

  document.querySelector("#dashIncome").textContent = money.format(income);
  document.querySelector("#dashExpenses").textContent = money.format(expenses);
  document.querySelector("#dashProfit").textContent = money.format(income - expenses);
  document.querySelector("#dashInvoices").textContent = String(unpaid.length);
  document.querySelector("#dashUnpaidAmount").textContent = money.format(unpaidAmount);
  document.querySelector("#dashTxnCount").textContent = String(records.length);

  document.querySelector("#dashQuotesCard").hidden = false;
  document.querySelector("#dashQuotes").textContent = String(filteredRecords(state.quotes)
    .filter(q => !["Accepted", "Declined"].includes(q.status)).length);
  const welcome = document.querySelector("#dashWelcome");
  if (welcome) {
    const hasData = state.transactions.length || state.invoices.length || state.quotes.length;
    welcome.hidden = Boolean(hasData);
  }

  document.querySelector("#businessSnapshot").innerHTML = filteredBusinessIds().map(id => {
    const scoped = state.transactions.filter(t => t.businessId === id && inPeriod(t.date));
    const inc = sumTransactions(scoped, "income");
    const exp = sumTransactions(scoped, "expense");
    return `<div class="business-row">${businessLogoHtml(id)}<div><strong>${businessName(id)}</strong><span class="hint">${state.settings.businesses[id]?.type || ""} · ${periodLabels[periodFilter]}</span></div><div class="num"><strong>${money.format(inc - exp)}</strong><span class="hint">profit</span></div></div>`;
  }).join("") || empty("No businesses found.", "Check Settings", "");

  const recent = [...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  document.querySelector("#recentRecords").innerHTML = recent.map(t => recordCard(
    `${formatDate(t.date)} · ${businessName(t.businessId)}`,
    `${t.type === "income" ? "Income" : "Expense"} · ${money.format(t.amount)}`,
    `${t.category}: ${t.description}`,
    t.attachment ? ["File attached"] : []
  )).join("") || empty("No money records", "This period", "R 0");

}

function recordCard(title, subtitle, body, tags = [], actions = "") {
  return `<article class="record-card"><header><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(subtitle)}</p></div>${actions}</header>${body ? `<p>${escapeHtml(body)}</p>` : ""}<footer>${tags.map(tag => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}</footer></article>`;
}

function empty(title, meta = "", value = "") {
  return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${meta ? `<span class="meta">${escapeHtml(meta)}</span>` : ""}${value ? `<span class="value">${escapeHtml(value)}</span>` : ""}</div>`;
}

function emptyRow(colspan, title, meta = "", value = "") {
  return `<tr><td colspan="${colspan}">${empty(title, meta, value)}</td></tr>`;
}

function resetTransactionForm() {
  editingTransactionId = null;
  editingAttachment = null;
  const form = document.querySelector("#transactionForm");
  form.reset();
  form.querySelector('[name="id"]').value = "";
  document.querySelector("#transactionFormTitle").textContent = "Add Income or Expense";
  document.querySelector("#transactionSubmit").textContent = "Save record";
  document.querySelector("#cancelTransactionEdit").hidden = true;
  document.querySelector("#attachmentHint").hidden = true;
  document.querySelector("#attachmentHint").textContent = "";
  fillCategorySelect();
  form.querySelectorAll('input[type="date"]').forEach(input => { if (!input.value) input.value = today(); });
}

function startEditTransaction(id) {
  const t = state.transactions.find(item => item.id === id);
  if (!t) return;
  editingTransactionId = id;
  editingAttachment = t.attachment || null;
  const form = document.querySelector("#transactionForm");
  form.querySelector('[name="id"]').value = t.id;
  form.querySelector('[name="businessId"]').value = t.businessId;
  form.querySelector('[name="type"]').value = t.type;
  fillCategorySelect(t.category);
  form.querySelector('[name="date"]').value = t.date;
  form.querySelector('[name="amount"]').value = t.amount;
  form.querySelector('[name="category"]').value = t.category;
  form.querySelector('[name="method"]').value = t.method || "";
  form.querySelector('[name="description"]').value = t.description || "";
  form.querySelector('[name="attachment"]').value = "";
  document.querySelector("#transactionFormTitle").textContent = "Edit Income or Expense";
  document.querySelector("#transactionSubmit").textContent = "Update record";
  document.querySelector("#cancelTransactionEdit").hidden = false;
  const hint = document.querySelector("#attachmentHint");
  if (editingAttachment) {
    hint.hidden = false;
    hint.textContent = `Current file: ${editingAttachment.name}. Upload a new file only if you want to replace it.`;
  } else {
    hint.hidden = true;
    hint.textContent = "";
  }
  switchView("transactions");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderTransactions() {
  let rows = periodRecords(state.transactions).sort((a, b) => b.date.localeCompare(a.date));
  if (transactionTypeFilter !== "all") rows = rows.filter(t => t.type === transactionTypeFilter);
  const q = transactionSearch.trim().toLowerCase();
  if (q) {
    rows = rows.filter(t =>
      (t.description || "").toLowerCase().includes(q)
      || (t.category || "").toLowerCase().includes(q)
      || (t.method || "").toLowerCase().includes(q)
    );
  }

  document.querySelector("#transactionRows").innerHTML = rows.map(t => `
    <tr class="${editingTransactionId === t.id ? "editing-row" : ""}">
      <td>${formatDate(t.date)}</td>
      <td>${businessName(t.businessId)}</td>
      <td>${t.type}</td>
      <td>${escapeHtml(t.category)}</td>
      <td>${escapeHtml(t.description)}${t.attachment ? `<br><a href="${t.attachment.data}" download="${escapeHtml(t.attachment.name)}">Download file</a>` : ""}</td>
      <td class="num">${money.format(t.amount)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-edit-transaction="${t.id}" title="Edit">✎</button>
          <button class="icon-btn" data-delete="transactions" data-id="${t.id}" title="Delete">×</button>
        </div>
      </td>
    </tr>`).join("") || emptyRow(7, "No records in this period", "Money In / Out", "R 0");
}

function renderQuotes() {
  const list = filteredRecords(state.quotes).sort((a, b) => b.date.localeCompare(a.date)).map(q => {
    const actions = `<div class="quote-actions"><button class="action-btn print" data-print-quote="${q.id}" title="Print quote">Print</button><button class="action-btn invoice" data-invoice-from-quote="${q.id}" title="Create invoice from quote">Create invoice</button><button class="action-btn delete" data-delete="quotes" data-id="${q.id}" title="Delete quote">Delete</button></div>`;
    const statusControl = `<label class="inline-status">Status<select data-quote-status="${q.id}">${["Draft", "Sent", "Accepted", "Declined"].map(status => `<option value="${status}" ${q.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></label>`;
    return recordCard(`${q.number} · ${q.clientName}`, `${businessName(q.businessId)} · ${money.format(q.total)}`, q.notes || q.packageName, [formatDate(q.date)], `${statusControl}${actions}`);
  }).join("");
  document.querySelector("#quoteList").innerHTML = list || empty("No quotes yet", "Create a quote for any business", money.format(0));
}

function renderInvoices() {
  const unpaid = unpaidInvoices();
  const unpaidAmount = unpaid.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
  document.querySelector("#invoiceUnpaidSummary").textContent = `Unpaid: ${money.format(unpaidAmount)} (${unpaid.length})`;

  document.querySelector("#invoiceList").innerHTML = filteredRecords(state.invoices).sort((a, b) => b.date.localeCompare(a.date)).map(inv => {
    const paid = inv.status === "Paid";
    const actions = `<div class="row-actions">
      ${paid ? "" : `<button class="action-btn invoice" data-mark-paid="${inv.id}" title="Mark paid">Mark paid</button>`}
      <button class="icon-btn" data-print-invoice="${inv.id}" title="Print">P</button>
      <button class="icon-btn" data-delete="invoices" data-id="${inv.id}" title="Delete">×</button>
    </div>`;
    return recordCard(
      `${inv.number} · ${inv.clientName}`,
      `${businessName(inv.businessId)} · ${money.format(inv.total)}`,
      `Due ${formatDate(inv.dueDate)}. ${inv.notes || ""}`,
      [inv.status, inv.quoteId ? "From quote" : "Manual"],
      actions
    );
  }).join("") || empty("No invoices yet", "Create one manually or from an accepted quote", "R 0");
}

function renderProjects() {
  const statuses = ["Lead", "Quoted", "Accepted", "In progress", "Waiting on client", "Ready to launch", "Complete"];
  const grouped = statuses.map(status => {
    const cards = filteredRecords(state.projects).filter(p => p.status === status).map(p =>
      `<article class="record-card"><strong>${escapeHtml(p.clientName)}</strong><p>${escapeHtml(p.packageName || "Custom")} · ${money.format(p.value || 0)}</p><p>${escapeHtml(p.notes || "")}</p><footer><span class="pill">${p.nextAction ? "Next: " + formatDate(p.nextAction) : "No date"}</span><button class="icon-btn" data-delete="projects" data-id="${p.id}">×</button></footer></article>`
    ).join("");
    return `<div class="lane"><h4>${status}</h4>${cards || empty("Empty", "No projects in this column", "")}</div>`;
  }).join("");
  document.querySelector("#projectBoard").innerHTML = grouped;
}

function renderOrders() {
  document.querySelector("#orderRows").innerHTML = filteredRecords(state.orders).sort((a, b) => b.date.localeCompare(a.date)).map(o => `
    <tr><td>${formatDate(o.date)}</td><td>${businessName(o.businessId)}</td><td>${escapeHtml(o.customerName)}<br><span class="hint">${escapeHtml(o.phone || o.email || "")}</span></td><td>${escapeHtml(o.product || "")}</td><td>${o.quantity || 1}</td><td>${o.status}</td><td class="num">${money.format(o.total || 0)}</td><td><button class="icon-btn" data-delete="orders" data-id="${o.id}">×</button></td></tr>
  `).join("") || emptyRow(8, "No orders yet", "Bakery / Notebook", "R 0");
}

function renderSuppliers() {
  document.querySelector("#supplierList").innerHTML = filteredRecords(state.suppliers).map(s => {
    const actions = `<button class="icon-btn" data-delete="suppliers" data-id="${s.id}">×</button>`;
    const file = s.attachment ? ` Invoice file: ${s.attachment.name}` : "";
    return recordCard(s.name, `${businessName(s.businessId)} · ${s.service}`, `${s.notes || ""}${file}`, [s.email || "No email", money.format(s.lastQuote || 0)], actions);
  }).join("") || empty("No suppliers yet", "Add printers, courier partners, or stock suppliers", money.format(0));
}

function renderAssets() {
  const list = filteredRecords(state.assets).sort((a, b) => (b.lastUpdated || "").localeCompare(a.lastUpdated || "")).map(a => {
    const actions = `<div class="row-actions">
      ${a.url ? `<a class="ghost small" href="${escapeAttr(a.url)}" target="_blank" rel="noopener noreferrer">Open</a>` : ""}
      <button type="button" class="ghost small danger" data-delete="assets" data-id="${escapeAttr(a.id)}">Delete</button>
    </div>`;
    return recordCard(
      `${a.assetName} · ${a.platform}`,
      `${businessName(a.businessId)} · ${a.status}${a.price ? ` · ${money.format(a.price)}` : ""}`,
      a.notes || "",
      [formatDate(a.lastUpdated)].filter(Boolean),
      actions
    );
  }).join("");
  const host = document.querySelector("#assetList");
  if (host) host.innerHTML = list || empty("No listings yet", "Track digital product or marketplace listings", "");
}

/** Period key used to decide if a recurring todo is done for the current cycle. */
function todoPeriodKey(cadence, date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();

  if (cadence === "daily") {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  if (cadence === "monthly") {
    return `${y}-${String(m + 1).padStart(2, "0")}`;
  }

  // Weekly: ISO-style week starting Monday
  const day = new Date(y, m, d);
  const dayOfWeek = (day.getDay() + 6) % 7; // Mon = 0
  const monday = new Date(day);
  monday.setDate(day.getDate() - dayOfWeek);
  const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  return `week:${weekStart}`;
}

function todoPeriodHint(cadence) {
  if (cadence === "daily") return `Resets tomorrow · ${formatDate(today())}`;
  if (cadence === "monthly") {
    const now = new Date();
    const label = now.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
    return `Resets next month · ${label}`;
  }
  const key = todoPeriodKey("weekly");
  const start = key.replace("week:", "");
  const mon = new Date(start + "T00:00:00");
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return `Resets next Monday · ${formatDate(start)} – ${formatDate(localIso(sun))}`;
}

function isTodoComplete(todo) {
  return Boolean(todo.completedPeriod) && todo.completedPeriod === todoPeriodKey(todo.cadence);
}

function ensureTodosArray() {
  if (!Array.isArray(state.todos)) state.todos = [];
}

function normalizeTodo(raw) {
  if (!raw || typeof raw !== "object") return null;
  const cadence = todoCadences.includes(raw.cadence) ? raw.cadence : "daily";
  const text = String(raw.text || raw.title || "").trim();
  if (!text) return null;
  const businessId = getBusinessList().some(b => b.id === raw.businessId)
    ? raw.businessId
    : "all";
  const todo = {
    id: raw.id || uid("todo"),
    text,
    cadence,
    businessId,
    completedPeriod: typeof raw.completedPeriod === "string" ? raw.completedPeriod : "",
    createdAt: raw.createdAt || today(),
    sort: Number.isFinite(Number(raw.sort)) ? Number(raw.sort) : 0
  };
  if (raw.seedId) todo.seedId = String(raw.seedId);
  return todo;
}

function normalizeTodos(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeTodo).filter(Boolean);
}

function renderTodos() {
  ensureTodosArray();
  state.todos = normalizeTodos(state.todos);
  fillTodoBusinessSelect();
  const host = document.querySelector("#todoColumns");
  if (!host) return;

  host.innerHTML = todoCadences.map(cadence => {
    const items = state.todos
      .filter(t => t.cadence === cadence && todoMatchesBusinessFilter(t))
      .sort((a, b) => {
        const aDone = isTodoComplete(a) ? 1 : 0;
        const bDone = isTodoComplete(b) ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        const bizCmp = todoBusinessLabel(a.businessId).localeCompare(todoBusinessLabel(b.businessId));
        if (bizCmp) return bizCmp;
        return (a.sort ?? 0) - (b.sort ?? 0)
          || (a.createdAt || "").localeCompare(b.createdAt || "")
          || a.text.localeCompare(b.text);
      });
    const done = items.filter(isTodoComplete).length;
    const total = items.length;
    const list = items.map(todo => {
      const doneNow = isTodoComplete(todo);
      const color = todoBusinessColor(todo.businessId);
      const bizLabel = todoBusinessLabel(todo.businessId);
      return `
        <li class="todo-item${doneNow ? " is-done" : ""}" style="--todo-color: ${escapeAttr(color)};" data-business="${escapeAttr(todo.businessId || "all")}">
          <label class="todo-check">
            <input type="checkbox" data-todo-toggle="${escapeAttr(todo.id)}" ${doneNow ? "checked" : ""} aria-label="${escapeAttr(todo.text)}">
            <span class="todo-text-block">
              <span class="todo-task-text">${escapeHtml(todo.text)}</span>
              <span class="todo-biz-tag" title="${escapeAttr(bizLabel)}">${escapeHtml(bizLabel)}</span>
            </span>
          </label>
          <button type="button" class="icon-btn" data-delete="todos" data-id="${escapeAttr(todo.id)}" title="Remove task" aria-label="Remove task">×</button>
        </li>`;
    }).join("") || `<li class="todo-empty empty-state"><strong>No ${todoCadenceLabels[cadence].toLowerCase()} tasks</strong><span class="meta">Add one above</span></li>`;

    return `
      <section class="panel todo-column" data-cadence="${cadence}">
        <div class="panel-head">
          <div>
            <h3>${todoCadenceLabels[cadence]}</h3>
            <span class="hint">${todoPeriodHint(cadence)}</span>
          </div>
          <span class="pill todo-progress">${done}/${total} done</span>
        </div>
        <ul class="todo-list">${list}</ul>
      </section>`;
  }).join("");

  const summary = document.querySelector("#todoSummary");
  if (summary) {
    const counts = todoCadences.map(cadence => {
      const items = state.todos.filter(t => t.cadence === cadence && todoMatchesBusinessFilter(t));
      const done = items.filter(isTodoComplete).length;
      return `${todoCadenceLabels[cadence]} ${done}/${items.length}`;
    });
    summary.textContent = counts.join(" · ");
  }
}

function toggleTodo(id) {
  ensureTodosArray();
  const todo = state.todos.find(t => t.id === id);
  if (!todo) return;
  const key = todoPeriodKey(todo.cadence);
  todo.completedPeriod = isTodoComplete(todo) ? "" : key;
  saveState();
  renderTodos();
}

function addTodo(text, cadence, businessId = "all") {
  ensureTodosArray();
  const clean = String(text || "").trim();
  if (!clean || !todoCadences.includes(cadence)) return false;
  const biz = getBusinessList().some(b => b.id === businessId) ? businessId : "all";
  const sameCadence = state.todos.filter(t => t.cadence === cadence);
  state.todos.push({
    id: uid("todo"),
    text: clean,
    cadence,
    businessId: biz,
    completedPeriod: "",
    createdAt: today(),
    sort: sameCadence.length
  });
  saveState();
  renderTodos();
  return true;
}

function renderTaxYears() {
  const select = document.querySelector("#taxYear");
  const years = new Set([currentTaxYear()]);
  state.transactions.forEach(t => years.add(taxYearFor(t.date)));
  const current = select.value;
  select.innerHTML = [...years].sort((a, b) => b - a).map(y =>
    `<option value="${y}">${y} year (${y - 1}-03-01 to ${y}-02-${isLeapYear(y) ? "29" : "28"})</option>`
  ).join("");
  if (current && [...years].map(String).includes(current)) select.value = current;
}

function renderReports() {
  const periodTxns = periodRecords(state.transactions);
  const income = sumTransactions(periodTxns, "income");
  const expenses = sumTransactions(periodTxns, "expense");

  document.querySelector("#reportIncome").textContent = money.format(income);
  document.querySelector("#reportExpenses").textContent = money.format(expenses);
  document.querySelector("#reportProfit").textContent = money.format(income - expenses);
  document.querySelector("#reportFiles").textContent = periodTxns.filter(t => t.attachment).length;
  document.querySelector("#reportPeriodLabel").textContent = periodLabels[periodFilter] || periodFilter;

  document.querySelector("#reportBusinessRows").innerHTML = filteredBusinessIds().map(id => {
    const businessRecords = state.transactions.filter(t => t.businessId === id && inPeriod(t.date));
    const inc = sumTransactions(businessRecords, "income");
    const exp = sumTransactions(businessRecords, "expense");
    return `<tr><td>${businessName(id)}</td><td class="num">${money.format(inc)}</td><td class="num">${money.format(exp)}</td><td class="num">${money.format(inc - exp)}</td></tr>`;
  }).join("") || emptyRow(4, "No data", "Selected period", "R 0");

  const categories = {};
  periodTxns.filter(t => t.type === "expense").forEach(t => {
    categories[t.category] = (categories[t.category] || 0) + Number(t.amount || 0);
  });
  document.querySelector("#reportCategoryRows").innerHTML = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amount]) => `<tr><td>${escapeHtml(cat)}</td><td class="num">${money.format(amount)}</td></tr>`)
    .join("") || emptyRow(2, "No expenses in this period", "Selected period", "R 0");

  // Tax-year helper section
  const year = Number(document.querySelector("#taxYear").value || currentTaxYear());
  const taxRecords = filteredRecords(state.transactions).filter(t => taxYearFor(t.date) === year);
  const taxIncome = sumTransactions(taxRecords, "income");
  const taxExpenses = sumTransactions(taxRecords, "expense");
  document.querySelector("#taxIncome").textContent = money.format(taxIncome);
  document.querySelector("#taxExpenses").textContent = money.format(taxExpenses);
  document.querySelector("#taxProfit").textContent = money.format(taxIncome - taxExpenses);
  document.querySelector("#taxFiles").textContent = taxRecords.filter(t => t.attachment).length;
  document.querySelector("#taxBusinessRows").innerHTML = filteredBusinessIds().map(id => {
    const businessRecords = taxRecords.filter(t => t.businessId === id);
    const inc = sumTransactions(businessRecords, "income");
    const exp = sumTransactions(businessRecords, "expense");
    return `<tr><td>${businessName(id)}</td><td class="num">${money.format(inc)}</td><td class="num">${money.format(exp)}</td><td class="num">${money.format(inc - exp)}</td></tr>`;
  }).join("");
}

function renderSettings() {
  const list = getBusinessList();
  const ws = document.querySelector("#workspaceNameInput");
  const cur = document.querySelector("#currencySelect");
  const vat = document.querySelector("#vatRegisteredSelect");
  const listings = document.querySelector("#showListingsSelect");
  const ver = document.querySelector("#settingsVersion");
  if (ws) ws.value = state.settings.workspaceName || "";
  if (cur) cur.value = state.settings.currency || "ZAR";
  if (vat) vat.value = state.settings.vatRegistered ? "yes" : "no";
  if (listings) listings.value = state.settings.showListings ? "yes" : "no";
  if (ver) ver.textContent = `Version ${APP_VERSION}`;
  const host = document.querySelector("#businessSettings");
  if (!host) return;
  host.innerHTML = list.map(b => {
    const current = state.settings.businesses[b.id] || b;
    return `<div class="settings-card">
      <h4>${businessLogoHtml(b.id)}${escapeHtml(current.name)}</h4>
      <div class="form-cluster cluster-2">
        <label>Name<input data-setting="${escapeAttr(b.id)}" data-field="name" value="${escapeAttr(current.name)}"></label>
        <label>Type<input data-setting="${escapeAttr(b.id)}" data-field="type" value="${escapeAttr(current.type || "")}"></label>
      </div>
      <div class="form-cluster cluster-2">
        <label>Default income category<input data-setting="${escapeAttr(b.id)}" data-field="defaultIncome" value="${escapeAttr(current.defaultIncome || "Other income")}"></label>
        <label>SARS grouping<input data-setting="${escapeAttr(b.id)}" data-field="trade" value="${escapeAttr(current.trade || "Local business/trade income")}"></label>
      </div>
      <div class="form-cluster cluster-2">
        <label>Colour<input data-setting="${escapeAttr(b.id)}" data-field="color" type="color" value="${escapeAttr(current.color || "#1f5fbf")}"></label>
        <label>Logo (optional)<input data-setting="${escapeAttr(b.id)}" data-field="logo" value="${escapeAttr(current.logo || "")}" placeholder="Leave blank for initials"></label>
      </div>
      <button type="button" class="ghost small danger" data-remove-business="${escapeAttr(b.id)}">Remove business</button>
    </div>`;
  }).join("") || empty("No businesses yet", "Add your first business below", "");
}

function isMonthEndReviewDue() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isLastDay = tomorrow.getDate() === 1;
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return isLastDay && state.settings.lastAssetReview !== monthKey;
}

function renderMonthAlert() {
  const el = document.querySelector("#monthAlert");
  if (!el) return;
  const show = Boolean(state.settings?.showListings) && isMonthEndReviewDue();
  el.hidden = !show;
}

function renderBackupAlert() {
  const alert = document.querySelector("#backupAlert");
  if (!alert) return;
  const last = state.settings.lastBackupAt || "";
  const days = last ? daysSince(last) : 999;
  alert.hidden = !(!last || days >= 14);
  const detail = document.querySelector("#backupAlertDetail");
  if (detail) {
    detail.textContent = last
      ? `Last backup: ${formatDate(last)} (${days} day${days === 1 ? "" : "s"} ago). Export a fresh JSON copy.`
      : "You have not exported a backup yet. Use Export backup in the top bar.";
  }
}

function daysSince(dateString) {
  return Math.floor((Date.now() - new Date(dateString + "T00:00:00").getTime()) / 86400000);
}

function isLeapYear(year) {
  return new Date(year, 1, 29).getDate() === 29;
}

function csv(rows) {
  return rows.map(row => row.map(cell => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
}

function downloadText(filename, text, type = "text/plain") {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportTransactions() {
  const rows = [["Date", "Business", "Type", "Category", "Description", "Amount", "Method", "Has file"]];
  periodRecords(state.transactions).forEach(t => rows.push([t.date, businessName(t.businessId), t.type, t.category, t.description, t.amount, t.method, t.attachment ? "Yes" : "No"]));
  downloadText("business-ledger-transactions.csv", csv(rows), "text/csv");
}

function exportOrders() {
  const rows = [["Date", "Business", "Customer", "Phone", "Email", "Product", "Quantity", "Status", "Total", "Notes"]];
  filteredRecords(state.orders).forEach(o => rows.push([o.date, businessName(o.businessId), o.customerName, o.phone, o.email, o.product, o.quantity, o.status, o.total, o.notes]));
  downloadText("business-ledger-orders.csv", csv(rows), "text/csv");
}

function exportTaxCsv() {
  const year = Number(document.querySelector("#taxYear").value);
  const rows = [["Tax year", "Date", "Business", "Type", "Category", "Description", "Amount", "Has supporting file"]];
  filteredRecords(state.transactions).filter(t => taxYearFor(t.date) === year).forEach(t => rows.push([year, t.date, businessName(t.businessId), t.type, t.category, t.description, t.amount, t.attachment ? "Yes" : "No"]));
  downloadText(`tax-overview-${year}.csv`, csv(rows), "text/csv");
}

function printDocument(record, label) {
  const itemRows = (record.items || []).map(item => `<tr><td>${escapeHtml(item.description)}</td><td class="num">${money.format(item.amount)}</td></tr>`).join("");
  const business = businessName(record.businessId);
  const html = `<!doctype html><html><head><title>${label} ${record.number}</title><style>body{font-family:Arial,sans-serif;margin:0;color:#182028}.doc{max-width:820px;margin:0 auto;padding:48px}header{display:flex;justify-content:space-between;border-bottom:3px solid #1f5fbf;padding-bottom:18px}h1{margin:36px 0 10px;font-size:42px}.muted{color:#68717a}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:28px 0}table{width:100%;border-collapse:collapse;margin-top:28px}td,th{padding:12px;border-bottom:1px solid #dce3ea;text-align:left}.num{text-align:right}.total{font-size:24px;font-weight:800}.note{margin-top:30px;color:#68717a;line-height:1.5}@media print{button{display:none}}</style></head><body><main class="doc"><header><div><strong>${escapeHtml(business)}</strong><div class="muted">Business Ledger · ${escapeHtml(vatLabel())}</div></div><div><strong>${escapeHtml(vatLabel())}</strong></div></header><h1>${label}</h1><p class="muted">${escapeHtml(record.number)}</p><div class="grid"><div><strong>Client</strong><p>${escapeHtml(record.clientName)}<br>${escapeHtml(record.clientEmail || "")}</p></div><div><strong>Date</strong><p>${formatDate(record.date)}${record.dueDate ? `<br>Due ${formatDate(record.dueDate)}` : ""}</p></div></div><table><thead><tr><th>Description</th><th class="num">Amount</th></tr></thead><tbody>${itemRows}<tr><td class="total">Total</td><td class="num total">${money.format(record.total)}</td></tr></tbody></table><p class="note">${escapeHtml(record.notes || "Payment terms confirmed in writing. " + (state.settings.vatRegistered ? "Payment terms confirmed in writing." : "No VAT is charged because this business is not currently VAT registered.") + "")}</p><button onclick="print()">Print or save PDF</button></main></body></html>`;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

function switchView(view) {
  if (!allowedViews().includes(view)) view = "dashboard";
  currentView = view;
  document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.id === view));
  document.querySelectorAll("[data-view-link]").forEach(el => el.classList.toggle("active", el.dataset.viewLink === view));
  document.querySelector("#viewTitle").textContent = viewLabels[view] || "Dashboard";
  renderNav();
  scrollTo({ top: 0, behavior: "smooth" });
}

function collectForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function createInvoiceFromQuote(id) {
  const quote = state.quotes.find(q => q.id === id);
  if (!quote) return;
  const due = new Date();
  due.setDate(due.getDate() + 7);
  const invoice = {
    id: uid("inv"),
    quoteId: quote.id,
    number: `INV-${String(state.invoices.length + 1).padStart(4, "0")}`,
    businessId: quote.businessId,
    clientName: quote.clientName,
    clientEmail: quote.clientEmail,
    date: today(),
    dueDate: localIso(due),
    items: quote.items,
    total: quote.total,
    status: "Unpaid",
    notes: quote.notes,
    incomePosted: false
  };
  state.invoices.push(invoice);
  quote.status = "Accepted";
  saveState();
  render();
  switchView("invoices");
}

function markInvoicePaid(id) {
  const invoice = state.invoices.find(i => i.id === id);
  if (!invoice) return;
  if (invoice.status === "Paid" || invoice.incomePosted) {
    alert("This invoice is already marked paid. Income was not posted again.");
    return;
  }
  invoice.status = "Paid";
  invoice.incomePosted = true;
  state.transactions.push({
    id: uid("txn"),
    businessId: invoice.businessId,
    type: "income",
    date: today(),
    amount: invoice.total,
    category: defaultIncomeCategory(invoice.businessId),
    method: "Invoice",
    description: `${invoice.number} paid by ${invoice.clientName}`,
    attachment: null,
    invoiceId: invoice.id
  });
  saveState();
  render();
}

document.addEventListener("click", event => {
  const viewLink = event.target.closest("[data-view-link]");
  if (viewLink) switchView(viewLink.dataset.viewLink);

  const del = event.target.closest("[data-delete]");
  if (del && confirm("Delete this record?")) {
    const collection = del.dataset.delete;
    if (!Array.isArray(state[collection])) state[collection] = [];
    state[collection] = state[collection].filter(item => item.id !== del.dataset.id);
    if (collection === "transactions" && editingTransactionId === del.dataset.id) resetTransactionForm();
    saveState();
    render();
  }

  const editTxn = event.target.closest("[data-edit-transaction]");
  if (editTxn) startEditTransaction(editTxn.dataset.editTransaction);

  const quoteBtn = event.target.closest("[data-print-quote]");
  if (quoteBtn) printDocument(state.quotes.find(q => q.id === quoteBtn.dataset.printQuote), "Quote");

  const invoiceBtn = event.target.closest("[data-print-invoice]");
  if (invoiceBtn) printDocument(state.invoices.find(i => i.id === invoiceBtn.dataset.printInvoice), "Invoice");

  const fromQuote = event.target.closest("[data-invoice-from-quote]");
  if (fromQuote) createInvoiceFromQuote(fromQuote.dataset.invoiceFromQuote);

  const paid = event.target.closest("[data-mark-paid]");
  if (paid) markInvoicePaid(paid.dataset.markPaid);

  const removeBiz = event.target.closest("[data-remove-business]");
  if (removeBiz) removeBusiness(removeBiz.dataset.removeBusiness);

  const wizardRemove = event.target.closest("[data-wizard-remove]");
  if (wizardRemove) {
    wizardBusinessDraft.splice(Number(wizardRemove.dataset.wizardRemove), 1);
    renderWizardBusinesses();
  }
});

document.addEventListener("change", event => {
  const todoToggle = event.target.closest("[data-todo-toggle]");
  if (todoToggle) {
    toggleTodo(todoToggle.dataset.todoToggle);
    return;
  }

  const quoteStatus = event.target.closest("[data-quote-status]");
  if (!quoteStatus) return;
  const quote = state.quotes.find(q => q.id === quoteStatus.dataset.quoteStatus);
  if (!quote) return;
  quote.status = quoteStatus.value;
  saveState();
  render();
});

document.querySelector("#businessFilter").addEventListener("change", event => {
  businessFilter = event.target.value;
  if (!allowedViews().includes(currentView)) currentView = "dashboard";
  render();
  switchView(currentView);
});

document.querySelector("#periodFilter").addEventListener("change", event => {
  periodFilter = event.target.value;
  saveState();
  render();
});

document.querySelector("#transactionTypeFilter").addEventListener("change", event => {
  transactionTypeFilter = event.target.value;
  renderTransactions();
});

document.querySelector("#transactionSearch").addEventListener("input", event => {
  transactionSearch = event.target.value;
  renderTransactions();
});

document.querySelector("#cancelTransactionEdit").addEventListener("click", () => {
  resetTransactionForm();
});

document.querySelector('#transactionForm [name="type"]').addEventListener("change", () => fillCategorySelect());

document.querySelector("#transactionForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.target;
  const data = collectForm(form);
  if (!data.businessId) {
    notifyUser("Choose a business for this money record.");
    return;
  }
  if (!data.description || !String(data.description).trim()) {
    notifyUser("Add a short description so you can recognise this record later.");
    return;
  }
  if (!isValidIsoDate(data.date)) {
    notifyUser("Enter a valid date (YYYY-MM-DD).");
    return;
  }
  const amountCheck = parseMoneyAmount(data.amount);
  if (!amountCheck.ok) {
    notifyUser(amountCheck.message);
    return;
  }
  if (!data.category) {
    notifyUser("Choose a category.");
    return;
  }
  const file = form.attachment.files[0];
  const attachment = file ? await fileToData(file) : (editingTransactionId ? editingAttachment : null);
  const record = {
    id: editingTransactionId || uid("txn"),
    businessId: data.businessId,
    type: data.type === "expense" ? "expense" : "income",
    date: data.date,
    amount: amountCheck.value,
    category: data.category,
    method: data.method || "",
    description: String(data.description).trim(),
    attachment
  };

  if (editingTransactionId) {
    const idx = state.transactions.findIndex(t => t.id === editingTransactionId);
    if (idx >= 0) state.transactions[idx] = { ...state.transactions[idx], ...record };
  } else {
    state.transactions.push(record);
  }

  try {
    saveState();
  } catch {
    return;
  }
  resetTransactionForm();
  render();
});

document.querySelector("#invoiceForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = collectForm(event.target);
  const items = parseItems(data.items);
  if (!items.length || totalItems(items) <= 0) {
    alert("Add at least one line item with an amount, e.g. Website design | 3990");
    return;
  }
  const invoice = {
    id: uid("inv"),
    quoteId: null,
    number: `INV-${String(state.invoices.length + 1).padStart(4, "0")}`,
    businessId: data.businessId,
    clientName: data.clientName,
    clientEmail: data.clientEmail || "",
    date: data.date,
    dueDate: data.dueDate,
    items,
    total: totalItems(items),
    status: data.status || "Unpaid",
    notes: data.notes || "",
    incomePosted: false
  };

  if (invoice.status === "Paid") {
    invoice.incomePosted = true;
    state.transactions.push({
      id: uid("txn"),
      businessId: invoice.businessId,
      type: "income",
      date: invoice.date,
      amount: invoice.total,
      category: defaultIncomeCategory(invoice.businessId),
      method: "Invoice",
      description: `${invoice.number} paid by ${invoice.clientName}`,
      attachment: null,
      invoiceId: invoice.id
    });
  }

  state.invoices.push(invoice);
  saveState();
  event.target.reset();
  event.target.querySelectorAll('input[type="date"]').forEach(input => { input.value = today(); });
  const due = new Date();
  due.setDate(due.getDate() + 7);
  event.target.querySelector('[name="dueDate"]').value = localIso(due);
  render();
});

document.querySelector("#quoteForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = collectForm(event.target);
  const items = parseItems(data.items, data.packageName);
  state.quotes.push({
    id: uid("quote"),
    number: `Q-${String(state.quotes.length + 1).padStart(4, "0")}`,
    ...data,
    items,
    total: totalItems(items)
  });
  saveState();
  event.target.reset();
  render();
});

document.querySelector("#projectForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = collectForm(event.target);
  state.projects.push({ id: uid("proj"), ...data, value: Number(data.value || 0) });
  saveState();
  event.target.reset();
  render();
});

document.querySelector("#orderForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = collectForm(event.target);
  const order = {
    id: uid("order"),
    ...data,
    quantity: Number(data.quantity || 1),
    total: Number(data.total || 0),
    incomePosted: false
  };
  if (Number(data.total || 0) > 0 && ["Paid", "Collected", "Shipped"].includes(data.status)) {
    order.incomePosted = true;
    state.transactions.push({
      id: uid("txn"),
      businessId: data.businessId,
      type: "income",
      date: data.date,
      amount: Number(data.total),
      category: defaultIncomeCategory(data.businessId),
      method: "Order",
      description: `${data.product || "Order"} · ${data.customerName}`,
      attachment: null,
      orderId: order.id
    });
  }
  state.orders.push(order);
  saveState();
  event.target.reset();
  render();
});

document.querySelector("#supplierForm").addEventListener("submit", async event => {
  event.preventDefault();
  const data = collectForm(event.target);
  const file = event.target.attachment.files[0];
  state.suppliers.push({
    id: uid("supplier"),
    ...data,
    lastQuote: Number(data.lastQuote || 0),
    attachment: await fileToData(file)
  });
  saveState();
  event.target.reset();
  render();
});

document.querySelector("#assetForm").addEventListener("submit", event => {
  event.preventDefault();
  const data = collectForm(event.target);
  state.assets.push({ id: uid("asset"), ...data, price: Number(data.price || 0) });
  saveState();
  event.target.reset();
  render();
});

document.querySelector("#markAssetsReviewed")?.addEventListener("click", () => {
  const now = new Date();
  state.settings.lastAssetReview = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  saveState();
  render();
});

document.querySelector("#goAssets")?.addEventListener("click", () => {
  switchView("assets");
});
document.querySelector("#taxYear").addEventListener("change", renderReports);
document.querySelector("#exportTransactions").addEventListener("click", exportTransactions);
document.querySelector("#exportOrders").addEventListener("click", exportOrders);
document.querySelector("#exportTaxCsv").addEventListener("click", exportTaxCsv);
document.querySelector("#exportJson").addEventListener("click", () => {
  state.settings.lastBackupAt = today();
  saveState();
  downloadText(`business-ledger-backup-${today()}.json`, JSON.stringify(state, null, 2), "application/json");
  renderBackupAlert();
});

document.querySelector("#importJson").addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch {
        notifyUser("That file is not valid JSON. Choose a Business Ledger backup exported from this app.");
        return;
      }
      const schemaError = validateBackupPayload(parsed);
      if (schemaError) {
        notifyUser(schemaError);
        return;
      }
      state = migrateState(parsed);
      if (Object.keys(state.settings.businesses).length) state.settings.setupComplete = true;
      if (typeof state.settings.showListings !== "boolean") state.settings.showListings = false;
      periodFilter = state.settings.period || "this-month";
      businessFilter = "all";
      if (!allowedViews().includes(currentView)) currentView = "dashboard";
      refreshMoney();
      saveState();
      render();
      notifyUser("Backup imported successfully. Your books are restored in this browser.", false);
    } catch (err) {
      notifyUser("Could not import that backup file. " + (err && err.message ? err.message : "Unknown error."));
    }
  };
  reader.onerror = () => notifyUser("Could not read that file. Try exporting a fresh backup and importing again.");
  reader.readAsText(file);
  event.target.value = "";
});

document.querySelector("#todoForm")?.addEventListener("submit", event => {
  event.preventDefault();
  const form = event.target;
  const data = collectForm(form);
  if (!addTodo(data.text, data.cadence, data.businessId)) {
    alert("Enter a task and choose daily, weekly, or monthly.");
    return;
  }
  form.reset();
  form.querySelector('[name="cadence"]').value = "daily";
  fillTodoBusinessSelect();
  form.querySelector('[name="businessId"]').value = "all";
  switchView("todos");
});

document.querySelector("#clearDataBtn")?.addEventListener("click", () => {
  if (!confirm("Clear all local Business Ledger data on this browser? This cannot be undone without a backup file.")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(DEMO_FLAG_KEY);
  state = emptySeed();
  periodFilter = "this-month";
  businessFilter = "all";
  wizardBusinessDraft = [];
  resetTransactionForm();
  refreshMoney();
  render();
});

document.querySelector("#loadSampleBtn")?.addEventListener("click", () => loadSampleData());
document.querySelector("#addBusinessBtn")?.addEventListener("click", () => addBusinessFromSettings());
document.querySelector("#dismissBackupAlert")?.addEventListener("click", () => {
  const el = document.querySelector("#backupAlert");
  if (el) el.hidden = true;
});
document.querySelector("#workspaceNameInput")?.addEventListener("change", (event) => {
  state.settings.workspaceName = event.target.value.trim() || "My Workspace";
  saveState();
  renderNav();
});
document.querySelector("#currencySelect")?.addEventListener("change", (event) => {
  state.settings.currency = event.target.value || "ZAR";
  refreshMoney();
  saveState();
  render();
});
document.querySelector("#vatRegisteredSelect")?.addEventListener("change", (event) => {
  state.settings.vatRegistered = event.target.value === "yes";
  saveState();
  render();
});

document.querySelector("#showListingsSelect")?.addEventListener("change", (event) => {
  state.settings.showListings = event.target.value === "yes";
  saveState();
  if (!state.settings.showListings && currentView === "assets") currentView = "dashboard";
  render();
});
document.querySelector("#wizardAddBusiness")?.addEventListener("click", () => {
  const name = document.querySelector("#wizardBizName").value.trim();
  if (!name) { alert("Enter a business name."); return; }
  const color = document.querySelector("#wizardBizColor").value || DEFAULT_COLORS[wizardBusinessDraft.length % DEFAULT_COLORS.length];
  const type = document.querySelector("#wizardBizType").value.trim() || "Business";
  wizardBusinessDraft.push({
    id: slugify(name), name, type,
    defaultIncome: "Other income", trade: "Local business/trade income", color, logo: ""
  });
  document.querySelector("#wizardBizName").value = "";
  document.querySelector("#wizardBizType").value = "";
  renderWizardBusinesses();
});
document.querySelector("#wizardFinish")?.addEventListener("click", () => completeWizard());
document.querySelector("#wizardLoadSample")?.addEventListener("click", () => loadSampleData());

document.addEventListener("input", event => {
  const input = event.target.closest("[data-setting]");
  if (!input) return;
  const id = input.dataset.setting;
  const field = input.dataset.field;
  state.settings.businesses[id] = { ...(state.settings.businesses[id] || {}), [field]: input.value };
  saveState();
  fillBusinessSelects();
  renderDashboard();
  renderReports();
});


/* ---------- Setup wizard & sample data ---------- */
function showWizard(show) {
  const overlay = document.querySelector("#setupWizard");
  const shell = document.querySelector("#appShell");
  const dialog = overlay?.querySelector(".setup-card");
  if (!overlay) return;
  overlay.hidden = !show;
  overlay.setAttribute("aria-hidden", show ? "false" : "true");
  if (dialog) {
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", show ? "true" : "false");
  }
  if (shell) shell.setAttribute("aria-hidden", show ? "true" : "false");
  if (show) {
    renderWizardBusinesses();
    requestAnimationFrame(() => {
      const focusEl = document.querySelector("#wizardWorkspaceName") || dialog;
      focusEl?.focus?.();
    });
  }
}

function renderWizardBusinesses() {
  const host = document.querySelector("#wizardBusinessList");
  if (!host) return;
  if (!wizardBusinessDraft.length) {
    host.innerHTML = `<p class="hint">Add at least one business to continue.</p>`;
    return;
  }
  host.innerHTML = wizardBusinessDraft.map((b, idx) => `
    <div class="wizard-biz-row">
      <span class="swatch" style="background:${escapeAttr(b.color)}"></span>
      <div><strong>${escapeHtml(b.name)}</strong><span class="hint">${escapeHtml(b.type || "Business")}</span></div>
      <button type="button" class="ghost small danger" data-wizard-remove="${idx}">Remove</button>
    </div>`).join("");
}

function completeWizard() {
  const workspaceName = (document.querySelector("#wizardWorkspaceName")?.value || "").trim() || "My Workspace";
  const currency = document.querySelector("#wizardCurrency")?.value || "ZAR";
  const vatRegistered = document.querySelector("#wizardVat")?.value === "yes";
  if (!wizardBusinessDraft.length) {
    alert("Add at least one business before continuing.");
    return;
  }
  const businesses = {};
  wizardBusinessDraft.forEach((b) => { businesses[b.id] = { ...b }; });
  state.settings.workspaceName = workspaceName;
  state.settings.currency = currency;
  state.settings.vatRegistered = vatRegistered;
  state.settings.showListings = document.querySelector("#wizardShowListings")?.checked === true;
  state.settings.businesses = businesses;
  state.settings.setupComplete = true;
  saveState();
  wizardBusinessDraft = [];
  refreshMoney();
  render();
  switchView("dashboard");
}

function loadSampleData() {
  if (!confirm("Load clearable sample data? This replaces current records. Export a backup first if you have real data.")) return;
  const sampleBiz = { id: "sample-studio", name: "Sample Studio", type: "Creative services", defaultIncome: "Service income", trade: "Local business/trade income", color: "#1f5fbf", logo: "" };
  const sampleBiz2 = { id: "sample-shop", name: "Sample Shop", type: "Retail / products", defaultIncome: "Product sales", trade: "Local business/trade income", color: "#14B8A6", logo: "" };
  state.settings.businesses = { [sampleBiz.id]: sampleBiz, [sampleBiz2.id]: sampleBiz2 };
  state.settings.setupComplete = true;
  state.settings.workspaceName = state.settings.workspaceName || "Demo Workspace";
  state.settings.currency = state.settings.currency || "ZAR";
  state.transactions = [
    { id: uid("txn"), businessId: sampleBiz.id, type: "income", date: today(), amount: 4500, category: "Service income", method: "EFT", description: "Brand site deposit", attachment: null },
    { id: uid("txn"), businessId: sampleBiz.id, type: "expense", date: today(), amount: 299, category: "Software and subscriptions", method: "Card", description: "Design tools", attachment: null },
    { id: uid("txn"), businessId: sampleBiz2.id, type: "income", date: today(), amount: 850, category: "Product sales", method: "Cash", description: "Weekend market sales", attachment: null }
  ];
  state.invoices = []; state.quotes = []; state.projects = []; state.orders = []; state.suppliers = []; state.assets = [];
  state.todos = [
    { id: uid("todo"), text: "Reconcile bank for Sample Studio", cadence: "weekly", businessId: sampleBiz.id, completedPeriod: "", createdAt: today(), sort: 1 },
    { id: uid("todo"), text: "Export JSON backup", cadence: "monthly", businessId: "all", completedPeriod: "", createdAt: today(), sort: 2 }
  ];
  localStorage.setItem(DEMO_FLAG_KEY, "1");
  saveState();
  render();
  switchView("dashboard");
}

function addBusinessFromSettings() {
  const name = (document.querySelector("#newBusinessName")?.value || "").trim();
  if (!name) { alert("Enter a business name."); return; }
  const color = document.querySelector("#newBusinessColor")?.value || DEFAULT_COLORS[getBusinessList().length % DEFAULT_COLORS.length];
  const type = (document.querySelector("#newBusinessType")?.value || "").trim() || "Business";
  const id = slugify(name);
  state.settings.businesses[id] = { id, name, type, defaultIncome: "Other income", trade: "Local business/trade income", color, logo: "" };
  state.settings.setupComplete = true;
  document.querySelector("#newBusinessName").value = "";
  document.querySelector("#newBusinessType").value = "";
  saveState();
  render();
}

function removeBusiness(id) {
  if (!state.settings.businesses[id]) return;
  if (getBusinessList().length <= 1) {
    alert("Keep at least one business, or clear all data from Settings.");
    return;
  }
  if (!confirm(`Remove "${businessName(id)}"? Existing records stay until you delete them.`)) return;
  delete state.settings.businesses[id];
  if (businessFilter === id) businessFilter = "all";
  saveState();
  render();
}


// Init
fillCategorySelect();
document.querySelectorAll('input[type="date"]').forEach(input => { if (!input.value) input.value = today(); });
const invoiceDue = document.querySelector('#invoiceForm [name="dueDate"]');
if (invoiceDue && !invoiceDue.value) {
  const due = new Date();
  due.setDate(due.getDate() + 7);
  invoiceDue.value = localIso(due);
}
render();
if (recoveredCorruptNotice) {
  notifyUser("Your saved books looked damaged, so Business Ledger restored the last good backup copy in this browser. Export a fresh backup now.", false);
}
