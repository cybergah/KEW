package com.cybergah.kew;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Kew — keeps downloads alive while the app is in the background.
 * Cybergah Group · cybergah.com
 *
 * A foreground service + partial wake lock so the OS does not kill the
 * yt-dlp worker thread when the screen is off or the app is backgrounded.
 */
public class KewDownloadService extends Service {
    public static final String CHANNEL_ID = "kew_downloads";
    public static final int NOTIF_ID = 4201;
    private PowerManager.WakeLock wakeLock;

    private static volatile boolean running = false;
    private static volatile String lastText = "Downloading…";
    private static volatile long lastNotifMs = 0;

    /** Mirror the download percentage onto the ongoing service notification. */
    static void updateProgress(Context ctx, float progress) {
        if (!running) return;
        long now = System.currentTimeMillis();
        if (now - lastNotifMs < 900) return; // don't spam the notification manager
        lastNotifMs = now;
        try {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationCompat.Builder b = baseBuilder(ctx, lastText);
            int pct = Math.round(progress);
            if (pct >= 0 && pct <= 100) {
                b.setProgress(100, pct, false);
                b.setContentText(lastText + " · " + pct + "%");
            } else {
                b.setProgress(100, 0, true); // preparing — indeterminate
            }
            nm.notify(NOTIF_ID, b.build());
        } catch (Throwable ignored) {
        }
    }

    private static NotificationCompat.Builder baseBuilder(Context ctx, String text) {
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int pf = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, pf);
        return new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setContentTitle("Kew")
                .setContentText(text)
                .setSmallIcon(R.drawable.ic_stat_kew)
                .setContentIntent(pi)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Kew::download");
        wakeLock.setReferenceCounted(false);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String text = (intent != null && intent.getStringExtra("text") != null)
                ? intent.getStringExtra("text") : "Downloading…";
        lastText = text;
        running = true;

        Notification n = baseBuilder(this, text).setProgress(100, 0, true).build();

        startForeground(NOTIF_ID, n);
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(3 * 60 * 60 * 1000L); // safety cap: 3h
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID, "Kew downloads", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("Cybergah Group");
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
        }
    }
}
