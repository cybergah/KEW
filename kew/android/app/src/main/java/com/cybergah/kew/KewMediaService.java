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
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Kew — background playback with full lock-screen controls.
 * Cybergah Group · cybergah.com
 *
 * Foreground service (mediaPlayback) + MediaSession + MediaStyle notification:
 * the system shows a mini player on the lock screen / notification shade with
 * prev · play/pause · next and a seek bar. Button presses are forwarded to the
 * WebView player via KewYtdlpPlugin.emitControl().
 */
public class KewMediaService extends Service {
    public static final String CHANNEL_ID = "kew_media";
    public static final int NOTIF_ID = 4301;
    public static volatile boolean active = false;

    static final String ACT_PREV = "kew.media.PREV";
    static final String ACT_TOGGLE = "kew.media.TOGGLE";
    static final String ACT_NEXT = "kew.media.NEXT";

    private PowerManager.WakeLock wakeLock;
    private MediaSessionCompat session;
    private String title = "Kew";
    private boolean playing = true;
    private long posMs = 0;
    private long durMs = 0;
    private float rate = 1f;

    @Override
    public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID, "Kew player", NotificationManager.IMPORTANCE_LOW);
                ch.setDescription("Cybergah Group");
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
        }
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Kew::media");
        wakeLock.setReferenceCounted(false);

        session = new MediaSessionCompat(this, "KewMedia");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { KewYtdlpPlugin.emitControl("play", -1); }
            @Override public void onPause() { KewYtdlpPlugin.emitControl("pause", -1); }
            @Override public void onSkipToNext() { KewYtdlpPlugin.emitControl("next", -1); }
            @Override public void onSkipToPrevious() { KewYtdlpPlugin.emitControl("prev", -1); }
            @Override public void onSeekTo(long pos) { KewYtdlpPlugin.emitControl("seek", pos); }
        });
        session.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACT_PREV.equals(action)) {
            KewYtdlpPlugin.emitControl("prev", -1);
        } else if (ACT_TOGGLE.equals(action)) {
            KewYtdlpPlugin.emitControl("toggle", -1);
        } else if (ACT_NEXT.equals(action)) {
            KewYtdlpPlugin.emitControl("next", -1);
        } else if (intent != null) {
            // state update from the web player
            if (intent.hasExtra("title")) title = intent.getStringExtra("title");
            playing = intent.getBooleanExtra("playing", playing);
            posMs = intent.getLongExtra("position", posMs);
            durMs = intent.getLongExtra("duration", durMs);
            rate = intent.getFloatExtra("rate", rate);
        }

        updateSession();
        startForeground(NOTIF_ID, buildNotification());
        active = true;
        if (wakeLock != null && !wakeLock.isHeld()) {
            wakeLock.acquire(6 * 60 * 60 * 1000L); // safety cap: 6h
        }
        return START_STICKY;
    }

    private void updateSession() {
        try {
            session.setMetadata(new MediaMetadataCompat.Builder()
                    .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                    .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "Kew · Cybergah")
                    .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durMs > 0 ? durMs : -1)
                    .build());
            session.setPlaybackState(new PlaybackStateCompat.Builder()
                    .setActions(PlaybackStateCompat.ACTION_PLAY
                            | PlaybackStateCompat.ACTION_PAUSE
                            | PlaybackStateCompat.ACTION_PLAY_PAUSE
                            | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                            | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                            | PlaybackStateCompat.ACTION_SEEK_TO)
                    .setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                            posMs, playing ? rate : 0f)
                    .build());
        } catch (Throwable ignored) {
        }
    }

    private PendingIntent cmd(String action) {
        Intent i = new Intent(this, KewMediaService.class).setAction(action);
        int pf = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
        return PendingIntent.getService(this, action.hashCode(), i, pf);
    }

    private Notification buildNotification() {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int pf = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent pi = PendingIntent.getActivity(this, 1, open, pf);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText("Kew ♪")
                .setSmallIcon(R.drawable.ic_stat_kew)
                .setContentIntent(pi)
                .setOngoing(playing)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC) // show on the lock screen
                .addAction(android.R.drawable.ic_media_previous, "Previous", cmd(ACT_PREV))
                .addAction(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                        playing ? "Pause" : "Play", cmd(ACT_TOGGLE))
                .addAction(android.R.drawable.ic_media_next, "Next", cmd(ACT_NEXT))
                .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                        .setMediaSession(session.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2))
                .build();
    }

    @Override
    public void onDestroy() {
        active = false;
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        try {
            session.setActive(false);
            session.release();
        } catch (Throwable ignored) {
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
