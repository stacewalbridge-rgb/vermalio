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

            p.edit().putLong("last_cycle", System.currentTimeMillis()).apply();

            if (p.getBoolean("awaiting_idle", false)) {
                scheduleWatchdog(2 * 60_000L);
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

            openChatGPT();

            int mins = p.getInt("interval",5);
            scheduleWatchdog(Math.max(90_000L, mins * 60_000L + 30_000L));
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
            cancelWatchdog();
            if (wakeLock!=null && wakeLock.isHeld()) wakeLock.release();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        SharedPreferences p=getSharedPreferences("keeper",MODE_PRIVATE);
        p.edit().putBoolean("running",true).apply();

        startForeground(1001, notification());
        if (!wakeLock.isHeld()) wakeLock.acquire();

        handler.removeCallbacks(cycle);
        handler.post(cycle);
        scheduleWatchdog(2 * 60_000L);

        return START_STICKY;
    }

    private void openChatGPT() {
        try {
            Intent launch = getPackageManager().getLaunchIntentForPackage("com.openai.chatgpt");
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                startActivity(launch);
            }
        } catch (Exception ignored) {}
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT>=26) {
            NotificationChannel c=new NotificationChannel(CHANNEL,"WhyDrive Build Keeper",NotificationManager.IMPORTANCE_LOW);
            c.setDescription("Keeps the WhyDrive build continuation loop alive");
            ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(c);
        }
    }

    private Notification notification() {
        Intent open=new Intent(this,MainActivity.class);
        PendingIntent openPi=PendingIntent.getActivity(this,1,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);

        Intent stop=new Intent(this,BuildKeeperService.class);
        stop.setAction("STOP");
        PendingIntent stopPi=PendingIntent.getService(this,2,stop,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);

        return new Notification.Builder(this,CHANNEL)
                .setContentTitle("WhyDrive Build Keeper running")
                .setContentText("Watchdog active - auto build will restart if Android kills it")
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setContentIntent(openPi)
                .setOngoing(true)
                .addAction(new Notification.Action.Builder(null,"STOP",stopPi).build())
                .build();
    }

    private void scheduleWatchdog(long delayMs) {
        try {
            AlarmManager am=(AlarmManager)getSystemService(ALARM_SERVICE);
            Intent i=new Intent(this,WatchdogReceiver.class);
            PendingIntent pi=PendingIntent.getBroadcast(this,77,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            long at=System.currentTimeMillis()+delayMs;
            if (Build.VERSION.SDK_INT>=23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pi);
            else am.set(AlarmManager.RTC_WAKEUP,at,pi);
        } catch (Exception ignored) {}
    }

    private void cancelWatchdog() {
        try {
            AlarmManager am=(AlarmManager)getSystemService(ALARM_SERVICE);
            Intent i=new Intent(this,WatchdogReceiver.class);
            PendingIntent pi=PendingIntent.getBroadcast(this,77,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            am.cancel(pi);
        } catch (Exception ignored) {}
    }

    @Override public void onTaskRemoved(Intent rootIntent) {
        SharedPreferences p=getSharedPreferences("keeper",MODE_PRIVATE);
        if (p.getBoolean("running",false)) scheduleWatchdog(15_000L);
        super.onTaskRemoved(rootIntent);
    }

    @Override public void onDestroy() {
        SharedPreferences p=getSharedPreferences("keeper",MODE_PRIVATE);
        if (p.getBoolean("running",false)) scheduleWatchdog(15_000L);
        if (wakeLock!=null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}