package app.weckerundort.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import java.util.Calendar;

/**
 * Rein nativer Backup-Ausloeser für den Standard-Wecker, analog zu
 * WeckerOrtsweckerApplication für den Orts-Zeit-Wecker: Zusätzlich zur
 * normalen @capacitor/local-notifications-Planung (die zuverlässig, aber
 * NUR eine einmalige System-Benachrichtigung mit Kanal-Standardton postet
 * - auch bei komplett beendetem App-Prozess, siehe TimedNotificationPublisher
 * im Plugin) stellt alarms.js für jeden aktiven Wecker EIGENSTÄNDIG einen
 * zweiten, direkt in nativem Code verwalteten AlarmManager-Alarm, der
 * GENAU DIESEN Empfänger anspricht (siehe LocationAlarmBridgePlugin.
 * scheduleStandardAlarm()). Das Plugin selbst kann dafür nicht
 * "mitbenutzt" werden, da sein TimedNotificationPublisher-Empfänger über
 * einen EXPLIZITEN Intent (feste Zielklasse) angesprochen wird - Android
 * lässt dabei keine weiteren Empfänger "mithören".
 *
 * Läuft (wie jeder manifest-registrierte BroadcastReceiver) auch dann,
 * wenn Android für die Zustellung einen frischen, minimalen Prozess
 * starten muss - das ist der einzige Weg, den vollen Vollbild-/
 * Dauerklingel-Mechanismus (AlarmNotifier/AlarmRingService) auch beim
 * Standard-Wecker zuverlässig auszulösen, unabhängig davon, ob die App
 * beim Auslöse-Zeitpunkt lief.
 */
public class StandardAlarmReceiver extends BroadcastReceiver {

    private static final String TAG = "WeckerOrtswecker";
    private static final int REQUEST_CODE_BASE = 80_000;

    static final String EXTRA_ALARM_ID = "alarmId";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_DESCRIPTION = "description";
    static final String EXTRA_SOUND = "sound";
    static final String EXTRA_RING_DURATION_SEC = "ringDurationSec";
    static final String EXTRA_PAUSE_DURATION_SEC = "pauseDurationSec";
    static final String EXTRA_MAX_CYCLES = "maxCycles";
    static final String EXTRA_HOUR = "hour";
    static final String EXTRA_MINUTE = "minute";
    static final String EXTRA_WEEKDAYS = "weekdays";

    @Override
    public void onReceive(Context context, Intent intent) {
        String alarmId = intent.getStringExtra(EXTRA_ALARM_ID);
        if (alarmId == null || alarmId.isEmpty()) return;

        // Laeuft die JS-Pipeline bereits (App im Vorder- oder Hintergrund,
        // Prozess lebt), uebernimmt alarms.js's handleFire() ueber den
        // regulaeren @capacitor/local-notifications-Empfangspfad die
        // Ausloesung - dieser rein native Pfad ist ausschliesslich fuer den
        // Fall gedacht, dass der Prozess komplett beendet war. Ohne diese
        // Pruefung wuerde derselbe Alarm doppelt ausgeloest.
        if (!LocationAlarmBridgePlugin.isJsPipelineLoaded()) {
            String title = intent.getStringExtra(EXTRA_TITLE);
            String description = intent.getStringExtra(EXTRA_DESCRIPTION);
            String sound = intent.getStringExtra(EXTRA_SOUND);
            int ringDurationSec = intent.getIntExtra(EXTRA_RING_DURATION_SEC, 60);
            int pauseDurationSec = intent.getIntExtra(EXTRA_PAUSE_DURATION_SEC, 300);
            int maxCycles = intent.getIntExtra(EXTRA_MAX_CYCLES, 3);
            try {
                AlarmNotifier.postAlarmNotification(
                    context,
                    AlarmNotifier.KIND_STANDARD,
                    alarmId,
                    null,
                    title,
                    description,
                    sound != null ? sound : "both",
                    true,
                    ringDurationSec,
                    pauseDurationSec,
                    maxCycles
                );
            } catch (Exception e) {
                Log.e(TAG, "StandardAlarmReceiver: Ausloesung fehlgeschlagen", e);
            }
        }

        // Wiederholende Wecker (Wochentage ausgewaehlt) selbst fuer den
        // naechsten Termin neu stellen - @capacitor/local-notifications
        // macht das fuer seine EIGENE (einmalige Benachrichtigungs-)Planung
        // bereits selbst, dieser Backup-Alarm muss das unabhaengig davon
        // ebenfalls tun, da sonst nach dem ersten Ausloesen keine weitere
        // Wiederholung mehr geplant waere.
        int[] weekdays = intent.getIntArrayExtra(EXTRA_WEEKDAYS);
        if (weekdays != null && weekdays.length > 0) {
            int hour = intent.getIntExtra(EXTRA_HOUR, 0);
            int minute = intent.getIntExtra(EXTRA_MINUTE, 0);
            long next = computeNextTrigger(weekdays, hour, minute);
            if (next > 0) {
                schedule(context, intent, next);
            }
        }
    }

    private static long computeNextTrigger(int[] weekdays, int hour, int minute) {
        long now = System.currentTimeMillis();
        long best = -1;
        for (int weekday : weekdays) {
            // Calendar.DAY_OF_WEEK (1=Sonntag..7=Samstag) entspricht exakt
            // der von Capacitor verwendeten Wochentag-Nummerierung (siehe
            // notifications.js's toCapacitorWeekday()) - keine Umrechnung noetig.
            Calendar candidate = Calendar.getInstance();
            candidate.setTimeInMillis(now);
            candidate.set(Calendar.HOUR_OF_DAY, hour);
            candidate.set(Calendar.MINUTE, minute);
            candidate.set(Calendar.SECOND, 0);
            candidate.set(Calendar.MILLISECOND, 0);
            int diff = weekday - candidate.get(Calendar.DAY_OF_WEEK);
            if (diff < 0) diff += 7;
            candidate.add(Calendar.DAY_OF_MONTH, diff);
            if (candidate.getTimeInMillis() <= now) {
                candidate.add(Calendar.DAY_OF_MONTH, 7);
            }
            long candidateMillis = candidate.getTimeInMillis();
            if (best < 0 || candidateMillis < best) {
                best = candidateMillis;
            }
        }
        return best;
    }

    static void schedule(Context context, Intent sourceIntent, long triggerAtMillis) {
        Context appContext = context.getApplicationContext();
        AlarmManager alarmManager = (AlarmManager) appContext.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        String alarmId = sourceIntent.getStringExtra(EXTRA_ALARM_ID);
        Intent intent = new Intent(appContext, StandardAlarmReceiver.class);
        intent.putExtras(sourceIntent);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            piFlags |= PendingIntent.FLAG_MUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getBroadcast(appContext, requestCode(alarmId), intent, piFlags);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }
        } catch (SecurityException e) {
            Log.e(TAG, "StandardAlarmReceiver: Backup-Alarm konnte nicht geplant werden", e);
        }
    }

    static void cancel(Context context, String alarmId) {
        Context appContext = context.getApplicationContext();
        AlarmManager alarmManager = (AlarmManager) appContext.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;
        Intent intent = new Intent(appContext, StandardAlarmReceiver.class);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_NO_CREATE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            piFlags |= PendingIntent.FLAG_MUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getBroadcast(appContext, requestCode(alarmId), intent, piFlags);
        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent);
            pendingIntent.cancel();
        }
    }

    private static int requestCode(String alarmId) {
        return REQUEST_CODE_BASE + (Math.abs((alarmId == null ? "" : alarmId).hashCode()) % 10_000);
    }
}
