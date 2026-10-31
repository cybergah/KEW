// Kew — URL platform detection.

export type Platform =
  | "youtube"
  | "x"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "vimeo"
  | "dailymotion"
  | "twitch"
  | "reddit"
  | "soundcloud"
  | "pinterest"
  | "rumble"
  | "bilibili"
  | "unknown";

export interface Detected {
  platform: Platform;
  isPlaylist: boolean;
  url: string;
}

const PATTERNS: { p: Platform; re: RegExp }[] = [
  { p: "youtube", re: /(youtube\.com|youtu\.be|youtube-nocookie\.com)/i },
  { p: "x", re: /(twitter\.com|x\.com|t\.co)/i },
  { p: "tiktok", re: /(tiktok\.com|vm\.tiktok\.com)/i },
  { p: "instagram", re: /(instagram\.com|instagr\.am)/i },
  { p: "facebook", re: /(facebook\.com|fb\.watch|fb\.com)/i },
  { p: "vimeo", re: /vimeo\.com/i },
  { p: "dailymotion", re: /(dailymotion\.com|dai\.ly)/i },
  { p: "twitch", re: /twitch\.tv/i },
  { p: "reddit", re: /(reddit\.com|redd\.it)/i },
  { p: "soundcloud", re: /(soundcloud\.com|on\.soundcloud\.com)/i },
  { p: "pinterest", re: /(pinterest\.[a-z.]+|pin\.it)/i },
  { p: "rumble", re: /rumble\.com/i },
  { p: "bilibili", re: /(bilibili\.com|b23\.tv)/i },
];

export function detect(raw: string): Detected {
  const url = raw.trim();
  let platform: Platform = "unknown";
  for (const { p, re } of PATTERNS) {
    if (re.test(url)) {
      platform = p;
      break;
    }
  }
  // Playlist heuristics per platform (yt-dlp enumerates the rest itself).
  const isPlaylist =
    (platform === "youtube" && /[?&]list=/.test(url)) ||
    (platform === "soundcloud" && /\/sets\//.test(url)) ||
    (platform === "vimeo" && /\/(showcase|channels|album)\//.test(url)) ||
    (platform === "dailymotion" && /\/playlist\//.test(url));
  return { platform, isPlaylist, url };
}

export function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Display name + brand colour (the logo itself is components/PlatformIcon.tsx).
export const PLATFORM_META: Record<Platform, { name: string; color: string }> = {
  youtube: { name: "YouTube", color: "#ff0033" },
  x: { name: "X", color: "#2a2a2c" },
  tiktok: { name: "TikTok", color: "#161823" },
  instagram: { name: "Instagram", color: "#e1306c" },
  facebook: { name: "Facebook", color: "#1877f2" },
  vimeo: { name: "Vimeo", color: "#1ab7ea" },
  dailymotion: { name: "Dailymotion", color: "#0066dc" },
  twitch: { name: "Twitch", color: "#9146ff" },
  reddit: { name: "Reddit", color: "#ff4500" },
  soundcloud: { name: "SoundCloud", color: "#ff5500" },
  pinterest: { name: "Pinterest", color: "#e60023" },
  rumble: { name: "Rumble", color: "#85c742" },
  bilibili: { name: "Bilibili", color: "#00a1d6" },
  unknown: { name: "Link", color: "#7a8a7f" },
};
