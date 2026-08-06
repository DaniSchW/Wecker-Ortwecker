package app.weckerundort.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * Spielt Ton UND Vibration eigenständig ab (MediaPlayer + Vibrator-API),
 * unabhängig vom Benachrichtigungskanal-Sound und unabhängig von
 * System-Lautstärke-/Lautlos-Profilen - genau wie native Wecker-Apps, die
 * über den separaten Alarm-Lautstärke-Kanal (AudioAttributes.USAGE_ALARM)
 * auch bei aktiviertem "Nicht stören"/Lautlos-Modus klingeln können.
 *
 * Verwaltet außerdem den kompletten Dauerklingel-Ablauf (Klingeln - Pause -
 * erneutes Klingeln, bis zu maxCycles-mal) EIGENSTÄNDIG über einen eigenen
 * Handler-Timer, statt sich auf eine automatische Beendigung durch das
 * System zu verlassen. Gilt für BEIDE Alarm-Arten (Standard-Wecker und
 * Orts-Zeit-Wecker, siehe "kind"-Extra) - die Zyklus-/Ton-/Vibrationslogik
 * selbst ist unabhängig davon, welche Art Alarm sie ausgelöst hat.
 *
 * Läuft als Foreground-Service über die GESAMTE Dauer aller Zyklen
 * (Klingeln UND Pausen), damit Android den Dienst nicht abwürgt, solange
 * der Nutzer den Alarm noch nicht im Klingel-Bildschirm gestoppt hat
 * (Swipe-Geste ruft LocationAlarmBridgePlugin.stopAlarmSound() auf, siehe
 * locationRinging.js/ringing.js).
 */
public class AlarmRingService extends Service {

    private static final String TAG = "WeckerOrtswecker";
    private static final String CHANNEL_ID = "location_alarm_ring_service";
    private static final int FOREGROUND_NOTIFICATION_ID = 90_500;

    private static final String EXTRA_KIND = "kind";
    private static final String EXTRA_ALARM_ID = "alarmId";
    private static final String EXTRA_LOCATION_ID = "locationId";
    private static final String EXTRA_TITLE = "title";
    private static final String EXTRA_DESCRIPTION = "description";
    private static final String EXTRA_SOUND = "sound";
    private static final String EXTRA_ENTER = "enter";
    private static final String EXTRA_RING_DURATION_SEC = "ringDurationSec";
    private static final String EXTRA_PAUSE_DURATION_SEC = "pauseDurationSec";
    private static final String EXTRA_MAX_CYCLES = "maxCycles";

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private final Handler handler = new Handler(Looper.getMainLooper());

    private String kind;
    private String alarmId;
    private String locationId;
    private String title;
    private String description;
    private String sound;
    private boolean enter;
    private long ringDurationMs;
    private long pauseDurationMs;
    private int maxCycles;
    private int currentCycle;

    static void start(
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
        Intent intent = new Intent(context, AlarmRingService.class);
        intent.putExtra(EXTRA_KIND, kind);
        intent.putExtra(EXTRA_ALARM_ID, alarmId);
        intent.putExtra(EXTRA_LOCATION_ID, locationId);
        intent.putExtra(EXTRA_TITLE, title);
        intent.putExtra(EXTRA_DESCRIPTION, description);
        intent.putExtra(EXTRA_SOUND, sound);
        intent.putExtra(EXTRA_ENTER, enter);
        intent.putExtra(EXTRA_RING_DURATION_SEC, ringDurationSec);
        intent.putExtra(EXTRA_PAUSE_DURATION_SEC, pauseDurationSec);
        intent.putExtra(EXTRA_MAX_CYCLES, maxCycles);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    /** Beendet den gesamten Klingel-Vorgang sofort (Swipe-zum-Stoppen im Overlay). */
    static void stop(Context context) {
        context.stopService(new Intent(context, AlarmRingService.class));
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ensureServiceChannel();
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
        ServiceCompat.startForeground(this, FOREGROUND_NOTIFICATION_ID, buildForegroundNotification(), type);

        // Verwirft einen evtl. noch laufenden vorherigen Zyklus (z. B. wenn
        // derselbe Alarm doppelt ausgelöst wurde), bevor neu gestartet wird.
        handler.removeCallbacksAndMessages(null);
        releaseMediaPlayer();
        cancelVibration();

        if (intent != null) {
            kind = intent.getStringExtra(EXTRA_KIND);
            alarmId = intent.getStringExtra(EXTRA_ALARM_ID);
            locationId = intent.getStringExtra(EXTRA_LOCATION_ID);
            title = intent.getStringExtra(EXTRA_TITLE);
            description = intent.getStringExtra(EXTRA_DESCRIPTION);
            sound = intent.getStringExtra(EXTRA_SOUND);
            enter = intent.getBooleanExtra(EXTRA_ENTER, true);
            ringDurationMs = intent.getIntExtra(EXTRA_RING_DURATION_SEC, 60) * 1000L;
            pauseDurationMs = intent.getIntExtra(EXTRA_PAUSE_DURATION_SEC, 300) * 1000L;
            maxCycles = intent.getIntExtra(EXTRA_MAX_CYCLES, 3);
        }
        if (kind == null) kind = AlarmNotifier.KIND_LOCATION;
        if (sound == null) sound = "both";
        if (maxCycles < 1) maxCycles = 1;

        currentCycle = 1;
        enterRingPhase();

        // START_NOT_STICKY: Wird der Prozess während des Klingelns beendet,
        // soll der Dienst nicht automatisch neu gestartet werden - der
        // eigentliche Alarm-Auslöser (Geofence-Transition/geplante
        // Benachrichtigung) würde in diesem Fall ohnehin erneut auslösen.
        return START_NOT_STICKY;
    }

    /** Startet Ton/Vibration für den aktuellen Klingel-Zyklus, oder beendet die Sitzung, falls maxCycles erreicht. */
    private void enterRingPhase() {
        if (currentCycle > maxCycles) {
            finishSession();
            return;
        }
        if (currentCycle > 1) {
            // Bildschirm ggf. erneut aufwecken (siehe AlarmNotifier.repost) -
            // er könnte während der vorherigen Pause wieder ausgegangen sein.
            AlarmNotifier.repost(getApplicationContext(), kind, alarmId, locationId, title, description, sound, enter);
        }

        boolean wantsSound = !"vibration".equals(sound) && !"silent".equals(sound);
        boolean wantsVibration = !"sound".equals(sound);
        if (wantsSound) startAlarmSound();
        if (wantsVibration) startAlarmVibration();

        handler.postDelayed(this::enterPausePhase, ringDurationMs);
    }

    /** Beendet Ton/Vibration für die Pause zwischen zwei Zyklen, plant die Wiederaufnahme oder das Sitzungsende. */
    private void enterPausePhase() {
        releaseMediaPlayer();
        cancelVibration();
        currentCycle++;
        if (currentCycle > maxCycles) {
            finishSession();
            return;
        }
        handler.postDelayed(this::enterRingPhase, pauseDurationMs);
    }

    /** Letzter Zyklus ohne Nutzer-Interaktion verstrichen - Alarm verstummt endgültig. */
    private void finishSession() {
        releaseMediaPlayer();
        cancelVibration();
        AlarmNotifier.postMissedNotification(getApplicationContext(), kind, alarmId, locationId, title, description, sound);
        LocationAlarmBridgePlugin.notifyAlarmExpired(kind, alarmId, locationId);
        stopSelf();
    }

    private void startAlarmSound() {
        if (mediaPlayer != null) return;
        try {
            mediaPlayer = new MediaPlayer();
            AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            mediaPlayer.setAudioAttributes(attributes);
            Uri uri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.alarm_default);
            mediaPlayer.setDataSource(this, uri);
            mediaPlayer.setLooping(true);
            mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                Log.e(TAG, "AlarmRingService: MediaPlayer-Fehler what=" + what + " extra=" + extra);
                releaseMediaPlayer();
                return true;
            });
            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception e) {
            Log.e(TAG, "AlarmRingService: Alarmton konnte nicht gestartet werden", e);
            releaseMediaPlayer();
        }
    }

    private void startAlarmVibration() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager manager = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                vibrator = manager != null ? manager.getDefaultVibrator() : null;
            } else {
                vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (vibrator == null || !vibrator.hasVibrator()) return;

            long[] pattern = { 0, 500, 300, 500, 300 };
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioAttributes attributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build();
                // repeat=0: wiederholt die Sequenz ab Index 0, laeuft also
                // dauerhaft, bis die Pause-Phase sie wieder abbricht.
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0), attributes);
            } else {
                vibrator.vibrate(pattern, 0);
            }
        } catch (Exception e) {
            Log.e(TAG, "AlarmRingService: Vibration konnte nicht gestartet werden", e);
        }
    }

    private void cancelVibration() {
        if (vibrator == null) return;
        try {
            vibrator.cancel();
        } catch (Exception ignored) {
            // Vibrator-Zustand war bereits inkonsistent - egal, wird gleich verworfen.
        }
        vibrator = null;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        releaseMediaPlayer();
        cancelVibration();
        super.onDestroy();
    }

    private void releaseMediaPlayer() {
        if (mediaPlayer == null) return;
        try {
            if (mediaPlayer.isPlaying()) mediaPlayer.stop();
        } catch (Exception ignored) {
            // Zustand des MediaPlayer war bereits inkonsistent - release()
            // reicht trotzdem aus, um die Ressourcen sauber freizugeben.
        }
        mediaPlayer.release();
        mediaPlayer = null;
    }

    private void ensureServiceChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.location_alarm_ring_service_channel_name),
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription(getString(R.string.location_alarm_ring_service_channel_description));
        manager.createNotificationChannel(channel);
    }

    private Notification buildForegroundNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.location_alarm_ring_service_notification_text))
            .setSmallIcon(AlarmNotifier.smallIconRes(this))
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .build();
    }
}
