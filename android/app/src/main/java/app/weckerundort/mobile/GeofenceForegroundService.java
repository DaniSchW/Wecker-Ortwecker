package app.weckerundort.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * Reiner "Keep-alive"-Dienst für das Hintergrund-Geofencing des Orts-Zeit-
 * Weckers, analog zu Fitness-Tracker-/Navigations-Apps: Die eigentliche
 * Geofence-Überwachung läuft bereits systemseitig über Google Play Services
 * (siehe @capgo/background-geolocation, GeofencingClient + PendingIntent) und
 * würde auch ohne diesen Dienst grundsätzlich funktionieren - ein aktiver
 * Foreground-Service mit dauerhafter Notification erhöht aber zusätzlich die
 * Prozess-Priorität und signalisiert aggressiven OEM-Batteriesparfunktionen
 * (Xiaomi/Huawei/Samsung u. Ä.), dass die App bewusst im Hintergrund aktiv
 * bleiben soll, statt als "inaktiv" eingestuft und stärker gedrosselt zu
 * werden.
 *
 * Start/Stop erfolgt über LocationAlarmBridgePlugin, gesteuert von
 * locationAlarms.js's syncTracking() - läuft, solange mindestens ein
 * Orts-Zeit-Wecker aktiviert ist.
 */
public class GeofenceForegroundService extends Service {

    private static final String CHANNEL_ID = "location_alarm_geofence_service";
    private static final int FOREGROUND_NOTIFICATION_ID = 90_501;

    static void start(Context context) {
        Intent intent = new Intent(context, GeofenceForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    static void stop(Context context) {
        context.stopService(new Intent(context, GeofenceForegroundService.class));
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ensureServiceChannel();
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0;
        ServiceCompat.startForeground(this, FOREGROUND_NOTIFICATION_ID, buildForegroundNotification(), type);

        // START_STICKY: Wird der Prozess vom System hart beendet (z. B. unter
        // Speicherdruck), soll Android diesen Dienst - und damit den Prozess -
        // möglichst automatisch mit einem leeren Intent neu starten, solange
        // noch mindestens ein Orts-Zeit-Wecker aktiviert ist. Ein erzwungenes
        // Beenden durch den Nutzer selbst (Force-Stop/aus der Übersicht
        // wischen mit anschließendem System-Kill) kann kein Code umgehen -
        // das bleibt eine Android-Systemgrenze.
        return START_STICKY;
    }

    private void ensureServiceChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.geofence_service_channel_name),
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription(getString(R.string.geofence_service_channel_description));
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private Notification buildForegroundNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.geofence_service_notification_title))
            .setContentText(getString(R.string.geofence_service_notification_text))
            .setSmallIcon(LocationAlarmNotifier.smallIconRes(this))
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }
}
