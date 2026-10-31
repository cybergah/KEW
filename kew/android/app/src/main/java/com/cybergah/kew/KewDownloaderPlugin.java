package com.cybergah.kew;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Kew — native downloader.
 * Cybergah Group · cybergah.com
 *
 * Wraps Android's DownloadManager so media is downloaded reliably in the
 * background, shown in the system notification tray, and saved into the
 * public Downloads/Kew folder. No third-party tracking, no analytics.
 */
@CapacitorPlugin(name = "KewDownloader")
public class KewDownloaderPlugin extends Plugin {

    @PluginMethod
    public void enqueue(PluginCall call) {
        String url = call.getString("url");
        String filename = call.getString("filename", "kew-" + System.currentTimeMillis() + ".mp4");
        String title = call.getString("title", "Kew");

        if (url == null || url.isEmpty()) {
            call.reject("missing url");
            return;
        }

        try {
            Context ctx = getContext();
            DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);

            String safe = filename.replaceAll("[\\\\/:*?\"<>|]", "_");

            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.setTitle(title);
            req.setDescription("Kew · Cybergah Group");
            req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "Kew/" + safe);
            req.setAllowedOverMetered(true);
            req.setAllowedOverRoaming(true);
            req.allowScanningByMediaScanner();

            long id = dm.enqueue(req);

            JSObject ret = new JSObject();
            ret.put("id", id);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("enqueue failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void query(PluginCall call) {
        Long id = call.getLong("id");
        if (id == null) {
            call.reject("missing id");
            return;
        }
        JSObject ret = new JSObject();
        Cursor c = null;
        try {
            DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Query q = new DownloadManager.Query().setFilterById(id);
            c = dm.query(q);
            if (c != null && c.moveToFirst()) {
                int status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                long done = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                long total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                String localUri = c.getString(c.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI));

                String s;
                switch (status) {
                    case DownloadManager.STATUS_SUCCESSFUL: s = "completed"; break;
                    case DownloadManager.STATUS_FAILED: s = "failed"; break;
                    case DownloadManager.STATUS_PAUSED: s = "paused"; break;
                    case DownloadManager.STATUS_PENDING: s = "pending"; break;
                    default: s = "running";
                }
                ret.put("status", s);
                ret.put("bytesDownloaded", done);
                ret.put("bytesTotal", total);
                if (localUri != null) ret.put("localUri", localUri);
            } else {
                ret.put("status", "failed");
                ret.put("bytesDownloaded", 0);
                ret.put("bytesTotal", 0);
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("query failed: " + e.getMessage());
        } finally {
            if (c != null) c.close();
        }
    }

    @PluginMethod
    public void openFile(PluginCall call) {
        String uri = call.getString("uri");
        String mime = call.getString("mime", "video/*");
        if (uri == null) {
            call.reject("missing uri");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(Uri.parse(uri), mime);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("open failed: " + e.getMessage());
        }
    }
}
