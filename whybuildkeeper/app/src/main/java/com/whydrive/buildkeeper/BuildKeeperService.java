package com.whydrive.buildkeeper;

import android.app.*;
import android.content.*;
import android.os.*;

public class BuildKeeperService extends Service {
    private static final String CHANNEL="keeper";
    private Handler handler;
    private PowerManager.WakeLock wakeLock;

    private final Runnable cycle = new Runnable() {
        @Override public void run() {
            SharedPreferences p = getSharedPreferences("keeper", MODE_PRIVATE);
            if (!p.getBoolean("running", false)) return;

            if (p.getBoolean("awaiting_idle", false)) {
                handler.postDelayed(this, 30_000L);
                return;
            }

            String[] titles = {
                p.getString("driver","WhyDrive Driver APK"),
                p.getString("customer","WhyDrive customer app"),
                p.getString("dispatch","WhyDrive dispatch app")
            };
            int idx = p.getInt("index",0) % titles.length;
            String target = titles[idx];

            p.edit()
             .putString("current_target", target)
             .putLong("command_id", System.currentTimeMillis())
             .putInt("index", (idx+1)%titles.length)
             .apply();

            Intent launch = getPackageManager().getLaunchIntentForPackage("com.openai.chatgpt");
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                startActivity(launch);
            }

            int mins = p.getInt("interval",5);
            handler.postDelayed(this, mins * 60L * 1000L);
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        handler = new Handler(Looper.getMainLooper());
        createChannel();
        PowerManager pm=(PowerManager)getSystemService(POWER_SERVICE);
        wakeLock=pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"WhyDrive:BuildKeeper");
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent==null ? "START" : intent.getAction();
        if ("STOP".equals(action)) {
            getSharedPreferences("keeper",MODE_PRIVATE).edit()
                    .putBoolean("running",false)
                    .putBoolean("awaiting_idle",false)
                    .apply();
            handler.removeCallbacksAndMessages(null);
            if (wakeLock!=null && wakeLock.isHeld()) wakeLock.release();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        getSharedPreferences("keeper",MODE_PRIVATE).edit()
                .putBoolean("running",true)
                .putBoolean("awaiting_idle",false)
                .apply();
        startForeground(1001, notification());
        if (!wakeLock.isHeld()) wakeLock.acquire();
        handler.removeCallbacks(cycle);
        handler.post(cycle);
        return START_STICKY;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT>=26) {
            NotificationChannel c=new NotificationChannel(CHANNEL,"WhyDrive Build Keeper",NotificationManager.IMPORTANCE_LOW);
            ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(c);
        }
    }

    private Notification notification() {
        Intent stop=new Intent(this,BuildKeeperService.class);
        stop.setAction("STOP");
        PendingIntent pi=PendingIntent.getService(this,2,stop,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this,CHANNEL)
                .setContentTitle("WhyDrive Build Keeper running")
                .setContentText("Automatically prompting the WhyDrive build chats")
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .addAction(new Notification.Action.Builder(null,"STOP",pi).build())
                .build();
    }

    @Override public void onDestroy() {
        if (wakeLock!=null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}