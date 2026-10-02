// background.js (Chrome) — Service Worker

self.addEventListener("activate", () => self.clients.claim());

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "CHECK_USER") return false;

  fetch(`https://artemiano.top/api/twitch/${encodeURIComponent(msg.username)}`)
    .then(res => res.text())
    .then(text => {
      const allMatch = text.match(/[Мм]ає[:\s]+(\d+)/);
      const warnMatch = text.match(/[Зз]радників[:\s]+(\d+)/);
      const badMatch = text.match(/болотномовних[:\s]+(\d+)/);

      const all_count = allMatch ? parseInt(allMatch[1]) : 0;
      const warning_count = warnMatch ? parseInt(warnMatch[1]) : 0;
      const bad_count = badMatch ? parseInt(badMatch[1]) : 0;

      console.log(`[RU Checker BG] ${msg.username}: фоловів=${all_count} зрадників=${warning_count} болотномовних=${bad_count}`);

      sendResponse({ ok: true, all_count, bad_count, warning_count, ru_obs: bad_count > 0 });
    })
    .catch(e => sendResponse({ ok: false, error: e.message }));

  return true; // тримає канал відкритим для async відповіді
});
