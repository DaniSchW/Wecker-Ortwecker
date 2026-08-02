package app.weckerundort.mobile;

import android.app.KeyguardManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {

    static final String ACTION_OPEN_LOCATION_ALARM = "app.weckerundort.mobile.action.OPEN_LOCATION_ALARM";
    static final String EXTRA_ALARM_ID = "alarmId";
    static final String EXTRA_LOCATION_ID = "locationId";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_DESCRIPTION = "description";
    static final String EXTRA_SOUND = "sound";
    static final String EXTRA_ENTER = "enter";

    // Zwischenspeicher für einen Alarm, der per Vollbild-Intent ausgelöst
    // wurde, bevor LocationAlarmBridgePlugin.load() gelaufen ist (kalter
    // Start) - wird von dort per consumePendingAlarm() abgeholt.
    private static JSObject sPendingAlarm;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocationAlarmBridgePlugin.class);
        super.onCreate(savedInstanceState);
        handleAlarmIntent(getIntent(), false);
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAlarmIntent(intent, true);
    }

    /**
     * Reagiert auf einen Start/Neustart der Activity über den Vollbild-
     * Intent einer Orts-Zeit-Wecker-Benachrichtigung (siehe
     * LocationAlarmNotifier). Setzt die zum Anzeigen über dem Sperr-
     * bildschirm nötigen Fenster-Flags NUR in diesem Fall - ein normaler
     * App-Start bleibt unverändert.
     */
    private void handleAlarmIntent(Intent intent, boolean activityAlreadyRunning) {
        if (intent == null || !ACTION_OPEN_LOCATION_ALARM.equals(intent.getAction())) {
            return;
        }

        applyLockScreenFlags();

        JSObject data = new JSObject();
        data.put("alarmId", intent.getStringExtra(EXTRA_ALARM_ID));
        data.put("locationId", intent.getStringExtra(EXTRA_LOCATION_ID));
        data.put("title", intent.getStringExtra(EXTRA_TITLE));
        data.put("description", intent.getStringExtra(EXTRA_DESCRIPTION));
        data.put("sound", intent.getStringExtra(EXTRA_SOUND));
        data.put("enter", intent.getBooleanExtra(EXTRA_ENTER, true));

        if (activityAlreadyRunning) {
            LocationAlarmBridgePlugin plugin = activeLocationAlarmBridgePlugin();
            if (plugin != null) {
                plugin.notifyPendingAlarm(data);
                return;
            }
        }
        sPendingAlarm = data;
    }

    private LocationAlarmBridgePlugin activeLocationAlarmBridgePlugin() {
        try {
            PluginHandle handle = getBridge().getPlugin("LocationAlarmBridge");
            if (handle == null) return null;
            Plugin instance = handle.getInstance();
            return instance instanceof LocationAlarmBridgePlugin ? (LocationAlarmBridgePlugin) instance : null;
        } catch (Exception e) {
            return null;
        }
    }

    private void applyLockScreenFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager keyguardManager = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
            if (keyguardManager != null) {
                keyguardManager.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow()
                .addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                );
        }
    }

    static JSObject consumePendingAlarm() {
        JSObject data = sPendingAlarm;
        sPendingAlarm = null;
        return data;
    }
}
