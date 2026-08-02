package app.weckerundort.mobile;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONObject;

/**
 * Baut und postet die Vollbild-Alarm-Notification für einen ausgelösten
 * Orts-Zeit-Wecker - der EINE Codepfad dafür, egal ob der Auslöser aus dem
 * lebenden JS-Layer kommt (LocationAlarmBridgePlugin.ringFullScreenAlarm(),
 * aufgerufen von locationAlarms.js, wenn die App nicht im Vordergrund ist)
 * oder direkt aus dem rein nativen Geofence-Empfänger
 * (WeckerOrtsweckerApplication), wenn der App-Prozess beim Auslösen
 * vollständig beendet war und kein JS existiert.
 *
 * Nutzt dieselben Benachrichtigungskanäle (alarm_both/alarm_sound/
 * alarm_vibration), die js/notifications.js beim App-Start bereits mit
 * Importance.HIGH (tatsächlich sogar MAX=5) und eigenem Sound
 * (alarm_default) anlegt - Android-Benachrichtigungskanäle überleben
 * Prozess-/App-Neustarts, sind also auch in einem frisch gestarteten
 * Prozess ohne jemals gestartete Activity bereits vorhanden, sofern die App
 * mindestens einmal geöffnet wurde (Voraussetzung, um überhaupt einen
 * Orts-Zeit-Wecker anzulegen).
 */
final class LocationAlarmNotifier {

    private static final String TAG = "WeckerOrtswecker";

    static final String CHANNEL_BOTH = "alarm_both";
    static final String CHANNEL_SOUND = "alarm_sound";
    static final String CHANNEL_VIBRATION = "alarm_vibration";

    // Basiswert, damit die Notification-ID pro Alarm/Ort stabil, aber von
    // anderen Benachrichtigungs-IDs (Standard-Wecker via
    // @capacitor/local-notifications, Hintergrund-Standort-Anzeige des
    // Plugins) unterscheidbar bleibt.
    private static final int NOTIFICATION_ID_BASE = 90_000;
    private static final int NOTIFICATION_ID_RANGE = 10_000;

    private LocationAlarmNotifier() {}

    /**
     * Wird ausschließlich vom rein nativen Geofence-Empfänger aufgerufen
     * (siehe WeckerOrtsweckerApplication) - NICHT aus JS. Prüft daher zuerst,
     * ob die JS-Pipeline in diesem Prozess bereits geladen ist: falls ja,
     * übernimmt geoTrigger.js/locationAlarms.js (inkl. vollständiger
     * Wiederholungstyp- und Pendel-Zeitfenster-Prüfung) die Entscheidung und
     * ruft im Bedarfsfall selbst ringFullScreenAlarm() auf - ansonsten würde
     * derselbe Alarm doppelt ausgelöst.
     *
     * WICHTIG - bekannte Einschränkung: Ist die JS-Pipeline NICHT geladen
     * (App-Prozess war beim Auslösen komplett beendet), fehlt hier der
     * Zugriff auf den in localStorage geführten Zustand (Wiederholungstyp
     * "einmalig bereits ausgelöst", periodische Zeiträume, Pendel-
     * Zeitfenster) - dieser Pfad löst dann für JEDE zur registrierten
     * Richtung (Ankunft/Abfahrt, siehe backgroundGeofence.js/
     * notifyOnEntry/notifyOnExit) passende Geofence-Transition aus, ohne
     * diese Zusatzregeln erneut zu prüfen. In der Praxis harmlos für die
     * häufigsten Fälle (einmalige/permanente Alarme ohne Pendel-Fenster),
     * kann aber in Randfällen (z. B. erneutes Betreten eines Orts nach
     * bereits ausgelöstem "einmalig"-Alarm, während die App die ganze Zeit
     * beendet blieb) zu einem zusätzlichen Klingeln führen. Siehe README.
     */
    static void handleGeofenceTransition(Context context, JSONObject data) {
        if (LocationAlarmBridgePlugin.isJsPipelineLoaded()) {
            Log.d(TAG, "Geofence-Transition: JS-Pipeline aktiv, überlasse ihr die Entscheidung");
            return;
        }
        try {
            JSONObject payload = data.optJSONObject("payload");
            if (payload == null) return;
            String alarmId = payload.optString("alarmId", null);
            String locationId = payload.optString("locationId", null);
            if (alarmId == null || alarmId.isEmpty() || locationId == null || locationId.isEmpty()) return;

            String title = payload.optString("title", "");
            String description = payload.optString("description", "");
            String sound = payload.optString("sound", "both");
            boolean enter = data.optBoolean("enter", true);

            postAlarmNotification(context, alarmId, locationId, title, description, sound, enter);
        } catch (Exception e) {
            Log.e(TAG, "Geofence-Transition (nativer Pfad) konnte nicht verarbeitet werden", e);
        }
    }

    /** Wird von LocationAlarmBridgePlugin.ringFullScreenAlarm() (JS-Aufruf) aufgerufen. */
    static void postAlarmNotification(
        Context context,
        String alarmId,
        String locationId,
        String title,
        String description,
        String sound,
        boolean enter
    ) {
        Context appContext = context.getApplicationContext();
        String channelId = channelFor(sound);
        int requestCode = notificationRequestCode(alarmId, locationId);

        Intent alarmIntent = new Intent(appContext, MainActivity.class);
        alarmIntent.setAction(MainActivity.ACTION_OPEN_LOCATION_ALARM);
        alarmIntent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        alarmIntent.putExtra(MainActivity.EXTRA_ALARM_ID, alarmId);
        alarmIntent.putExtra(MainActivity.EXTRA_LOCATION_ID, locationId);
        alarmIntent.putExtra(MainActivity.EXTRA_TITLE, title);
        alarmIntent.putExtra(MainActivity.EXTRA_DESCRIPTION, description);
        alarmIntent.putExtra(MainActivity.EXTRA_SOUND, sound);
        alarmIntent.putExtra(MainActivity.EXTRA_ENTER, enter);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(appContext, requestCode, alarmIntent, piFlags);

        String displayTitle = title == null || title.trim().isEmpty()
            ? appContext.getString(R.string.location_alarm_default_title)
            : title;
        String displayText = description == null || description.trim().isEmpty()
            ? appContext.getString(R.string.location_alarm_notification_body)
            : description;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(appContext, channelId)
            .setSmallIcon(smallIconRes(appContext))
            .setContentTitle(displayTitle)
            .setContentText(displayText)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setOngoing(true)
            .setContentIntent(fullScreenPendingIntent)
            // setFullScreenIntent(): Android zeigt den Alarm-Bildschirm bei
            // gesperrtem/ausgeschaltetem Bildschirm automatisch als Vollbild
            // an; ist das Gerät entsperrt und aktiv, wird stattdessen eine
            // Heads-up-Benachrichtigung angezeigt (Systemverhalten, siehe
            // README zu USE_FULL_SCREEN_INTENT/Android 14).
            .setFullScreenIntent(fullScreenPendingIntent, true);

        try {
            NotificationManagerCompat.from(appContext).notify(NOTIFICATION_ID_BASE + requestCode, builder.build());
        } catch (SecurityException e) {
            // POST_NOTIFICATIONS (Android 13+) wurde nicht erteilt - der
            // native Alarm-Ton/Vibration-Dienst läuft trotzdem weiter, nur
            // ohne sichtbare Benachrichtigung/Vollbild-Ansicht.
            Log.e(TAG, "Benachrichtigungsberechtigung fehlt, poste keine Notification", e);
        }

        AlarmRingService.start(appContext, sound);
    }

    static String channelFor(String sound) {
        if ("vibration".equals(sound) || "silent".equals(sound)) return CHANNEL_VIBRATION;
        if ("sound".equals(sound)) return CHANNEL_SOUND;
        return CHANNEL_BOTH;
    }

    static int smallIconRes(Context context) {
        int id = context.getResources().getIdentifier("ic_stat_location_alarm", "drawable", context.getPackageName());
        if (id != 0) return id;
        // Fallback auf ein Android-Systemsymbol, solange kein eigenes
        // monochromes Status-Icon gestaltet wurde (siehe README, Abschnitt
        // App-Icon - dieselbe bereits dokumentierte Einschränkung).
        return android.R.drawable.ic_lock_idle_alarm;
    }

    private static int notificationRequestCode(String alarmId, String locationId) {
        return Math.abs((alarmId + "::" + locationId).hashCode()) % NOTIFICATION_ID_RANGE;
    }

    static boolean canUseFullScreenIntent(Context context) {
        if (Build.VERSION.SDK_INT < 34) return true;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        return manager != null && manager.canUseFullScreenIntent();
    }
}
