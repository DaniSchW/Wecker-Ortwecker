package app.weckerundort.mobile;

import android.app.Application;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.util.Log;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;
import org.json.JSONObject;

/**
 * Registriert beim Prozessstart einen Empfänger für die Geofence-Transition-
 * Broadcasts von @capgo/background-geolocation - unabhängig davon, ob dieser
 * Prozessstart durch das Öffnen der App oder nur durch die Zustellung eines
 * Broadcasts ausgelöst wurde (z. B. wenn die App zuvor vom Nutzer aus den
 * Recents entfernt und vom System vollständig beendet wurde). Application.
 * onCreate() läuft in JEDEM Fall als Erstes, bevor irgendeine andere
 * Komponente in diesem Prozess aktiv wird - das ist der einzige zuverlässige
 * Ort, um Orts-Zeit-Wecker-Auslösungen auch dann zu erkennen, wenn nie eine
 * Activity/WebView in diesem Prozess existiert hat.
 *
 * Das Plugin-eigene Bridge-Objekt (BackgroundGeolocation.java) registriert
 * denselben Broadcast-Empfang zusätzlich noch einmal in seiner load()-Methode,
 * die nur läuft, wenn die Capacitor-Bridge/Activity tatsächlich erstellt
 * wurde - das ist der Pfad, über den die bestehende JS-Logik (geoTrigger.js/
 * locationAlarms.js, inkl. Wiederholungstyp- und Pendel-Zeitfenster-Prüfung)
 * weiterhin die volle Kontrolle behält, solange der Prozess lebt. Um
 * Doppelauslösungen zu vermeiden, prüft LocationAlarmNotifier deshalb
 * LocationAlarmBridgePlugin.isJsPipelineLoaded(), bevor er selbst aktiv wird.
 */
public class WeckerOrtsweckerApplication extends Application {

    private static final String TAG = "WeckerOrtswecker";

    // Muss exakt den vom Plugin verwendeten Action-Strings entsprechen (siehe
    // GeofenceStore.ACTION_GEOFENCE_EVENT im Plugin-Quellcode, node_modules/
    // @capgo/background-geolocation) - dort nicht öffentlich exportiert,
    // daher hier als Literal dupliziert. Ändert sich das Plugin, muss dieser
    // String entsprechend nachgezogen werden.
    private static final String ACTION_GEOFENCE_EVENT = "com.capgo.capacitor_background_geolocation.geofence";
    private static final String ACTION_GEOFENCE_ERROR = "com.capgo.capacitor_background_geolocation.geofence.error";
    private static final String EXTRA_GEOFENCE_PAYLOAD = "payload";

    @Override
    public void onCreate() {
        super.onCreate();

        IntentFilter filter = new IntentFilter(ACTION_GEOFENCE_EVENT);
        filter.addAction(ACTION_GEOFENCE_ERROR);

        LocalBroadcastManager.getInstance(this).registerReceiver(
            new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if (ACTION_GEOFENCE_ERROR.equals(intent.getAction())) {
                        // Fehlerfälle (z. B. GEOFENCE_NOT_AVAILABLE) betreffen nur die
                        // native Ortsüberwachung selbst, nicht das Auslösen eines
                        // Alarms - hier bewusst nichts weiter zu tun.
                        return;
                    }
                    String payload = intent.getStringExtra(EXTRA_GEOFENCE_PAYLOAD);
                    if (payload == null || payload.isEmpty()) return;
                    try {
                        LocationAlarmNotifier.handleGeofenceTransition(context, new JSONObject(payload));
                    } catch (Exception e) {
                        Log.e(TAG, "Geofence-Transition-Payload konnte nicht verarbeitet werden", e);
                    }
                }
            },
            filter
        );
    }
}
