package com.cybergah.kew;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
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

    private volatile boolean inited = false;
    private volatile boolean updated = false;

    private synchronized void ensureInit() throws Exception {
        if (inited) return;
        YoutubeDL.getInstance().init(getContext().getApplicationContext());
        FFmpeg.getInstance().init(getContext().getApplicationContext());
        inited = true;
        // Refresh yt-dlp once per session so fast-moving sites (TikTok, YouTube,
        // Instagram) keep working — nightly tracks site changes most closely.
        if (!updated) {
            updated = true;
            Context app = getContext().getApplicationContext();
            try {
                YoutubeDL.getInstance().updateYoutubeDL(app, YoutubeDL.UpdateChannel._NIGHTLY);
            } catch (Throwable t1) {
                try {
                    YoutubeDL.getInstance().updateYoutubeDL(app, YoutubeDL.UpdateChannel._STABLE);
                } catch (Throwable ignored) {
                }
            }
        }
    }

    @PluginMethod
    public void download(final PluginCall call) {
        final String url = call.getString("url");
        final boolean audioOnly = Boolean.TRUE.equals(call.getBoolean("audioOnly", false));
        final String quality = call.getString("quality", "1080");
        final String taskId = call.getString("taskId", "0");
        if (url == null || url.isEmpty()) {
            call.reject("missing url");
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
                req.addOption("-o", new File(outDir, "%(title).80B [%(id)s].%(ext)s").getAbsolutePath());
                req.addOption("--no-mtime");
                req.addOption("--no-playlist");
                req.addOption("--continue");
                req.addOption("--restrict-filenames");
                if (audioOnly) {
                    req.addOption("-x");
                    req.addOption("--audio-format", "mp3");
                    req.addOption("--audio-quality", "0");
                } else {
                    // Never hard-exclude formats (so vertical TikTok/Shorts still
                    // download); prefer resolution + H.264 + mp4 via soft sorting.
                    req.addOption("-f", "bv*+ba/b");
                    String sort = "max".equals(quality)
                            ? "res,vcodec:h264,ext:mp4"
                            : "res:" + quality + ",vcodec:h264,ext:mp4";
                    req.addOption("-S", sort);
                    req.addOption("--merge-output-format", "mp4");
                }

                Function3<Float, Long, String, Unit> cb = (progress, etaInSeconds, line) -> {
                    emit(taskId, progress, etaInSeconds, line);
                    return Unit.INSTANCE;
                };
                YoutubeDL.getInstance().execute(req, taskId, cb);

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

                JSObject ret = new JSObject();
                ret.put("files", files);
                call.resolve(ret);
            } catch (Throwable e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "yt-dlp failed");
            }
        }).start();
    }

    /** Enumerate a playlist's entries (or return a single entry for a normal link). Fast — no download. */
    @PluginMethod
    public void playlist(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("missing url");
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
        if (url == null || url.isEmpty()) {
            call.reject("missing url");
            return;
        }
        new Thread(() -> {
            try {
                ensureInit();
                YoutubeDLRequest req = new YoutubeDLRequest(url);
                req.addOption("--no-playlist");
                req.addOption("--no-warnings");
                VideoInfo vi = YoutubeDL.getInstance().getInfo(req);
                JSObject ret = new JSObject();
                ret.put("title", vi.getTitle() != null ? vi.getTitle() : vi.getFulltitle());
                ret.put("thumbnail", vi.getThumbnail());
                ret.put("duration", vi.getDuration());
                ret.put("uploader", vi.getUploader());
                ret.put("extractor", vi.getExtractor());
                call.resolve(ret);
            } catch (Throwable e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "info failed");
            }
        }).start();
    }

    /** Play the keklik call (intro / on demand) reliably via MediaPlayer. */
    @PluginMethod
    public void playKeklik(PluginCall call) {
        try {
            MediaPlayer mp = MediaPlayer.create(getContext(), R.raw.keklik);
            if (mp != null) {
                mp.setOnCompletionListener(p -> p.release());
                mp.start();
            }
        } catch (Throwable ignored) {
        }
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

    private void emit(String taskId, float progress, long eta, String line) {
        JSObject ev = new JSObject();
        ev.put("taskId", taskId);
        ev.put("progress", progress);
        ev.put("eta", eta);
        ev.put("line", line);
        notifyListeners("progress", ev);
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
                    byte[] buf = new byte[1 << 16];
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
                    byte[] buf = new byte[1 << 16];
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
