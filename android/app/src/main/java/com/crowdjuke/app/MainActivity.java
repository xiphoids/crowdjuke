package com.crowdjuke.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIncomingIntent(intent);
    }

    /**
     * When the user shares a URL from a music app, extract it and navigate the
     * WebView to the last-used event page with ?share= attached.
     */
    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();

        String sharedUrl = null;

        if (Intent.ACTION_SEND.equals(action) && "text/plain".equals(type)) {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (text != null) {
                // Music apps often include extra text around the URL; extract first http(s) URL.
                sharedUrl = extractUrl(text);
            }
        } else if (Intent.ACTION_VIEW.equals(action) && intent.getData() != null) {
            Uri data = intent.getData();
            if ("crowdjuke".equals(data.getScheme())) {
                // crowdjuke://event/CODE?share=encodedUrl — pass through to WebView
                String code = data.getLastPathSegment();
                String share = data.getQueryParameter("share");
                if (code != null && share != null) {
                    String path = "/event/" + code + "?share=" + Uri.encode(share);
                    navigateWebView(path);
                    return;
                }
            }
        }

        if (sharedUrl != null) {
            // Read last event code from SharedPreferences (set by the web app via JS bridge)
            String lastCode = getSharedPreferences("crowdjuke", MODE_PRIVATE)
                    .getString("lastEventCode", null);
            if (lastCode != null) {
                String path = "/event/" + lastCode + "?share=" + Uri.encode(sharedUrl);
                navigateWebView(path);
            }
        }
    }

    private void navigateWebView(String path) {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(() ->
                getBridge().getWebView().evaluateJavascript(
                    "window.location.href = '" + path + "'", null
                )
            );
        }
    }

    private static String extractUrl(String text) {
        int start = text.indexOf("http");
        if (start == -1) return null;
        int end = text.indexOf(' ', start);
        if (end == -1) end = text.length();
        return text.substring(start, end).trim();
    }
}
