// Dev-only demo data for the user-guide screenshots (open the dev server with
// "?demo"). import.meta.env.DEV is false in every build, so none of this ships.
import type { DeviceMediaItem, MediaInfo, PlaylistEntry, SearchResult } from "./native";

export const DEMO = import.meta.env.DEV && typeof location !== "undefined" && new URLSearchParams(location.search).has("demo");

export const demoInfo: MediaInfo = {
  title: "Belgesel: Dağ Keklikleri",
  uploader: "Cybergah TV",
  duration: 754,
  extractor: "youtube",
  qualities: [
    { height: 2160, size: 612_000_000 },
    { height: 1440, size: 298_000_000 },
    { height: 1080, size: 141_000_000 },
    { height: 720, size: 74_000_000 },
    { height: 480, size: 38_000_000 },
  ],
  audioSize: 12_100_000,
};

export const demoSearch: SearchResult[] = [
  { url: "https://www.youtube.com/watch?v=demo0000001", title: "Dengbêj - Lawik", uploader: "Kurdî Muzîk", duration: 274 },
  { url: "https://www.youtube.com/watch?v=demo0000002", title: "Şirin Govend", uploader: "Govend TV", duration: 316 },
  { url: "https://www.youtube.com/watch?v=demo0000003", title: "Halay 2026", uploader: "Halay", duration: 402 },
];

export const demoPlaylist: { entries: PlaylistEntry[]; title: string } = {
  title: "Kurdî Muzîk 2026",
  entries: demoSearch.map((r) => ({ url: r.url, title: r.title })),
};

export const demoMedia: (DeviceMediaItem & { src: string })[] = [
  ["Dengbêj - Lawik", "Kurdî Muzîk", 274],
  ["Şirin Govend", "Govend TV", 316],
  ["Halay 2026", "Halay", 402],
  ["Dağ Keklikleri", "Cybergah TV", 754],
  ["Stranên Zarokan", "Kurdî Muzîk", 188],
].map(([title, artist, duration], i) => ({
  title: title as string, artist: artist as string, album: "Kew", duration: duration as number,
  path: `/demo/${i}.mp3`, name: `${title}.mp3`, src: "",
}));
