package com.whydrive.buildkeeper;

import android.accessibilityservice.AccessibilityService;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

public class ChatAccessibilityService extends AccessibilityService {
    private Handler handler;
    private long activeCommand = -1L;
    private int stage = 0;
    private long lastSent = 0L;

    private static final String PROMPT =
        "AUTONOMOUS WHYDRIVE BUILD CONTINUATION\n\n" +
        "Resume the current WhyDrive development work immediately from the latest state in this conversation. " +
        "Do not wait for any further input from me. Continue working through all outstanding issues already reported in this conversation.\n\n" +
        "Continuous cycle: CHECK CURRENT STATE -> REPAIR -> BUILD -> TEST -> CHECK FOR REGRESSIONS -> REPAIR AGAIN.\n\n" +
        "Do not stop after finding or explaining an error. Do not wait for me between repair attempts. " +
        "If a repair fails, immediately try another approach. If the build fails, investigate, repair and rebuild. " +
        "If a feature passes testing, immediately continue to the next outstanding issue. Do not start unrelated features. " +
        "A successful compile does not mean the work is complete.\n\n" +
        "Continue until every requested issue is FIXED -> BUILT -> TESTED -> REGRESSION CHECKED. " +
        "When complete, perform a final release build, check every reported issue, confirm the newest repaired APK, and provide the APK to me. " +
        "Only stop for a genuine blocker requiring something only I can provide. TARGET: COMPLETE -> TESTED -> RELEASE APK -> SEND APK.";

    @Override protected void onServiceConnected() {
        super.onServiceConnected();
        handler = new Handler(Looper.getMainLooper());
    }

    @Override public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event.getPackageName()==null || !"com.openai.chatgpt".contentEquals(event.getPackageName())) return;

        SharedPreferences p=getSharedPreferences("keeper",MODE_PRIVATE);
        if (!p.getBoolean("running",false)) return;

        long cmd=p.getLong("command_id",0);
        if (cmd<=0) return;
        if (cmd!=activeCommand) {
            activeCommand=cmd;
            stage=0;
        }

        handler.removeCallbacks(process);
        handler.postDelayed(process, 450);
    }

    private final Runnable process = new Runnable() {
        @Override public void run() {
            SharedPreferences p=getSharedPreferences("keeper",MODE_PRIVATE);
            if (!p.getBoolean("running",false)) return;

            AccessibilityNodeInfo root=getRootInActiveWindow();
            if (root==null) return;

            String target=p.getString("current_target","");
            if (target.isEmpty()) return;

            if (stage==0) {
                AccessibilityNodeInfo title=findExact(root,target);
                if (title!=null) {
                    AccessibilityNodeInfo clickable=clickableParent(title);
                    if (clickable!=null) clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                    stage=1;
                    handler.postDelayed(this,1200);
                    return;
                }

                AccessibilityNodeInfo menu=findByAnyDescription(root,new String[]{"Open sidebar","Menu","Navigation menu","Open menu"});
                if (menu!=null) {
                    AccessibilityNodeInfo c=clickableParent(menu);
                    if (c!=null) c.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                    handler.postDelayed(this,800);
                }
                return;
            }

            if (stage==1) {
                if (isBusy(root)) {
                    handler.postDelayed(this, 5000);
                    return;
                }
                AccessibilityNodeInfo edit=findEditable(root);
                if (edit!=null) {
                    Bundle b=new Bundle();
                    b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,PROMPT);
                    edit.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
                    edit.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT,b);
                    stage=2;
                    handler.postDelayed(this,900);
                }
                return;
            }

            if (stage==2) {
                AccessibilityNodeInfo send=findByAnyDescription(root,new String[]{"Send message","Send","Submit"});
                if (send==null) send=findTextContains(root,"Send");

                if (send!=null && System.currentTimeMillis()-lastSent>10000) {
                    AccessibilityNodeInfo c=clickableParent(send);
                    if (c!=null && c.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                        lastSent=System.currentTimeMillis();
                        getSharedPreferences("keeper",MODE_PRIVATE).edit().putBoolean("awaiting_idle",true).apply();
                        stage=3;
                        handler.postDelayed(this, 5000);
                    }
                }
                return;
            }

            if (stage==3) {
                if (isBusy(root)) {
                    handler.postDelayed(this, 5000);
                    return;
                }
                getSharedPreferences("keeper",MODE_PRIVATE).edit().putBoolean("awaiting_idle",false).apply();
                stage=4;
            }
        }
    };

    private AccessibilityNodeInfo findExact(AccessibilityNodeInfo n,String text) {
        if (n==null) return null;
        CharSequence t=n.getText();
        if (t!=null && text.equalsIgnoreCase(t.toString().trim())) return n;

        for (int i=0;i<n.getChildCount();i++) {
            AccessibilityNodeInfo r=findExact(n.getChild(i),text);
            if (r!=null) return r;
        }
        return null;
    }

    private AccessibilityNodeInfo findEditable(AccessibilityNodeInfo n) {
        if (n==null) return null;
        if (n.isEditable() || (n.getClassName()!=null && n.getClassName().toString().contains("EditText"))) return n;

        for (int i=0;i<n.getChildCount();i++) {
            AccessibilityNodeInfo r=findEditable(n.getChild(i));
            if (r!=null) return r;
        }
        return null;
    }

    private AccessibilityNodeInfo findByAnyDescription(AccessibilityNodeInfo n,String[] terms) {
        if (n==null) return null;
        CharSequence d=n.getContentDescription();
        if (d!=null) {
            String s=d.toString().trim();
            for (String x:terms) {
                if (s.equalsIgnoreCase(x) || s.toLowerCase().contains(x.toLowerCase())) return n;
            }
        }

        for (int i=0;i<n.getChildCount();i++) {
            AccessibilityNodeInfo r=findByAnyDescription(n.getChild(i),terms);
            if (r!=null) return r;
        }
        return null;
    }

    private AccessibilityNodeInfo findTextContains(AccessibilityNodeInfo n,String term) {
        if (n==null) return null;
        CharSequence t=n.getText();
        if (t!=null && t.toString().toLowerCase().contains(term.toLowerCase())) return n;

        for (int i=0;i<n.getChildCount();i++) {
            AccessibilityNodeInfo r=findTextContains(n.getChild(i),term);
            if (r!=null) return r;
        }
        return null;
    }

    private boolean isBusy(AccessibilityNodeInfo root) {
        if (findByAnyDescription(root,new String[]{"Stop generating","Stop response","Stop"})!=null) return true;
        AccessibilityNodeInfo thinking=findTextContains(root,"Thinking");
        return thinking!=null;
    }

    private AccessibilityNodeInfo clickableParent(AccessibilityNodeInfo n) {
        AccessibilityNodeInfo cur=n;
        for (int i=0;i<5 && cur!=null;i++) {
            if (cur.isClickable()) return cur;
            cur=cur.getParent();
        }
        return n;
    }

    @Override public void onInterrupt() {}
}