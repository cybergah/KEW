package com.cybergah.kew;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.yausername.ffmpeg.FFmpeg;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLRequest;
import com.yausername.youtubedl_android.YoutubeDLResponse;
import com.yausername.youtubedl_android.mapper.VideoInfo;

import org.json.JSONArray;
import org.json.JSONObject;

import kotlin.Unit;
import kotlin.jvm.functions.Function3;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Kew — on-device extraction & download via yt-dlp.
 * Cybergah Group · cybergah.com
 *
 * No server, no third party, no tracking. yt-dlp runs entirely on the phone
 * (YouTube, X, TikTok, Instagram, playlists, 1000+ sites). Finished media is
 * copied into the public Downloads/Kew folder.
 */
@CapacitorPlugin(name = "KewYtdlp")
public class KewYtdlpPlugin extends Plugin {

    private static volatile KewYtdlpPlugin inst;
    /** URL handed over by MainActivity from a "Share → Kew" intent. */
    static volatile String pendingShare;

    @Override
    public void load() {
        inst = this;
    }

    /** Lock-screen / notification media buttons → the WebView player. */
    static void emitControl(String cmd, long posMs) {
        KewYtdlpPlugin p = inst;
        if (p == null) return;
        try {
            JSObject ev = new JSObject();
            ev.put("cmd", cmd);
            if (posMs >= 0) ev.put("pos", posMs);
            p.notifyListeners("mediaControl", ev);
        } catch (Throwable ignored) {
        }
    }

    private volatile boolean inited = false;
    private volatile boolean updateKicked = false;

    /** Re-check for a yt-dlp update at most this often. */
    private static final long UPDATE_INTERVAL_MS = 12L * 60 * 60 * 1000; // 12h

    private synchronized void ensureInit() throws Exception {
        if (inited) return;
        YoutubeDL.getInstance().init(getContext().getApplicationContext());
        FFmpeg.getInstance().init(getContext().getApplicationContext());
        inited = true;
        kickBackgroundUpdate();
    }

    /**
     * v1 updated yt-dlp synchronously inside ensureInit(), so the FIRST download
     * of every session stalled behind a full binary download over the network.
     * v2 updates in a background thread (downloads never wait for it) and at
     * most once every 12h.
     */
    private void kickBackgroundUpdate() {
        if (updateKicked) return;
        updateKicked = true;
        final Context app = getContext().getApplicationContext();
        android.content.SharedPreferences sp = app.getSharedPreferences("kew_ytdlp", Context.MODE_PRIVATE);
        long last = sp.getLong("last_update_check", 0);
        if (System.currentTimeMillis() - last < UPDATE_INTERVAL_MS) return;
        new Thread(() -> {
            try {
                YoutubeDL.getInstance().updateYoutubeDL(app, YoutubeDL.UpdateChannel._NIGHTLY);
            } catch (Throwable t1) {
                try {
                    YoutubeDL.getInstance().updateYoutubeDL(app, YoutubeDL.UpdateChannel._STABLE);
                } catch (Throwable ignored) {
                }
            }
            sp.edit().putLong("last_update_check", System.currentTimeMillis()).apply();
        }, "kew-ytdlp-update").start();
    }

    /**
     * Only plain http(s) links ever reach yt-dlp. Anything else (e.g. text
     * starting with "--exec") would be parsed as a yt-dlp option.
     */
    static boolean isHttpUrl(String url) {
        if (url == null) return false;
        String s = url.trim().toLowerCase(java.util.Locale.ROOT);
        if (!(s.startsWith("http://") || s.startsWith("https://"))) return false;
        try {
            Uri u = Uri.parse(url.trim());
            return u.getHost() != null && !u.getHost().isEmpty();
        } catch (Throwable t) {
            return false;
        }
    }

    @PluginMethod
    public void download(final PluginCall call) {
        final String url = call.getString("url");
        final boolean audioOnly = Boolean.TRUE.equals(call.getBoolean("audioOnly", false));
        final String quality = call.getString("quality", "1080");
        final String taskId = call.getString("taskId", "0");
        final boolean notify = Boolean.TRUE.equals(call.getBoolean("notify", true));
        final boolean sound = Boolean.TRUE.equals(call.getBoolean("sound", true));
        final String doneTitle = call.getString("title", "Kew");
        if (!isHttpUrl(url)) {
            call.reject("invalid url");
            return;
        }

        new Thread(() -> {
            try {
                emit(taskId, -1, 0, "preparing");
                ensureInit();

                File outDir = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "Kew");
                if (!outDir.exists()) outDir.mkdirs();
                final long start = System.currentTimeMillis() - 2000;

                YoutubeDLRequest req = new YoutubeDLRequest(url);
                String clip = clipSpec(call.getObject("clip"));
                req.addOption("-o", new File(outDir, clip != null
                        ? "%(title).80B [%(id)s] %(section_start)d-%(section_end)ds.%(ext)s"
                        : "%(title).80B [%(id)s].%(ext)s").getAbsolutePath());
                req.addOption("--no-mtime");
                req.addOption("--no-playlist");
                req.addOption("--continue");
                req.addOption("--restrict-filenames");
                // Fragmented streams (YouTube DASH, HLS) download much faster in
                // parallel; plain HTTP files are unaffected by this option.
                req.addOption("--concurrent-fragments", "4");
                req.addOption("--socket-timeout", "15");
                req.addOption("--retries", "5");
                req.addOption("--fragment-retries", "5");
                if (audioOnly) {
                    // m4a/opus prefer a matching source stream so ffmpeg just
                    // remuxes (no re-encode → much faster on phones); mp3
                    // always re-encodes.
                    String af = call.getString("audioFormat", "m4a");
                    if ("mp3".equals(af)) {
                        req.addOption("-x");
                        req.addOption("--audio-format", "mp3");
                        req.addOption("--audio-quality", "0");
                    } else if ("opus".equals(af)) {
                        req.addOption("-f", "ba[ext=webm]/ba/b");
                        req.addOption("-x");
                        req.addOption("--audio-format", "opus");
                    } else {
                        req.addOption("-f", "ba[ext=m4a]/ba/b");
                        req.addOption("-x");
                        req.addOption("--audio-format", "m4a");
                    }
                    // cover art (ffmpeg can embed it into mp3/m4a; opus would
                    // need mutagen, which the on-device python lacks) + tags
                    if (!"opus".equals(af)) {
                        req.addOption("--embed-thumbnail");
                        req.addOption("--convert-thumbnails", "jpg");
                    }
                    addTagOptions(req);
                } else {
                    // Never hard-exclude formats (so vertical TikTok/Shorts still
                    // download); prefer resolution + H.264 + mp4 via soft sorting.
                    req.addOption("-f", "bv*+ba/b");
                    String sort = "max".equals(quality)
                            ? "res,vcodec:h264,ext:mp4"
                            : "res:" + quality + ",vcodec:h264,ext:mp4";
                    req.addOption("-S", sort);
                    req.addOption("--merge-output-format", "mp4");
                    // Optional subtitles, embedded into the video file.
                    String subLang = call.getString("subLang");
                    if (subLang != null && !subLang.isEmpty()) {
                        req.addOption("--sub-langs", subLang + ".*");
                        req.addOption("--write-subs"); // keep the .vtt next to the video
                        req.addOption("--write-auto-subs"); // include auto-generated captions
                        req.addOption("--embed-subs"); // also mux into the mp4 (VLC & co.)
                    }
                    req.addOption("--embed-metadata");
                }
                // only the chosen part, cut on exact frames
                if (clip != null) {
                    req.addOption("--download-sections", clip);
                    req.addOption("--force-keyframes-at-cuts");
                }

                Function3<Float, Long, String, Unit> cb = (progress, etaInSeconds, line) -> {
                    emit(taskId, progress, etaInSeconds, line);
                    return Unit.INSTANCE;
                };
                YoutubeDL.getInstance().execute(req, taskId, cb);
                lastEmit.remove(taskId);

                // Collect everything produced this run and publish to Downloads/Kew.
                JSArray files = new JSArray();
                File[] produced = outDir.listFiles();
                if (produced != null) {
                    for (File file : produced) {
                        if (!file.isFile()) continue;
                        if (file.lastModified() < start) continue;
                        String name = file.getName();
                        if (name.endsWith(".part") || name.endsWith(".ytdl") || name.endsWith(".tmp")) continue;
                        String mime = mimeOf(name);
                        String publicUri = publish(file, name, mime);
                        JSObject jf = new JSObject();
                        jf.put("name", name);
                        jf.put("path", file.getAbsolutePath());
                        jf.put("uri", publicUri != null ? publicUri : Uri.fromFile(file).toString());
                        jf.put("mime", mime);
                        files.put(jf);
                    }
                }

                // Completion feedback fires here in the (foreground-service-backed)
                // download thread, so it works even when the app is in the background.
                if (files.length() > 0) {
                    if (sound) playKeklikNow();
                    if (notify) postDone(doneTitle);
                }

                JSObject ret = new JSObject();
                ret.put("files", files);
                call.resolve(ret);
            } catch (Throwable e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "yt-dlp failed");
            }
        }).start();
    }

    /** Play the keklik call on the notification stream (reliable across OEMs/DND-media). */
    private void playKeklikNow() {
        try {
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            AudioAttributes aa = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
            MediaPlayer mp = MediaPlayer.create(getContext(), R.raw.keklik, aa, am.generateAudioSessionId());
            if (mp != null) { mp.setOnCompletionListener(p -> p.release()); mp.start(); return; }
        } catch (Throwable ignored) {
        }
        try { // fallback: default stream
            MediaPlayer mp = MediaPlayer.create(getContext(), R.raw.keklik);
            if (mp != null) { mp.setOnCompletionListener(p -> p.release()); mp.start(); }
        } catch (Throwable ignored) {
        }
    }

    /** Post a silent "download complete" banner (sound is played separately for reliability). */
    private void postDone(String title) {
        try {
            Context ctx = getContext();
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            String ch = "kew_done_v2";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(ch) == null) {
                NotificationChannel c = new NotificationChannel(ch, "Kew · complete", NotificationManager.IMPORTANCE_DEFAULT);
                c.setDescription("Cybergah Group");
                c.setSound(null, null); // sound handled by MediaPlayer
                nm.createNotificationChannel(c);
            }
            NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, ch)
                    .setSmallIcon(R.drawable.ic_stat_kew)
                    .setContentTitle("Kew ✓")
                    .setContentText(title)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT);
            nm.notify((int) (System.currentTimeMillis() % 100000), b.build());
        } catch (Throwable ignored) {
        }
    }

    /** Enumerate a playlist's entries (or return a single entry for a normal link). Fast — no download. */
    @PluginMethod
    public void playlist(final PluginCall call) {
        final String url = call.getString("url");
        if (!isHttpUrl(url)) {
            call.reject("invalid url");
            return;
        }
        new Thread(() -> {
            try {
                ensureInit();
                YoutubeDLRequest req = new YoutubeDLRequest(url);
                req.addOption("--flat-playlist");
                req.addOption("-J");
                req.addOption("--no-warnings");
                YoutubeDLResponse resp = YoutubeDL.getInstance().execute(req);

                JSArray entries = new JSArray();
                JSONObject root = new JSONObject(resp.getOut());
                if (root.has("entries")) {
                    JSONArray arr = root.getJSONArray("entries");
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject e = arr.optJSONObject(i);
                        if (e == null) continue;
                        entries.put(entryToJs(e, "youtube".equals(root.optString("extractor_key", "").toLowerCase())));
                    }
                } else {
                    entries.put(entryToJs(root, false));
                }
                JSObject ret = new JSObject();
                ret.put("entries", entries);
                if (root.has("entries")) ret.put("title", root.optString("title", null));
                call.resolve(ret);
            } catch (Throwable e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "playlist failed");
            }
        }).start();
    }

    /** Free-text query → "ytsearchN:query" / "scsearchN:query" (SoundCloud),
     *  control chars stripped and length capped, or null. */
    static String searchTarget(String raw, int n, String source) {
        if (raw == null) return null;
        String q = raw.replaceAll("[\\p{Cntrl}]+", " ").replaceAll("\\s+", " ").trim();
        if (q.isEmpty()) return null;
        if (q.length() > 200) q = q.substring(0, 200);
        int count = Math.min(Math.max(n, 1), 30);
        return ("sc".equals(source) ? "scsearch" : "ytsearch") + count + ":" + q;
    }

    /** Search YouTube by name (flat — titles/ids only, no per-video extraction). */
    @PluginMethod
    public void search(final PluginCall call) {
        final String source = call.getString("source", "yt");
        final String target = searchTarget(call.getString("query"), call.getInt("limit", 12), source);
        if (target == null) {
            call.reject("empty query");
            return;
        }
        new Thread(() -> {
            try {
                ensureInit();
                YoutubeDLRequest req = new YoutubeDLRequest(target);
                req.addOption("--flat-playlist");
                req.addOption("-J");
                req.addOption("--no-warnings");
                YoutubeDLResponse resp = YoutubeDL.getInstance().execute(req);
                JSONArray arr = new JSONObject(resp.getOut()).optJSONArray("entries");
                JSArray results = new JSArray();
                for (int i = 0; arr != null && i < arr.length(); i++) {
                    JSONObject e = arr.optJSONObject(i);
                    if (e == null || e.optString("id", "").isEmpty()) continue;
                    String id = e.optString("id");
                    String eurl = e.optString("url", "");
                    JSObject it = new JSObject();
                    it.put("url", eurl.startsWith("http") ? eurl : "https://www.youtube.com/watch?v=" + id);
                    it.put("title", e.optString("title", id));
                    if ("sc".equals(source)) {
                        JSONArray ths = e.optJSONArray("thumbnails");
                        String thumb = null;
                        for (int k = 0; ths != null && k < ths.length(); k++) {
                            JSONObject th = ths.optJSONObject(k);
                            if (th == null) continue;
                            thumb = th.optString("url", thumb);
                            if ("t300x300".equals(th.optString("id"))) break;
                        }
                        if (thumb != null) it.put("thumbnail", thumb);
                    } else {
                        it.put("thumbnail", "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg");
                    }
                    if (e.has("duration") && !e.isNull("duration")) it.put("duration", Math.round(e.optDouble("duration", 0)));
                    String up = e.optString("channel", e.optString("uploader", ""));
                    if (!up.isEmpty()) it.put("uploader", up);
                    results.put(it);
                }
                JSObject ret = new JSObject();
                ret.put("results", results);
                call.resolve(ret);
            } catch (Throwable e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "search failed");
            }
        }).start();
    }

    private JSObject entryToJs(JSONObject e, boolean youtubeHint) {
        JSObject it = new JSObject();
        String id = e.optString("id", "");
        // Prefer the page URL. For a single fully-extracted video the top-level
        // "url" is a signed/expiring CDN link (re-downloading it hits the generic
        // extractor → 403). "webpage_url" is the real page the extractor handles.
        String eurl = e.optString("webpage_url", "");
        if (eurl.isEmpty()) eurl = e.optString("url", "");
        if (!eurl.startsWith("http") && !id.isEmpty()) {
            String key = e.optString("ie_key", "").toLowerCase();
            if (youtubeHint || key.contains("youtube")) eurl = "https://www.youtube.com/watch?v=" + id;
            else eurl = id;
        }
        it.put("url", eurl);
        it.put("title", e.optString("title", eurl));
        it.put("thumbnail", bestThumb(e, id));
        return it;
    }

    private String bestThumb(JSONObject e, String id) {
        String t = e.optString("thumbnail", "");
        if (!t.isEmpty()) return t;
        JSONArray ths = e.optJSONArray("thumbnails");
        if (ths != null && ths.length() > 0) {
            JSONObject last = ths.optJSONObject(ths.length() - 1);
            if (last != null) {
                String u = last.optString("url", "");
                if (!u.isEmpty()) return u;
            }
        }
        if (id != null && !id.isEmpty() && id.length() == 11) {
            return "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";
        }
        return null;
    }

    @PluginMethod
    public void info(final PluginCall call) {
        final String url = call.getString("url");
        if (!isHttpUrl(url)) {
            call.reject("invalid url");
            return;
        }
        new Thread(() -> {
            try {
                ensureInit();
                YoutubeDLRequest req = new YoutubeDLRequest(url);
                req.addOption("--no-playlist");
                req.addOption("--no-warnings");
                req.addOption("-J");
                JSONObject j = new JSONObject(YoutubeDL.getInstance().execute(req).getOut());
                JSObject ret = new JSObject();
                String title = j.optString("title", "");
                ret.put("title", title.isEmpty() ? j.optString("fulltitle", "") : title);
                ret.put("thumbnail", j.optString("thumbnail", null));
                if (j.has("duration") && !j.isNull("duration")) ret.put("duration", Math.round(j.optDouble("duration", 0)));
                ret.put("uploader", j.optString("uploader", null));
                ret.put("extractor", j.optString("extractor", null));
                putQualities(j, ret);
                call.resolve(ret);
            } catch (Throwable e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "info failed");
            }
        }).start();
    }

    /** Real video qualities: one entry per height with the size of the stream
     *  Kew would pick (H.264 preferred, like the download's -S sort) plus the
     *  best audio track. Mirrors qualitiesOf() in the desktop security.cjs. */
    static void putQualities(JSONObject info, JSObject ret) {
        JSONArray fmts = info.optJSONArray("formats");
        double dur = info.optDouble("duration", 0);
        long audioSize = 0;
        boolean audioM4a = false;
        double audioBr = -1;
        java.util.TreeMap<Integer, long[]> byHeight = new java.util.TreeMap<>(java.util.Collections.reverseOrder());
        for (int i = 0; fmts != null && i < fmts.length(); i++) {
            JSONObject f = fmts.optJSONObject(i);
            if (f == null) continue;
            String v = f.optString("vcodec", "none"), a = f.optString("acodec", "none");
            long size = f.optLong("filesize", 0);
            if (size <= 0) size = f.optLong("filesize_approx", 0);
            if (size <= 0 && f.optDouble("tbr", 0) > 0 && dur > 0) size = Math.round(f.optDouble("tbr", 0) * 125 * dur);
            if ("none".equals(v) && !"none".equals(a)) {
                boolean m4a = a.startsWith("mp4a");
                double br = f.optDouble("abr", f.optDouble("tbr", 0));
                if ((m4a && !audioM4a) || (m4a == audioM4a && br > audioBr)) {
                    audioM4a = m4a; audioBr = br; audioSize = size;
                }
                continue;
            }
            int h = f.optInt("height", 0);
            if (h <= 0 || "none".equals(v)) continue;
            long h264 = (v.startsWith("avc1") || v.startsWith("h264")) ? 1 : 0;
            long muxed = "none".equals(a) ? 0 : 1;
            long[] cur = byHeight.get(h);
            if (cur == null || (h264 > cur[0]) || (h264 == cur[0] && size > cur[1])) byHeight.put(h, new long[] { h264, size, muxed });
        }
        JSArray list = new JSArray();
        for (java.util.Map.Entry<Integer, long[]> e : byHeight.entrySet()) {
            long[] v = e.getValue();
            JSObject q = new JSObject();
            q.put("height", e.getKey());
            q.put("size", v[1] > 0 ? v[1] + (v[2] == 1 ? 0 : audioSize) : 0);
            list.put(q);
        }
        ret.put("qualities", list);
        ret.put("audioSize", audioSize);
    }

    /** "90", "1:30", "01:02:03", "75.5" → seconds, or -1 when invalid. */
    static double parseTime(String raw) {
        if (raw == null) return -1;
        String s = raw.trim();
        if (!s.matches("\\d{1,3}(:\\d{1,2}){0,2}(\\.\\d+)?")) return -1;
        String[] parts = s.split(":");
        double acc = 0;
        for (int i = 0; i < parts.length; i++) {
            double p = Double.parseDouble(parts[i]);
            if (i > 0 && p >= 60) return -1;
            acc = acc * 60 + p;
        }
        return acc;
    }

    /** A clip {start, end} → "*S-E" for --download-sections, or null. */
    static String clipSpec(JSObject clip) {
        if (clip == null) return null;
        double a = parseTime(clip.getString("start")), b = parseTime(clip.getString("end"));
        if (a < 0 || b < 0 || b <= a) return null;
        return "*" + fmtNum(a) + "-" + fmtNum(b);
    }

    private static String fmtNum(double d) {
        return d == Math.floor(d) ? String.valueOf((long) d) : String.valueOf(d);
    }

    /** Tags for music apps: artist from the uploader, overridden by an
     *  "Artist - Title" video title; "(Official Video)"-style suffixes dropped. */
    private static void addTagOptions(YoutubeDLRequest req) {
        req.addOption("--embed-metadata");
        req.addOption("--parse-metadata", "%(artist,creator,uploader,channel)s:%(meta_artist)s");
        req.addOption("--parse-metadata", "title:%(meta_artist)s - %(meta_title)s");
        req.addCommands(java.util.Arrays.asList("--replace-in-metadata", "meta_title,title",
                "(?i)\\s*[\\(\\[][^\\)\\]]*(official|lyric|audio|video|visuali[sz]er|hd|hq|4k)[^\\)\\]]*[\\)\\]]", ""));
    }

    @PluginMethod
    public void listMedia(final PluginCall call) {
        final String type = call.getString("type", "video");
        Context ctx = getContext();
        String needed = Build.VERSION.SDK_INT >= 33
                ? ("video".equals(type) ? "android.permission.READ_MEDIA_VIDEO" : "android.permission.READ_MEDIA_AUDIO")
                : android.Manifest.permission.READ_EXTERNAL_STORAGE;
        if (androidx.core.content.ContextCompat.checkSelfPermission(ctx, needed)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            try {
                String[] req = Build.VERSION.SDK_INT >= 33
                        ? new String[]{"android.permission.READ_MEDIA_VIDEO", "android.permission.READ_MEDIA_AUDIO"}
                        : new String[]{android.Manifest.permission.READ_EXTERNAL_STORAGE};
                androidx.core.app.ActivityCompat.requestPermissions(getActivity(), req, 9911);
            } catch (Throwable ignored) {
            }
            call.reject("no-permission");
            return;
        }
        new Thread(() -> {
            try {
                boolean video = "video".equals(type);
                Uri uri = video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
                String[] proj = video
                        ? new String[]{MediaStore.MediaColumns.TITLE, MediaStore.MediaColumns.DISPLAY_NAME,
                                MediaStore.MediaColumns.DATA, MediaStore.MediaColumns.DURATION}
                        : new String[]{MediaStore.MediaColumns.TITLE, MediaStore.MediaColumns.DISPLAY_NAME,
                                MediaStore.MediaColumns.DATA, MediaStore.MediaColumns.DURATION,
                                MediaStore.Audio.Media.ARTIST, MediaStore.Audio.Media.ALBUM};
                String sel = video ? null : MediaStore.Audio.Media.IS_MUSIC + " != 0";
                android.database.Cursor c = getContext().getContentResolver()
                        .query(uri, proj, sel, null, MediaStore.MediaColumns.DATE_ADDED + " DESC");
                JSArray items = new JSArray();
                if (c != null) {
                    int n = 0;
                    while (c.moveToNext() && n < 1500) {
                        String title = c.getString(0);
                        String name = c.getString(1);
                        String path = c.getString(2);
                        long durMs = c.getLong(3);
                        if (path == null || path.isEmpty()) continue;
                        JSObject it = new JSObject();
                        it.put("title", title != null && !title.isEmpty() ? title : name);
                        it.put("name", name);
                        it.put("path", path);
                        it.put("duration", Math.round(durMs / 1000.0));
                        if (!video) {
                            String artist = c.getString(4);
                            if (artist != null && !"<unknown>".equals(artist)) it.put("artist", artist);
                            String album = c.getString(5);
                            if (album != null && !"<unknown>".equals(album)) it.put("album", album);
                        }
                        items.put(it);
                        n++;
                    }
                    c.close();
                }
                JSObject ret = new JSObject();
                ret.put("items", items);
                call.resolve(ret);
            } catch (Throwable e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "media query failed");
            }
        }).start();
    }

    /** Cached video frame preview for the library list. */
    @PluginMethod
    public void videoThumb(final PluginCall call) {
        final String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("missing path");
            return;
        }
        new Thread(() -> {
            try {
                File dir = new File(getContext().getCacheDir(), "thumbs");
                if (!dir.exists()) dir.mkdirs();
                File srcFile = new File(path);
                File out = new File(dir, Integer.toHexString(path.hashCode()) + "_" + srcFile.length() + ".jpg");
                if (!out.exists()) {
                    android.graphics.Bitmap bmp;
                    if (Build.VERSION.SDK_INT >= 29) {
                        bmp = android.media.ThumbnailUtils.createVideoThumbnail(
                                srcFile, new android.util.Size(360, 202), null);
                    } else {
                        bmp = android.media.ThumbnailUtils.createVideoThumbnail(
                                path, MediaStore.Images.Thumbnails.MINI_KIND);
                    }
                    if (bmp == null) {
                        call.reject("no thumb");
                        return;
                    }
                    try (java.io.FileOutputStream fo = new java.io.FileOutputStream(out)) {
                        bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 72, fo);
                    }
                    bmp.recycle();
                }
                JSObject ret = new JSObject();
                ret.put("thumb", out.getAbsolutePath());
                call.resolve(ret);
            } catch (Throwable e) {
                call.reject("thumb failed");
            }
        }).start();
    }

    /** Start/stop/update the media session (background + lock-screen controls). */
    @PluginMethod
    public void mediaSession(PluginCall call) {
        boolean active = Boolean.TRUE.equals(call.getBoolean("active", false));
        try {
            Intent it = new Intent(getContext(), KewMediaService.class);
            if (active) {
                it.putExtra("title", call.getString("title", "Kew"));
                it.putExtra("playing", Boolean.TRUE.equals(call.getBoolean("playing", true)));
                Double pos = call.getDouble("position");
                if (pos != null) it.putExtra("position", pos.longValue());
                Double dur = call.getDouble("duration");
                if (dur != null) it.putExtra("duration", dur.longValue());
                Double rate = call.getDouble("rate");
                if (rate != null) it.putExtra("rate", rate.floatValue());
                androidx.core.content.ContextCompat.startForegroundService(getContext(), it);
            } else {
                getContext().stopService(it);
            }
        } catch (Throwable ignored) {
        }
        call.resolve();
    }

    /** Return and clear a URL shared into Kew ("Share → Kew"). */
    @PluginMethod
    public void consumeShare(PluginCall call) {
        JSObject ret = new JSObject();
        String u = pendingShare;
        pendingShare = null;
        if (u != null) ret.put("url", u);
        call.resolve(ret);
    }

    /** Open the public Downloads/Kew folder in the system file manager. */
    @PluginMethod
    public void openDownloadsFolder(PluginCall call) {
        Context ctx = getContext();
        try {
            Intent it = new Intent(Intent.ACTION_VIEW);
            Uri uri = Uri.parse("content://com.android.externalstorage.documents/document/primary%3ADownload%2FKew");
            it.setDataAndType(uri, "vnd.android.document/directory");
            it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(it);
            call.resolve();
            return;
        } catch (Throwable ignored) {
        }
        try { // fallback: the system Downloads screen
            Intent it = new Intent(android.app.DownloadManager.ACTION_VIEW_DOWNLOADS);
            it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(it);
        } catch (Throwable ignored) {
        }
        call.resolve();
    }

    /**
     * Read the clipboard natively. The WebView's navigator.clipboard.readText()
     * is unavailable/blocked on most Android versions, so the paste button
     * goes through here instead.
     */
    @PluginMethod
    public void readClipboard(final PluginCall call) {
        // Clipboard access must happen on the main thread while the app is
        // focused (Android 10+ restriction) — fine here: it's a button tap.
        getBridge().executeOnMainThread(() -> {
            try {
                android.content.ClipboardManager cm =
                        (android.content.ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
                String text = "";
                if (cm != null && cm.hasPrimaryClip() && cm.getPrimaryClip() != null
                        && cm.getPrimaryClip().getItemCount() > 0) {
                    CharSequence cs = cm.getPrimaryClip().getItemAt(0).coerceToText(getContext());
                    if (cs != null) text = cs.toString();
                }
                JSObject ret = new JSObject();
                ret.put("text", text);
                call.resolve(ret);
            } catch (Throwable e) {
                call.reject("clipboard failed");
            }
        });
    }

    /** Play the keklik call (intro / on demand). */
    @PluginMethod
    public void playKeklik(PluginCall call) {
        playKeklikNow();
        call.resolve();
    }

    /** Post a "download complete" notification, optionally with the keklik call. */
    @PluginMethod
    public void notifyDone(PluginCall call) {
        String title = call.getString("title", "Completed");
        boolean sound = Boolean.TRUE.equals(call.getBoolean("sound", true));
        try {
            Context ctx = getContext();
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            String ch = sound ? "kew_done" : "kew_done_silent";
            Uri snd = Uri.parse("android.resource://" + ctx.getPackageName() + "/raw/keklik");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(ch) == null) {
                NotificationChannel c = new NotificationChannel(
                        ch, sound ? "Kew · complete" : "Kew · complete (silent)",
                        sound ? NotificationManager.IMPORTANCE_DEFAULT : NotificationManager.IMPORTANCE_LOW);
                c.setDescription("Cybergah Group");
                if (sound) {
                    AudioAttributes aa = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build();
                    c.setSound(snd, aa);
                } else {
                    c.setSound(null, null);
                }
                nm.createNotificationChannel(c);
            }
            NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, ch)
                    .setSmallIcon(R.drawable.ic_stat_kew)
                    .setContentTitle("Kew ✓")
                    .setContentText(title)
                    .setAutoCancel(true)
                    .setPriority(sound ? NotificationCompat.PRIORITY_DEFAULT : NotificationCompat.PRIORITY_LOW);
            if (sound && Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                b.setSound(snd);
            }
            nm.notify((int) (System.currentTimeMillis() % 100000), b.build());
        } catch (Throwable ignored) {
        }
        call.resolve();
    }

    /** Start/stop the foreground service so downloads survive backgrounding. */
    @PluginMethod
    public void setBusy(PluginCall call) {
        boolean active = Boolean.TRUE.equals(call.getBoolean("active", false));
        String text = call.getString("text", "Downloading…");
        try {
            Intent it = new Intent(getContext(), KewDownloadService.class);
            if (active) {
                it.putExtra("text", text);
                androidx.core.content.ContextCompat.startForegroundService(getContext(), it);
            } else {
                getContext().stopService(it);
            }
        } catch (Throwable ignored) {
        }
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String taskId = call.getString("taskId", "0");
        try {
            YoutubeDL.getInstance().destroyProcessById(taskId);
        } catch (Throwable ignored) {
        }
        call.resolve();
    }

    private final java.util.Map<String, long[]> lastEmit = new java.util.concurrent.ConcurrentHashMap<>();

    /**
     * Throttled progress events: yt-dlp reports many times per second and every
     * event crosses the JS bridge + re-renders the list, which made downloads
     * feel heavy on phones. Emit at most ~3/s per task (jumps ≥5% pass through).
     */
    private void emit(String taskId, float progress, long eta, String line) {
        long now = System.currentTimeMillis();
        long[] prev = lastEmit.get(taskId); // [lastTimeMs, lastProgress×100]
        if (prev != null && progress >= 0 && progress < 100) {
            boolean bigJump = progress * 100 - prev[1] >= 500;
            if (!bigJump && now - prev[0] < 350) return;
        }
        lastEmit.put(taskId, new long[]{now, (long) (progress * 100)});
        JSObject ev = new JSObject();
        ev.put("taskId", taskId);
        ev.put("progress", progress);
        ev.put("eta", eta);
        ev.put("line", line);
        notifyListeners("progress", ev);
        // Mirror the percentage onto the foreground-service notification.
        KewDownloadService.updateProgress(getContext(), progress);
    }

    private String mimeOf(String name) {
        String n = name.toLowerCase();
        if (n.endsWith(".mp3") || n.endsWith(".m4a") || n.endsWith(".opus") || n.endsWith(".aac") || n.endsWith(".wav"))
            return "audio/*";
        return "video/*";
    }

    /** Copy a finished file into the public Downloads/Kew folder. Returns a usable uri string. */
    private String publish(File src, String name, String mime) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver cr = getContext().getContentResolver();
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
                cv.put(MediaStore.Downloads.MIME_TYPE, mime.replace("/*", "/mp4"));
                cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Kew");
                cv.put(MediaStore.Downloads.IS_PENDING, 1);
                Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) return null;
                try (InputStream in = new FileInputStream(src); OutputStream out = cr.openOutputStream(uri)) {
                    byte[] buf = new byte[1 << 20];
                    int r;
                    while ((r = in.read(buf)) > 0) out.write(buf, 0, r);
                }
                cv.clear();
                cv.put(MediaStore.Downloads.IS_PENDING, 0);
                cr.update(uri, cv, null, null);
                return uri.toString();
            } else {
                File pub = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "Kew");
                if (!pub.exists()) pub.mkdirs();
                File dst = new File(pub, name);
                try (InputStream in = new FileInputStream(src); OutputStream out = new java.io.FileOutputStream(dst)) {
                    byte[] buf = new byte[1 << 20];
                    int r;
                    while ((r = in.read(buf)) > 0) out.write(buf, 0, r);
                }
                return Uri.fromFile(dst).toString();
            }
        } catch (Throwable e) {
            return null;
        }
    }
}
