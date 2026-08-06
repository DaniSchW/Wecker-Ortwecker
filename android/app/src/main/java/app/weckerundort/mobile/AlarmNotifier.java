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
 * Alarm - der EINE Codepfad dafür, für BEIDE Alarm-Arten (Standard-Wecker
 * und Orts-Zeit-Wecker, unterschieden über den "kind"-Parameter), egal ob
 * der Auslöser aus dem lebenden JS-Layer kommt
 * (LocationAlarmBridgePlugin.ringFullScreenAlarm(), aufgerufen von
 * alarms.js/locationAlarms.js), aus dem rein nativen Geofence-Empfänger
 * (WeckerOrtsweckerApplication, nur kind=location, wenn der App-Prozess
 * beim Auslösen vollständig beendet war) oder aus AlarmRingService selbst
 * (Wiederaufnahme nach einer Klingel-Pause bzw. Abschluss ohne Reaktion).
 *
 * Nutzt dieselben Benachrichtigungskanäle (alarm_both/alarm_sound/
 * alarm_vibration), die js/notifications.js beim App-Start bereits mit
 * Importance.HIGH (tatsächlich sogar MAX=5) und eigenem Sound
 * (alarm_default) anlegt - Android-Benachrichtigungskanäle überleben
 * Prozess-/App-Neustarts, sind also auch in einem frisch gestarteten
 * Prozess ohne jemals gestartete Activity bereits vorhanden, sofern die App
 * mindestens einmal geöffnet wurde.
 */
final class AlarmNotifier {

    private static final String TAG = "WeckerOrtswecker";

    static final String CHANNEL_BOTH = "alarm_both";
    static final String CHANNEL_SOUND = "alarm_sound";
    static final String CHANNEL_VIBRATION = "alarm_vibration";

    static final String KIND_LOCATION = "location";
    static final String KIND_STANDARD = "standard";

    // Basiswert, damit die Notification-ID pro Alarm stabil, aber von
    // anderen Benachrichtigungs-IDs (Hintergrund-Standort-Anzeige des
    // Plugins) unterscheidbar bleibt.
    private static final int NOTIFICATION_ID_BASE = 90_000;
    private static final int NOTIFICATION_ID_RANGE = 10_000;

    private AlarmNotifier() {}

    /**
     * Wird ausschließlich vom rein nativen Geofence-Empfänger aufgerufen
     * (siehe WeckerOrtsweckerApplication) - NICHT aus JS, daher immer
     * kind=location (der Standard-Wecker hat keinen entsprechenden rein
     * nativen Auslösepfad, siehe README). Prüft daher zuerst, ob die
     * JS-Pipeline in diesem Prozess bereits geladen ist: falls ja,
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
     * diese Zusatzregeln erneut zu prüfen. Siehe README.
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
            int ringDurationSec = payload.optInt("ringDurationSec", 60);
            int pauseDurationSec = payload.optInt("pauseDurationSec", 300);
            int maxCycles = payload.optInt("maxCycles", 3);

            postAlarmNotification(
                context,
                KIND_LOCATION,
                alarmId,
                locationId,
                title,
                description,
                sound,
                enter,
                ringDurationSec,
                pauseDurationSec,
                maxCycles
            );
        } catch (Exception e) {
            Log.e(TAG, "Geofence-Transition (nativer Pfad) konnte nicht verarbeitet werden", e);
        }
    }

    /**
     * Löst einen kompletten neuen Alarm-Klingel-Vorgang aus: postet die
     * Vollbild-Notification und startet AlarmRingService (Zyklus 1). Wird
     * von LocationAlarmBridgePlugin.ringFullScreenAlarm() (JS-Aufruf, beide
     * Alarm-Arten) sowie von handleGeofenceTransition() aufgerufen.
     */
    static void postAlarmNotification(
        Context context,
        String kind,
        String alarmId,
        String locationId,
        String title,
        String description,
        String sound,
        boolean enter,
        int ringDurationSec,
        int pauseDurationSec,
        int maxCycles
    ) {
        buildAndPost(context, kind, alarmId, locationId, title, description, sound, enter, true);
        AlarmRingService.start(
            context,
            kind,
            alarmId,
            locationId,
            title,
            description,
            sound,
            enter,
            ringDurationSec,
            pauseDurationSec,
            maxCycles
        );
    }

    /**
     * Postet NUR die Vollbild-Notification erneut (ohne AlarmRingService neu
     * zu starten) - aufgerufen von AlarmRingService bei Wiederaufnahme nach
     * einer Klingel-Pause, damit der Bildschirm wieder aufweckt, falls er
     * zwischenzeitlich ausgegangen ist (setFullScreenIntent ist der einzige
     * von Android sanktionierte Weg, eine Activity aus einem
     * Hintergrund-/Service-Kontext heraus über den Sperrbildschirm zu
     * zeigen bzw. den Bildschirm einzuschalten).
     */
    static void repost(
        Context context,
        String kind,
        String alarmId,
        String locationId,
        String title,
        String description,
        String sound,
        boolean enter
    ) {
        buildAndPost(context, kind, alarmId, locationId, title, description, sound, enter, true);
    }

    /**
     * Ersetzt die laufende Vollbild-Notification durch eine normale,
     * wegwischbare Benachrichtigung - aufgerufen von AlarmRingService, wenn
     * die maximale Anzahl Klingel-Zyklen ohne Nutzer-Interaktion erreicht
     * wurde, damit der Nutzer auch später noch sieht, dass ein Alarm
     * ausgelöst (aber nicht bestätigt) wurde.
     */
    static void postMissedNotification(
        Context context,
        String kind,
        String alarmId,
        String locationId,
        String title,
        String description,
        String sound
    ) {
        buildAndPost(context, kind, alarmId, locationId, title, description, sound, false, false);
    }

    private static void buildAndPost(
        Context context,
        String kind,
        String alarmId,
        String locationId,
        String title,
        String description,
        String sound,
        boolean enter,
        boolean fullScreen
    ) {
        Context appContext = context.getApplicationContext();
        String channelId = channelFor(sound);
        int requestCode = notificationRequestCode(kind, alarmId, locationId);

        Intent launchIntent = new Intent(appContext, MainActivity.class);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        if (fullScreen) {
            launchIntent.setAction(MainActivity.ACTION_OPEN_ALARM);
            launchIntent.setFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP
            );
            launchIntent.putExtra(MainActivity.EXTRA_KIND, kind);
            launchIntent.putExtra(MainActivity.EXTRA_ALARM_ID, alarmId);
            launchIntent.putExtra(MainActivity.EXTRA_LOCATION_ID, locationId);
            launchIntent.putExtra(MainActivity.EXTRA_TITLE, title);
            launchIntent.putExtra(MainActivity.EXTRA_DESCRIPTION, description);
            launchIntent.putExtra(MainActivity.EXTRA_SOUND, sound);
            launchIntent.putExtra(MainActivity.EXTRA_ENTER, enter);
        } else {
            // Verpasste-Alarm-Hinweis: tippen soll die App nur normal
            // oeffnen, nicht erneut den (laengst beendeten) Klingel-Vorgang
            // ausloesen.
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        }
        PendingIntent contentPendingIntent = PendingIntent.getActivity(appContext, requestCode, launchIntent, piFlags);

        String displayTitle = title == null || title.trim().isEmpty() ? defaultTitle(appContext, kind) : title;
        String displayText = description == null || description.trim().isEmpty() ? defaultBody(appContext, kind) : description;
        if (!fullScreen) {
            displayText = displayText + appContext.getString(R.string.alarm_missed_notification_suffix);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(appContext, channelId)
            .setSmallIcon(smallIconRes(appContext))
            .setContentTitle(displayTitle)
            .setContentText(displayText)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setOngoing(fullScreen)
            .setContentIntent(contentPendingIntent);

        if (fullScreen) {
            // setFullScreenIntent(): Android zeigt den Alarm-Bildschirm bei
            // gesperrtem/ausgeschaltetem Bildschirm automatisch als Vollbild
            // an; ist das Gerät entsperrt und aktiv, wird stattdessen eine
            // Heads-up-Benachrichtigung angezeigt (Systemverhalten, siehe
            // README zu USE_FULL_SCREEN_INTENT/Android 14).
            builder.setFullScreenIntent(contentPendingIntent, true);
        }

        try {
            NotificationManagerCompat.from(appContext).notify(NOTIFICATION_ID_BASE + requestCode, builder.build());
        } catch (SecurityException e) {
            // POST_NOTIFICATIONS (Android 13+) wurde nicht erteilt - der
            // native Alarm-Ton/Vibration-Dienst läuft trotzdem weiter, nur
            // ohne sichtbare Benachrichtigung/Vollbild-Ansicht.
            Log.e(TAG, "Benachrichtigungsberechtigung fehlt, poste keine Notification", e);
        }
    }

    private static String defaultTitle(Context context, String kind) {
        return KIND_STANDARD.equals(kind)
            ? context.getString(R.string.alarm_default_title)
            : context.getString(R.string.location_alarm_default_title);
    }

    private static String defaultBody(Context context, String kind) {
        return KIND_STANDARD.equals(kind)
            ? context.getString(R.string.alarm_notification_body)
            : context.getString(R.string.location_alarm_notification_body);
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

    private static int notificationRequestCode(String kind, String alarmId, String locationId) {
        String key = kind + "::" + alarmId + "::" + (locationId == null ? "" : locationId);
        return Math.abs(key.hashCode()) % NOTIFICATION_ID_RANGE;
    }

    static boolean canUseFullScreenIntent(Context context) {
        if (Build.VERSION.SDK_INT < 34) return true;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        return manager != null && manager.canUseFullScreenIntent();
    }
}
