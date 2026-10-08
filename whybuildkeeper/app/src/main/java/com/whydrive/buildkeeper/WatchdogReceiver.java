package com.whydrive.buildkeeper;

import android.content.*;

public class WatchdogReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        SharedPreferences p=context.getSharedPreferences("keeper",Context.MODE_PRIVATE);
        if (!p.getBoolean("running",false)) return;
        try {
            Intent s=new Intent(context,BuildKeeperService.class);
            s.setAction("START");
            context.startForegroundService(s);
        } catch (Exception ignored) {}
    }
}