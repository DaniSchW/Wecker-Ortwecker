package app.weckerundort.mobile;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JS-Brücke für den Vollbild-Alarm-Mechanismus des Orts-Zeit-Weckers (siehe
 * www/js/locationAlarms.js, www/js/locationRinging.js). Ergänzt
 * @capacitor/local-notifications um genau die Funktionen, die dieses Plugin
 * nicht anbietet: setFullScreenIntent(), unabhängige Ton-/Vibrations-
 * Steuerung über den Alarm-Lautstärke-Kanal, und die Android-14-Berechtigung
 * USE_FULL_SCREEN_INTENT.
 */
@CapacitorPlugin(name = "LocationAlarmBridge")
public class LocationAlarmBridgePlugin extends Plugin {

    // Signalisiert LocationAlarmNotifier (rein nativer Geofence-Empfänger),
    // ob die JS-Pipeline in diesem Prozess bereits läuft - falls ja, überlässt
    // ihm der native Pfad die Entscheidung, um Doppelauslösungen zu
    // vermeiden (siehe Kommentar in LocationAlarmNotifier).
    private static volatile LocationAlarmBridgePlugin sActiveInstance;

    static boolean isJsPipelineLoaded() {
        return sActiveInstance != null;
    }

    @Override
    public void load() {
        super.load();
        sActiveInstance = this;
    }

    /**
     * Löst den Vollbild-Alarm für einen Ort aus, während die App nicht im
     * Vordergrund ist (Aufrufer: locationAlarms.js, nachdem die vollständige
     * Wiederholungstyp-/Pendel-Zeitfenster-Prüfung bereits positiv war).
     */
    @PluginMethod
    public void ringFullScreenAlarm(PluginCall call) {
        String alarmId = call.getString("alarmId");
        if (alarmId == null || alarmId.isEmpty()) {
            call.reject("alarmId fehlt");
            return;
        }
        String locationId = call.getString("locationId", "");
        String title = call.getString("title", "");
        String description = call.getString("description", "");
        String sound = call.getString("sound", "both");
        Boolean enter = call.getBoolean("enter", true);

        LocationAlarmNotifier.postAlarmNotification(
            getContext(),
            alarmId,
            locationId,
            title,
            description,
            sound,
            enter != null ? enter : true
        );
        call.resolve();
    }

    /** Beendet den nativen Ton-/Vibrations-Dienst (Swipe-zum-Stoppen im Overlay). */
    @PluginMethod
    public void stopAlarmSound(PluginCall call) {
        AlarmRingService.stop(getContext());
        call.resolve();
    }

    /**
     * Liefert (und verbraucht) die Alarm-Daten, mit denen MainActivity über
     * einen Vollbild-Intent gestartet wurde - für den Fall, dass die
     * Activity vor dem Laden dieses Plugins bereits einen Start-Intent
     * verarbeitet hat (kalter Start). Liefert ein leeres Objekt, wenn kein
     * Alarm ansteht.
     */
    @PluginMethod
    public void consumePendingAlarm(PluginCall call) {
        JSObject pending = MainActivity.consumePendingAlarm();
        call.resolve(pending != null ? pending : new JSObject());
    }

    /** Wird von MainActivity.onNewIntent() aufgerufen (Activity läuft bereits). */
    void notifyPendingAlarm(JSObject data) {
        notifyListeners("pendingAlarm", data);
    }

    @PluginMethod
    public void canUseFullScreenIntent(PluginCall call) {
        JSObject result = new JSObject();
        boolean allowed = true;
        if (Build.VERSION.SDK_INT >= 34) {
            NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            allowed = manager != null && manager.canUseFullScreenIntent();
        }
        result.put("allowed", allowed);
        call.resolve(result);
    }

    /** Öffnet die Systemeinstellungsseite zur Freigabe von USE_FULL_SCREEN_INTENT (Android 14+). */
    @PluginMethod
    public void openFullScreenIntentSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 34) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getContext().startActivity(intent);
            } catch (Exception e) {
                call.reject("Einstellungsseite konnte nicht geöffnet werden", e);
                return;
            }
        }
        call.resolve();
    }

    /**
     * Startet den dauerhaften Keep-alive-Foreground-Service für das
     * Hintergrund-Geofencing (siehe GeofenceForegroundService) - aufgerufen
     * von backgroundGeofence.js's syncGeofences(), solange mindestens ein
     * Orts-Zeit-Wecker aktiviert ist.
     */
    @PluginMethod
    public void startGeofenceService(PluginCall call) {
        GeofenceForegroundService.start(getContext());
        call.resolve();
    }

    /** Beendet den Keep-alive-Dienst, sobald kein Orts-Zeit-Wecker mehr aktiviert ist. */
    @PluginMethod
    public void stopGeofenceService(PluginCall call) {
        GeofenceForegroundService.stop(getContext());
        call.resolve();
    }

    /**
     * Prüft, ob die App von der Akku-Optimierung ausgenommen ist. Ohne diese
     * Ausnahme kann Android (v. a. bei OEMs wie Xiaomi/Huawei/Samsung mit
     * eigenen, aggressiveren Batteriesparfunktionen) den Hintergrund-Prozess
     * trotz Foreground-Service deutlich früher einschläfern.
     */
    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        JSObject result = new JSObject();
        boolean ignoring = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager powerManager = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            ignoring = powerManager != null && powerManager.isIgnoringBatteryOptimizations(getContext().getPackageName());
        }
        result.put("ignoring", ignoring);
        call.resolve(result);
    }

    /** Zeigt den System-Dialog zur direkten Freigabe der Akku-Optimierung-Ausnahme für diese App. */
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getContext().startActivity(intent);
            } catch (Exception e) {
                call.reject("Akku-Optimierung-Dialog konnte nicht geöffnet werden", e);
                return;
            }
        }
        call.resolve();
    }
}
