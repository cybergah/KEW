package com.cybergah.kew;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

// Kew — Cybergah Group · cybergah.com
public class MainActivity extends BridgeActivity {
    private static final Pattern URL_RE = Pattern.compile("https?://\\S+");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register native bridges before the web bridge boots.
        registerPlugin(KewDownloaderPlugin.class);
        registerPlugin(KewYtdlpPlugin.class);
        super.onCreate(savedInstanceState);
        handleShare(getIntent());

        // Ask for notification permission so the background-download status shows (Android 13+).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 100);
            }
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleShare(intent);
    }

    @Override
    public void onPause() {
        super.onPause();
        // While the media service is active (music/video playing), undo the
        // WebView pause so playback keeps running in the background and with
        // the screen off.
        if (KewMediaService.active && this.bridge != null) {
            try {
                this.bridge.getWebView().onResume();
                this.bridge.getWebView().resumeTimers();
            } catch (Throwable ignored) {
            }
        }
    }

    /** "Share → Kew": stash the first URL of the shared text for the web layer. */
    private void handleShare(Intent intent) {
        try {
            if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (text == null) return;
            Matcher m = URL_RE.matcher(text);
            if (m.find()) KewYtdlpPlugin.pendingShare = m.group();
        } catch (Throwable ignored) {
        }
    }
}
