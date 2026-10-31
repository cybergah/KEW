// Brand marks for the supported sites (Simple Icons, CC0) + a neutral link
// icon for everything else.
import { Link2 } from "lucide-react";
import {
  siBilibili,
  siDailymotion,
  siFacebook,
  siInstagram,
  siPinterest,
  siReddit,
  siRumble,
  siSoundcloud,
  siTiktok,
  siTwitch,
  siVimeo,
  siX,
  siYoutube,
} from "simple-icons";
import type { Platform } from "../lib/platform";

const BRAND: Record<Exclude<Platform, "unknown">, { path: string }> = {
  youtube: siYoutube,
  x: siX,
  tiktok: siTiktok,
  instagram: siInstagram,
  facebook: siFacebook,
  vimeo: siVimeo,
  dailymotion: siDailymotion,
  twitch: siTwitch,
  reddit: siReddit,
  soundcloud: siSoundcloud,
  pinterest: siPinterest,
  rumble: siRumble,
  bilibili: siBilibili,
};

export function PlatformIcon({ platform, size = 16 }: { platform: Platform; size?: number }) {
  if (platform === "unknown") return <Link2 size={size} />;
  return (
    <svg className="brand" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={BRAND[platform].path} />
    </svg>
  );
}
