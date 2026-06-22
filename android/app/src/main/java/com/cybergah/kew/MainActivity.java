package com.cybergah.kew;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

// Kew — Cybergah Group · cybergah.com
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register native bridges before the web bridge boots.
        registerPlugin(KewDownloaderPlugin.class);
        registerPlugin(KewYtdlpPlugin.class);
        super.onCreate(savedInstanceState);

        // Ask for notification permission so the background-download status shows (Android 13+).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, 100);
            }
        }
    }
}
