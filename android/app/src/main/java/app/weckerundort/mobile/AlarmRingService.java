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
import android.os.IBinder;
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
 * auch bei aktiviertem "Nicht stören"/Lautlos-Modus klingeln können (der
 * Nutzer steuert diese Lautstärke separat über die Alarm-Lautstärke-Regelung
 * des Systems, nicht über den Klingelton-/Medien-Regler).
 *
 * Läuft als Foreground-Service, damit Android die Wiedergabe nicht sofort
 * abwürgt, solange der Nutzer den Alarm noch nicht im Klingel-Bildschirm
 * gestoppt hat (Swipe-Geste ruft LocationAlarmBridgePlugin.stopAlarmSound()
 * auf, siehe locationRinging.js).
 */
public class AlarmRingService extends Service {

    private static final String TAG = "WeckerOrtswecker";
    private static final String CHANNEL_ID = "location_alarm_ring_service";
    private static final int FOREGROUND_NOTIFICATION_ID = 90_500;
    private static final String EXTRA_SOUND = "sound";

    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;

    static void start(Context context, String sound) {
        Intent intent = new Intent(context, AlarmRingService.class);
        intent.putExtra(EXTRA_SOUND, sound);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

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

        String sound = intent != null ? intent.getStringExtra(EXTRA_SOUND) : "both";
        boolean wantsSound = !"vibration".equals(sound) && !"silent".equals(sound);
        boolean wantsVibration = !"sound".equals(sound);

        if (wantsSound) startAlarmSound();
        if (wantsVibration) startAlarmVibration();

        // START_NOT_STICKY: Wird der Prozess während des Klingelns beendet,
        // soll der Dienst nicht automatisch neu gestartet werden - der
        // eigentliche Alarm-Auslöser (Geofence-Transition) würde in diesem
        // Fall ohnehin erneut über den nativen Empfänger laufen.
        return START_NOT_STICKY;
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
                // dauerhaft, bis stopAlarmSound() den Dienst beendet.
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0), attributes);
            } else {
                vibrator.vibrate(pattern, 0);
            }
        } catch (Exception e) {
            Log.e(TAG, "AlarmRingService: Vibration konnte nicht gestartet werden", e);
        }
    }

    @Override
    public void onDestroy() {
        releaseMediaPlayer();
        if (vibrator != null) {
            vibrator.cancel();
            vibrator = null;
        }
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
            .setSmallIcon(LocationAlarmNotifier.smallIconRes(this))
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .build();
    }
}
