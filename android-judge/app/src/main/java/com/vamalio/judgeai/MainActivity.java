package com.vamalio.judgeai;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private static final String JUDGE_URL = "https://vermalio.stace-walbridge.workers.dev/judge-ai/";

    @SuppressLint("SetJavaScriptEnabled")
    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView web = new WebView(this);
        setContentView(web);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("https".equalsIgnoreCase(u.getScheme()) &&
                    (u.getHost().endsWith("workers.dev") || u.getHost().endsWith("github.com") ||
                     u.getHost().endsWith("google.com") || u.getHost().endsWith("accounts.google.com") ||
                     u.getHost().endsWith("anthropic.com") || u.getHost().endsWith("openai.com"))) {
                    return false;
                }
                startActivity(new Intent(Intent.ACTION_VIEW, u));
                return true;
            }
        });
        web.loadUrl(JUDGE_URL);
    }

    @Override public void onBackPressed() {
        WebView web = (WebView)findViewById(android.R.id.content).getRootView().findViewById(android.R.id.content);
        super.onBackPressed();
    }
}
