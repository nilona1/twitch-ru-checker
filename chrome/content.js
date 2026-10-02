// Twitch RU Checker — content.js (Chrome + 7TV)

const cache = {};
const checked = new Set();
const REQUEST_DELAY = 1500;
let requestQueue = [];
let isProcessing = false;
let mainObserver = null;
let reapplyTimer = null;

// ─── Отримати username з елементу ────────────────────────────────────────────
function getUsernameFromEl(el) {
  // Стандартний Twitch
  if (el.hasAttribute("data-a-user")) return el.getAttribute("data-a-user");

  // 7TV — username в тексті .seventv-chat-user-username
  const stv = el.classList.contains("seventv-user-message")
    ? el
    : el.querySelector(".seventv-user-message");
  if (stv) {
    const nameEl = stv.querySelector(".seventv-chat-user-username span span");
    if (nameEl?.textContent?.trim()) return nameEl.textContent.trim().toLowerCase();
  }
  return null;
}

// ─── Знайти елемент для підсвічування ────────────────────────────────────────
function getRowEl(el) {
  // 7TV — підсвічуємо seventv-user-message
  if (el.classList.contains("seventv-user-message")) return el;
  const stv = el.closest(".seventv-user-message");
  if (stv) return stv;

  // Стандартний Twitch — підсвічуємо chat-line__message
  return el.closest(".chat-line__message") || el;
}

// ─── Перевірка через background (без CORS) ───────────────────────────────────
async function checkUser(username) {
  if (cache[username] !== undefined) return cache[username];

  try {
    const result = await chrome.runtime.sendMessage({ type: "CHECK_USER", username });
    if (!result || !result.ok) {
      cache[username] = null;
      return null;
    }
    const data = {
      bad: result.bad_count > 0,
      warning: result.warning_count > 0,
      ru_obs: result.ru_obs,
      bad_count: result.bad_count,
      warning_count: result.warning_count,
      all_count: result.all_count,
    };
    cache[username] = data;
    if (data.bad || data.ru_obs || data.warning) {
      console.log(`[RU Checker] 🚩 ${username}: bad=${data.bad_count} warn=${data.warning_count}`);
    }
    return data;
  } catch (e) {
    cache[username] = null;
    return null;
  }
}

// ─── Черга ───────────────────────────────────────────────────────────────────
function enqueue(username) {
  requestQueue.push(username);
  processQueue();
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;
  while (requestQueue.length > 0) {
    const username = requestQueue.shift();
    const result = await checkUser(username);
    if (result) applyHighlightAll(username, result);
    await new Promise(r => setTimeout(r, REQUEST_DELAY));
  }
  isProcessing = false;
}

// ─── Підсвічування ───────────────────────────────────────────────────────────
function applyHighlightAll(username, result) {
  // Стандартний Twitch
  document.querySelectorAll(`[data-a-user="${username}"]`).forEach(el => {
    const row = getRowEl(el);
    highlightEl(row, username, result);
  });

  // 7TV — шукаємо по тексту username
  document.querySelectorAll(".seventv-chat-user-username span span").forEach(nameEl => {
    if (nameEl.textContent.trim().toLowerCase() === username) {
      const row = nameEl.closest(".seventv-user-message");
      if (row) highlightEl(row, username, result);
    }
  });
}

function highlightEl(row, username, result) {
  row.classList.remove("ru-checker-bad", "ru-checker-warning");
  row.querySelectorAll(".ru-checker-badge").forEach(b => b.remove());

  if (result.bad || result.ru_obs) {
    row.classList.add("ru-checker-bad");
    const tip = `🚩 ${username}: follows ${result.all_count}, flagged ${result.bad_count}, suspicious ${result.warning_count}`;
    row.title = tip;
    addBadge(row, "flagged", "ru-checker-badge-bad", tip);
  } else if (result.warning) {
    row.classList.add("ru-checker-warning");
    const tip = `${username}: follows ${result.all_count}, suspicious ${result.warning_count}`;
    row.title = tip;
    addBadge(row, "partially flagged", "ru-checker-badge-warn", tip);
  }
}

function addBadge(el, text, cls, tip) {
  const badge = document.createElement("span");
  badge.className = `ru-checker-badge ${cls}`;
  badge.textContent = text;
  badge.title = tip;
  el.appendChild(badge);
}

// ─── Переперевірка після 7TV рендеру ─────────────────────────────────────────
function scheduleReapply() {
  if (reapplyTimer) clearTimeout(reapplyTimer);
  reapplyTimer = setTimeout(() => {
    for (const [username, result] of Object.entries(cache)) {
      if (result && (result.bad || result.ru_obs || result.warning)) {
        applyHighlightAll(username, result);
      }
    }
  }, 300);
}

// ─── Обробка нових елементів ─────────────────────────────────────────────────
function processNode(node) {
  if (node.nodeType !== 1) return;

  // Знаходимо всі повідомлення — і Twitch і 7TV
  const candidates = [];

  if (node.hasAttribute?.("data-a-user") || node.classList?.contains("seventv-user-message")) {
    candidates.push(node);
  }
  node.querySelectorAll?.("[data-a-user], .seventv-user-message").forEach(el => candidates.push(el));

  for (const el of candidates) {
    const username = getUsernameFromEl(el);
    if (!username) continue;

    if (cache[username] !== undefined) {
      if (cache[username]) {
        const row = getRowEl(el);
        highlightEl(row, username, cache[username]);
      }
    } else if (!checked.has(username)) {
      checked.add(username);
      enqueue(username);
    }
  }
}

// ─── Спостерігач ─────────────────────────────────────────────────────────────
function startGlobalObserver() {
  if (mainObserver) mainObserver.disconnect();
  mainObserver = new MutationObserver(mutations => {
    for (const m of mutations)
      for (const node of m.addedNodes)
        processNode(node);
    scheduleReapply();
  });
  mainObserver.observe(document.body, { childList: true, subtree: true });
  console.log("[RU Checker] 🟢 Спостерігач запущено");
}

// ─── Навігація (SPA) ─────────────────────────────────────────────────────────
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    checked.clear();
    requestQueue = [];
    startGlobalObserver();
  }
}).observe(document, { subtree: true, childList: true });

// ─── Старт ───────────────────────────────────────────────────────────────────
if (document.body) {
  startGlobalObserver();
} else {
  document.addEventListener("DOMContentLoaded", startGlobalObserver);
}
console.log("[RU Checker] ✅ Розширення завантажено");
