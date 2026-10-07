package com.whydrive.buildkeeper;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.widget.*;

public class MainActivity extends Activity {
    private SharedPreferences prefs;
    private TextView status;
    private EditText driver, customer, dispatch;
    private Spinner interval;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences("keeper", MODE_PRIVATE);

        ScrollView scroll = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(40, 50, 40, 50);
        scroll.addView(box);

        TextView title = new TextView(this);
        title.setText("WhyDrive Build Keeper");
        title.setTextSize(28);
        box.addView(title);

        TextView info = new TextView(this);
        info.setText("\nFree replacement for Tasker + AutoInput. It cycles through the WhyDrive Driver, Customer and Dispatch chats and sends the continuation prompt automatically.\n\nThe phone normally needs to stay unlocked for Android Accessibility to control ChatGPT reliably.");
        info.setTextSize(16);
        box.addView(info);

        status = new TextView(this);
        status.setTextSize(18);
        status.setPadding(0,25,0,25);
        box.addView(status);

        Button accessibility = new Button(this);
        accessibility.setText("1. ENABLE ACCESSIBILITY");
        accessibility.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)));
        box.addView(accessibility);

        driver = field("Driver chat title", prefs.getString("driver", "WhyDrive Driver APK"));
        customer = field("Customer chat title", prefs.getString("customer", "WhyDrive customer app"));
        dispatch = field("Dispatch chat title", prefs.getString("dispatch", "WhyDrive dispatch app"));
        box.addView(driver); box.addView(customer); box.addView(dispatch);

        TextView intervalLabel = new TextView(this);
        intervalLabel.setText("\nPrompt interval:");
        box.addView(intervalLabel);

        interval = new Spinner(this);
        String[] options = {"5 minutes","10 minutes","15 minutes","30 minutes"};
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, options);
        interval.setAdapter(adapter);
        int mins = prefs.getInt("interval", 5);
        int pos = mins==10?1:mins==15?2:mins==30?3:0;
        interval.setSelection(pos);
        box.addView(interval);

        Button save = new Button(this);
        save.setText("SAVE SETTINGS");
        save.setOnClickListener(v -> saveSettings());
        box.addView(save);

        Button start = new Button(this);
        start.setText("START AUTO BUILD");
        start.setTextSize(19);
        start.setOnClickListener(v -> {
            saveSettings();
            if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7);
            }
            Intent i = new Intent(this, BuildKeeperService.class);
            i.setAction("START");
            startForegroundService(i);
            Toast.makeText(this, "WhyDrive auto build started", Toast.LENGTH_LONG).show();
            refresh();
        });
        box.addView(start);

        Button stop = new Button(this);
        stop.setText("STOP AUTO BUILD");
        stop.setTextSize(19);
        stop.setOnClickListener(v -> {
            Intent i = new Intent(this, BuildKeeperService.class);
            i.setAction("STOP");
            startService(i);
            Toast.makeText(this, "Stopped", Toast.LENGTH_SHORT).show();
            refresh();
        });
        box.addView(stop);

        Button open = new Button(this);
        open.setText("OPEN CHATGPT");
        open.setOnClickListener(v -> {
            Intent launch = getPackageManager().getLaunchIntentForPackage("com.openai.chatgpt");
            if (launch != null) startActivity(launch);
        });
        box.addView(open);

        TextView safety = new TextView(this);
        safety.setText("\nSafety: Build Keeper only attempts to type while ChatGPT is active and it has found the configured WhyDrive chat title. If it cannot confirm the target, it does not send.\n\nAndroid requires you to enable Accessibility once manually.");
        box.addView(safety);

        setContentView(scroll);
        refresh();
    }

    private EditText field(String hint, String value) {
        EditText e = new EditText(this);
        e.setHint(hint);
        e.setSingleLine(true);
        e.setText(value);
        e.setInputType(InputType.TYPE_CLASS_TEXT);
        return e;
    }

    private void saveSettings() {
        int p = interval.getSelectedItemPosition();
        int mins = p==1?10:p==2?15:p==3?30:5;
        prefs.edit()
                .putString("driver", driver.getText().toString().trim())
                .putString("customer", customer.getText().toString().trim())
                .putString("dispatch", dispatch.getText().toString().trim())
                .putInt("interval", mins)
                .apply();
        Toast.makeText(this, "Saved", Toast.LENGTH_SHORT).show();
    }

    private void refresh() {
        boolean running = prefs.getBoolean("running", false);
        status.setText(running ? "STATUS: RUNNING" : "STATUS: STOPPED");
    }

    @Override protected void onResume() {
        super.onResume();
        if (status != null) refresh();
    }
}