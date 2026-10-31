// Kew Companion — reports the video page you are watching to the local Kew
// desktop app (http://127.0.0.1:48155). Nothing is sent anywhere else.
// Cybergah Group · cybergah.com · GPL-3.0

const PORT = 48155;
const COOLDOWN_MS = 10 * 60 * 1000; // don't re-report the same URL for 10 min

// host → does this path look like an actual video page (not a home/feed page)?
const RULES = [
  { re: /(^|\.)youtube\.com$/, path: /^\/(watch|shorts\/)/ },
  { re: /(^|\.)youtu\.be$/, path: /^\/./ },
  { re: /(^|\.)(twitter|x)\.com$/, path: /\/status\/\d+/ },
  { re: /(^|\.)tiktok\.com$/, path: /\/(video|photo)\/|^\/@[^/]+\/video/ },
  { re: /(^|\.)instagram\.com$/, path: /^\/(reel|p|tv)\// },
  { re: /(^|\.)facebook\.com$/, path: /\/(watch|reel|videos)\b/ },
  { re: /(^|\.)fb\.watch$/, path: /^\/./ },
  { re: /(^|\.)vimeo\.com$/, path: /^\/\d+/ },
  { re: /(^|\.)dailymotion\.com$/, path: /^\/video\// },
  { re: /(^|\.)dai\.ly$/, path: /^\/./ },
  { re: /(^|\.)twitch\.tv$/, path: /^\/(videos\/\d+|[^/]+\/clip\/)/ },
  { re: /(^|\.)reddit\.com$/, path: /\/comments\// },
  { re: /(^|\.)soundcloud\.com$/, path: /^\/[^/]+\/[^/]+/ },
  { re: /(^|\.)pinterest\.[a-z.]+$/, path: /^\/pin\// },
  { re: /(^|\.)rumble\.com$/, path: /^\/v/ },
  { re: /(^|\.)bilibili\.com$/, path: /^\/video\// },
];

const seen = new Map(); // url -> last report timestamp

function isVideoPage(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    return RULES.some((r) => r.re.test(host) && r.path.test(u.pathname));
  } catch {
    return false;
  }
}

function report(url, title, force) {
  if (!force) {
    const now = Date.now();
    if (now - (seen.get(url) || 0) < COOLDOWN_MS) return;
    if (seen.size > 500) seen.clear();
    seen.set(url, now);
  }
  fetch(`http://127.0.0.1:${PORT}/video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, title: title || "", force: !!force }),
  }).catch(() => {}); // Kew not running — silently ignore
}

function check(tab) {
  if (tab && tab.url && isVideoPage(tab.url)) report(tab.url, tab.title);
}

// page loads & SPA navigations (YouTube changes URL without reloading)
chrome.tabs.onUpdated.addListener((_id, info, tab) => {
  if (info.status === "complete" || info.url || info.title) check(tab);
});

// switching to a tab that already has a video open
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try { check(await chrome.tabs.get(tabId)); } catch {}
});

// Right-click "Download with Kew" — works on EVERY site (page, link or media).
// Kew will try the URL; if the site isn't supported it shows a clear error.
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.contextMenus.create({
      id: "kew-download",
      title: "🦃 Kew ile indir / Download with Kew",
      contexts: ["page", "link", "video", "audio"],
    });
  } catch {}
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.linkUrl || info.srcUrl || info.pageUrl || (tab && tab.url) || "";
  if (/^https?:\/\//.test(url)) report(url, (tab && tab.title) || "", true);
});
