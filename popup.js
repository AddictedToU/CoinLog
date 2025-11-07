// popup.js - CoinLog
// Auth Addict 

// Detect API: prefers `browser` (Firefox) but falls back to `chrome` if available.
const browserAPI = (typeof browser !== "undefined") ? browser :
                   (typeof chrome !== "undefined") ? chrome : null;

// Promise-based wrapper for storage (works in both Chrome and Firefox)
const storage = {
  async get(key) {
    if (browserAPI?.storage?.local?.get) {
      const result = await browserAPI.storage.local.get(key);
      return result[key];
    } else {
      // fallback to localStorage
      return JSON.parse(localStorage.getItem(key) || "null");
    }
  },
  async set(obj) {
    if (browserAPI?.storage?.local?.set) {
      await browserAPI.storage.local.set(obj);
    } else {
      Object.keys(obj).forEach(k =>
        localStorage.setItem(k, JSON.stringify(obj[k]))
      );
    }
  }
};

const DEFAULTS = { expenses: [] };

document.addEventListener("DOMContentLoaded", init);

async function init() {
  setDateTodayDefault();
  bindUI();
  await renderAll();
}

function setDateTodayDefault() {
  const dateInput = document.getElementById("date");
  const today = new Date().toISOString().slice(0, 10);
  dateInput.value = today;
}

function bindUI() {
  document.getElementById("add-form").addEventListener("submit", onAdd);
  document.getElementById("filter-category").addEventListener("change", renderAll);
  document.getElementById("export-btn").addEventListener("click", exportCSV);
}

async function getStore() {
  const expenses = (await storage.get("expenses")) || [];
  return { expenses };
}

async function setStore(obj) {
  await storage.set(obj);
}

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

async function onAdd(e) {
  e.preventDefault();
  const amountEl = document.getElementById("amount");
  const categoryEl = document.getElementById("category");
  const descEl = document.getElementById("desc");
  const dateEl = document.getElementById("date");

  const amount = parseFloat(amountEl.value);
  if (isNaN(amount) || amount <= 0) {
    alert("Please enter a valid amount greater than 0.");
    return;
  }

  const item = {
    id: makeId(),
    amount: Math.round(amount * 100) / 100,
    category: categoryEl.value || "Uncategorized",
    description: descEl.value || "",
    date: dateEl.value || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString()
  };

  const store = await getStore();
  const expenses = store.expenses || [];
  expenses.unshift(item);
  await setStore({ expenses });

  amountEl.value = "";
  descEl.value = "";
  setDateTodayDefault();
  await renderAll();
}

function formatCurrency(x) {
  return "£" + Number(x).toFixed(2);
}

async function renderAll() {
  const store = await getStore();
  const expenses = store.expenses || [];
  const filter = document.getElementById("filter-category").value;

  const filtered =
    filter && filter !== "All"
      ? expenses.filter(e => e.category === filter)
      : expenses;

  renderList(filtered);
  renderTotals(expenses);
}

function renderList(items) {
  const ul = document.getElementById("expense-list");
  ul.innerHTML = "";

  if (!items || items.length === 0) {
    document.getElementById("empty").style.display = "block";
    return;
  }
  document.getElementById("empty").style.display = "none";

  items.slice(0, 50).forEach(item => {
    const li = document.createElement("li");

    const left = document.createElement("div");
    left.className = "item-left";

    const top = document.createElement("div");
    top.className = "item-top";

    const cat = document.createElement("div");
    cat.className = "cat";
    cat.textContent = item.category;

    const am = document.createElement("div");
    am.className = "amount";
    am.textContent = formatCurrency(item.amount);

    top.appendChild(cat);
    top.appendChild(am);

    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = item.description || "";

    const date = document.createElement("div");
    date.className = "date";
    date.textContent = readableDate(item.date);

    left.appendChild(top);
    if (item.description) left.appendChild(desc);
    left.appendChild(date);

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.textContent = "✕";
    del.title = "Delete";
    del.addEventListener("click", () => onDelete(item.id));

    li.appendChild(left);
    li.appendChild(del);
    ul.appendChild(li);
  });
}

function readableDate(isoYMD) {
  try {
    const d = new Date(isoYMD + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return isoYMD;
  }
}

async function onDelete(id) {
  if (!confirm("Delete this expense?")) return;
  const store = await getStore();
  const expenses = (store.expenses || []).filter(x => x.id !== id);
  await setStore({ expenses });
  await renderAll();
}

function sum(arr) {
  return arr.reduce((s, x) => s + Number(x.amount || 0), 0);
}

async function renderTotals(allExpenses) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const today = allExpenses.filter(e => e.date === todayISO);
  const todayTotal = sum(today);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekISO = weekAgo.toISOString().slice(0, 10);
  const last7 = allExpenses.filter(e => e.date >= weekISO && e.date <= todayISO);
  const weekTotal = sum(last7);

  document.getElementById("today-total").textContent = formatCurrency(todayTotal);
  document.getElementById("week-total").textContent = formatCurrency(weekTotal);
}

async function exportCSV() {
  const store = await getStore();
  const expenses = store.expenses || [];
  if (!expenses.length) {
    alert("No expenses to export.");
    return;
  }

  const headers = ["id", "amount", "category", "description", "date", "createdAt"];
  const rows = expenses.map(e =>
    [
      e.id,
      e.amount,
      `"${(e.category || "").replace(/"/g, '""')}"`,
      `"${(e.description || "").replace(/"/g, '""')}"`,
      e.date,
      e.createdAt
    ].join(",")
  );

  const csv = [headers.join(",")].concat(rows).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `coinlog-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
