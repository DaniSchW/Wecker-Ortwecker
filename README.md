# Wecker & Ortswecker

Native Android-App (Capacitor + HTML/CSS/Vanilla JS) mit Standard-Wecker,
Orts-Zeit-Wecker (Geofencing), Stoppuhr und Timer.

- App-ID: `app.weckerundort.mobile`
- Plattform: Android (iOS vorerst nicht geplant)
- Sprachen: Deutsch (Standard), Englisch

## Status

**Phase 1 – Projektgrundgerüst** ist umgesetzt:

- Capacitor-Projekt mit Android-Plattform (`android/`)
- 4-Tab-Navigation (Wecker, Orts-Zeit-Wecker, Stoppuhr, Timer)
- i18n-Grundgerüst DE/EN (`www/i18n/`)
- Dark-Mode-Design-Basis (`www/css/style.css`, natives Android-Theme)

**Phase 2 – Standard-Wecker, Stoppuhr, Timer** ist umgesetzt:

- **Wecker**: Anlegen/Bearbeiten/Löschen über ein Modal, feste Uhrzeit,
  Wiederholung nach Wochentagen (oder einmalig), Auswahl Ton/Vibration/Beides,
  Ein/Aus-Schalter direkt auf der Kachel. Scheduling läuft über
  `@capacitor/local-notifications` (ein System-Alarm pro gewähltem Wochentag,
  bzw. ein einmaliger Alarm ohne Wiederholung).
- **Alarm-Klingeln-Overlay**: Vollbildschirm mit Titel/Uhrzeit, Ton (Web-Audio-Beep)
  und Vibration (`@capacitor/haptics`) je nach Einstellung, Stopp per Swipe-Geste.
- **Stoppuhr**: Start/Stopp/Reset, Rundenzeiten (Rundenzeit + Gesamtzeit) als Liste,
  Ringanzeige animiert eine volle Umdrehung pro Minute.
- **Timer**: Mehrere parallele, unabhängige Timer mit eigenem Label als Kacheln
  untereinander, Start/Pause/Reset je Timer, Fertig-Signal mit Ton/Vibration,
  Hintergrund-Benachrichtigung über lokale Notifications.
- **Timer-Tab, Modus "Intervall (Tabata)"**: zweite Betriebsart neben dem
  einfachen Timer. Presets mit Belastungs-/Pausenzeit, Rundenanzahl und
  optionaler Vorbereitungszeit; Ablauf Vorbereitung → (Belastung ↔ Pause) ×
  Runden → Abschluss mit vier unterscheidbaren Signaltönen (Vorbereitung-Start,
  „Los", Wechsel zur Pause, Abschluss). Große, aus der Distanz lesbare
  Phasen-/Zeit-/Rundenanzeige, Start/Pause/Reset wie bei der Stoppuhr, läuft
  komplett im Vordergrund ohne Abhängigkeit von Phase 4. Kein Swipe-Stopp
  nötig – der Ablauf endet nach der letzten Runde automatisch.

Bekannte Einschränkung: Ein echtes, systemweites Vollbild-Alarmklingeln über den
Sperrbildschirm hinweg (wie bei der nativen Android-Uhr-App), während die App
vollständig beendet ist, benötigt zusätzlichen nativen Code (`AlarmManager` +
`fullScreenIntent`-Activity) über die Capacitor-Standardplugins hinaus. Das aktuelle
Overlay öffnet sich zuverlässig, sobald die App im Vorder-/Hintergrund läuft oder
über die System-Benachrichtigung geöffnet wird – der Feinschliff für den
Sperrbildschirm-Fall ist für Phase 4/7 (echtes Gerät) vorgesehen.

**Phase 3 – Orts-Zeit-Wecker (Kernfeature)** ist umgesetzt:

- **Editor**: Titel (Pflicht), Beschreibung, ein oder mehrere Orte über Karte
  (Pin setzen/verschieben, Leaflet + OpenStreetMap-Kacheln, lokal vendored in
  `www/vendor/leaflet/`) und Text-Adresssuche (Geocoding/Autovervollständigung
  über die Nominatim-API), gemeinsamer einstellbarer Radius für die ganze
  Ortsgruppe, Trigger Ankunft/Abfahrt wählbar.
- **Wiederholungstyp**: einmalig / permanent / periodisch (täglich, wöchentlich,
  monatlich, freier Zeitraum in Tagen) – löst nur beim ersten Erreichen im
  aktuellen Zeitraum aus.
- **Pendel-Filter**: optional kombinierbar mit Wochentagen + Uhrzeitfenster
  (z. B. Bushaltestellen-Alarm nur Mo–Fr in einem Zeitfenster).
- **Trigger-Logik**: `@capacitor/geolocation` (`watchPosition`) wertet die
  Bedingungen im Vordergrund aus (Haversine-Distanz, Ankunft/Abfahrt-Erkennung
  je Ort in der Gruppe, Perioden-Reset). Echtes Background-Geofencing über ein
  natives Plugin ist bewusst Phase 4 vorbehalten.
- **Auslöse-Bildschirm**: Werbefläche (~50 % der Höhe, echtes AdMob-Banner
  seit Phase 6), Titel + Beschreibung darunter, Stopp per Swipe,
  Ton/Vibration/Beides wie beim Standard-Wecker (gemeinsame Logik in
  `www/js/alarmSound.js`).

Bekannte Einschränkung: Die Nominatim-Geocoding-API ist ein kostenloser Dienst
mit Nutzungsrichtlinien (Rate-Limits); für produktiven Einsatz in größerem
Maßstab sollte ein dedizierter Geocoding-Anbieter mit eigenem API-Key
eingeplant werden. Echtes Background-Geofencing (App im Hintergrund/
geschlossen) folgt in Phase 4.

**Phase 4 – Background-Geofencing (Android)** ist umgesetzt:

- **Plugin**: [`@capgo/background-geolocation`](https://github.com/Cap-go/capacitor-background-geolocation)
  (MPL-2.0, kostenlos, aktiv gepflegt passend zu Capacitor 8) statt eigenem
  nativen Code oder einer kostenpflichtigen Lösung (Transistor Software) –
  siehe Abwägung unten.
- **Berechtigungs-Flow**: Ein Erklärungs-Dialog (`#background-permission-modal`)
  wird gezeigt, sobald ein Orts-Zeit-Wecker aktiviert wird und die
  Hintergrund-Standort-Berechtigung noch fehlt; erst danach fragt die App
  aktiv über `requestPermissions({ permissions: ['backgroundLocation'] })`.
  „Später" merkt sich die Ablehnung für diese Installation (kein erneutes
  Nerven bei jedem Toggle).
- **Native Geofences**: `js/backgroundGeofence.js` spiegelt alle aktivierten
  Orts-Zeit-Wecker-Orte als native Android-Geofences (Google Play Services,
  über das Plugin). Die Kennung kodiert `alarmId::locationId`, sodass eine
  Transition eindeutig auf Alarm+Ort zurückgeführt werden kann.
- **Gemeinsame Trigger-Logik**: `js/geoTrigger.js` wurde so refaktoriert, dass
  sowohl der Vordergrund-Pfad (`watchPosition` + Distanzberechnung, Phase 3)
  als auch der neue Hintergrund-Pfad (native Enter/Exit-Events) über dieselbe
  Funktion (`applyLocationState`) entscheiden, ob ein Alarm auslöst
  (Perioden-Reset, Pendel-Filter, Ankunft/Abfahrt) – dadurch kein doppeltes
  Auslösen, egal welcher Pfad zuerst reagiert.
- **Auslösung im Hintergrund**: Ist die App beim Auslösen nicht sichtbar
  (`document.visibilityState !== 'visible'`), wird statt des Overlays direkt
  eine lokale Benachrichtigung gezeigt (`@capacitor/local-notifications`,
  gleicher Kanal wie beim Standard-Wecker). Deren Antippen (oder Eintreffen,
  während die App doch im Vordergrund ist) öffnet über denselben
  `Notify.onFire`-Mechanismus wie Wecker/Timer das Auslöse-Overlay.

**Warum `@capgo/background-geolocation` statt eigenem Code oder Transistor:**
Eigener nativer Kotlin/Java-Code (BroadcastReceiver, GeofencingClient) hätte
sich in dieser Umgebung ohne Android-SDK/Gerät nicht kompilieren oder testen
lassen – Bugs wären erst auf einem echten Gerät aufgefallen. Die kommerzielle
Transistor-Software-Lösung ist ausgereift, verursacht aber Lizenzkosten. Das
gewählte Plugin ist kostenlos, wird aktiv für Capacitor 8 gepflegt und bietet
eine fertige, von vielen Apps genutzte Geofencing-API – das senkt das Risiko
gegenüber selbst geschriebenem, ungetestetem nativen Code erheblich.

### Bekannte Grenzen / was noch nicht verifiziert ist

Nichts aus Phase 4 wurde auf einem echten Android-Gerät getestet (in dieser
Umgebung steht kein Android-SDK/Emulator/Gerät zur Verfügung – auch kein
Gradle-Build wurde ausgeführt). Konkret ungetestet:

- Ob die native Geofence-Registrierung tatsächlich Enter/Exit-Events liefert
  und die App nach Neustart/Reboot (`GeofenceBootReceiver` des Plugins) die
  Orte erneut überwacht.
- Akkuverbrauch und Verhalten unter Androids Doze-Modus/App-Standby.
- OEM-spezifische aggressive Akku-Manager (Xiaomi/MIUI, Huawei, Oppo, u. a.),
  die Foreground-Services trotz korrekter Implementierung killen können –
  das ist eine bekannte Android-Ökosystem-Einschränkung, die selbst
  kommerzielle Plugins nur durch Nutzerhinweise ("bitte Akku-Optimierung für
  diese App deaktivieren") abmildern, nicht vollständig lösen können.
- Das native Android-Limit von 100 Geofences pro App (bei einer persönlichen
  Nutzung mit wenigen Orts-Zeit-Weckern unkritisch, aber nicht getestet).
- Die tatsächliche System-Dialog-Führung bei der Berechtigungsanfrage
  (Android zeigt "Nur beim Verwenden der App" / "Immer erlauben" je nach
  Android-Version unterschiedlich; ab Android 11 muss "Immer erlauben" oft
  über die Einstellungen nachträglich gewählt werden – `openSettings()` ist
  vorbereitet, aber nicht am Gerät durchgespielt).

**Testplan für ein echtes Gerät** (vor Play-Store-Veröffentlichung
abzuarbeiten):

1. `npx cap open android`, App auf einem echten Gerät installieren (nicht nur
   Emulator, wegen Akku-/Doze-Verhalten).
2. Orts-Zeit-Wecker anlegen, Berechtigungsdialog durchlaufen, in den
   Systemeinstellungen prüfen, dass „Immer erlauben" tatsächlich gesetzt ist.
3. App aus den zuletzt verwendeten Apps wegwischen (nicht nur in den
   Hintergrund legen), zum hinterlegten Ort fahren/laufen, prüfen ob die
   Benachrichtigung erscheint und das Overlay beim Antippen öffnet.
4. Gerät über Nacht (Doze-Modus) mit aktivem Alarm stehen lassen, danach
   erneut die Auslösung testen.
5. Gerät neu starten, prüfen ob die Geofences weiterhin überwacht werden.
6. Akkuverbrauch über 24 h mit 1–3 aktiven Orts-Zeit-Weckern beobachten
   (Android-Einstellungen → Akku → App-Nutzung).
7. Auf mindestens einem Gerät mit aggressivem Akku-Management testen (z. B.
   Xiaomi/MIUI) und ggf. eine In-App-Anleitung zum Deaktivieren der
   Akku-Optimierung ergänzen, falls Auslösungen ausbleiben.
8. Play-Store-Vorbereitung: Hintergrund-Standort-Nutzung erfordert ein
   separates Google-Play-Formular ("Zugriff auf Standortdaten im Hintergrund
   beantragen") mit Begründung/Screenshots – ohne Freigabe wird die App beim
   Veröffentlichen abgelehnt.

**Phase 5 – Erweiterung: Schlummern (Snooze)** ist umgesetzt:

- Neuer „Schlummern"-Button im Klingel-Overlay des Standard-Weckers, zusätzlich
  zum bisherigen Swipe-zum-Stoppen. Swipe stoppt weiterhin vollständig, der
  neue Button schlummert.
- Pro Wecker im Editor einstellbar: Schlummern erlauben (Standard: an) und
  Schlummerdauer (5/10/15/20/30 Minuten, Standard: 10). Bereits vor Phase 5
  angelegte Wecker verhalten sich automatisch wie „Schlummern an, 10 Minuten"
  (kein Migrationsschritt nötig).
- Schlummern plant eine einzelne zusätzliche Benachrichtigung in
  `jetzt + Schlummerdauer`, unabhängig vom regulären Wiederholungs-Schedule
  des Weckers (Wochentage/Einmalig bleiben unangetastet). Ein einmaliger
  Wecker wird deshalb erst beim echten Stopp deaktiviert, nicht beim
  Schlummern.
- Wird ein Wecker gelöscht oder ausgeschaltet, während ein Schlummern
  aussteht, wird auch die geplante Schlummer-Benachrichtigung storniert.

**Phase 6 – Werbung/Monetarisierung** ist technisch umgesetzt, aber mit
Google-Test-IDs statt einem echten AdMob-Konto (siehe unten):

- **Plugin**: [`@capacitor-community/admob`](https://github.com/capacitor-community/admob)
  (aktiv gepflegt, passend zu Capacitor 8).
- **DSGVO/UMP-Einwilligung**: Beim App-Start (`js/ads.js`) läuft die von Google
  vorgeschriebene Reihenfolge `AdMob.initialize` → `requestConsentInfo` →
  `showConsentForm` (nur falls laut Konsent-Status erforderlich) → erst danach
  darf überhaupt eine Anzeige angefragt werden. Ohne erteilte/nicht-benötigte
  Einwilligung (`canRequestAds`) wird kein Banner angefragt. Deutsche
  Zielgruppe = EWR/DSGVO-Pflicht, das war hier nicht optional.
- **Banner**: Ersetzt die bisherige Text-Platzhalterfläche im
  Orts-Zeit-Wecker-Auslöse-Bildschirm (oberste ~50 % der Höhe). Format
  `MEDIUM_RECTANGLE`, Position `TOP_CENTER`, an- und abgeschaltet synchron
  mit dem Öffnen/Schließen des Klingel-Overlays. Technischer Hinweis: Der
  native Banner ist eine eigenständige Systemansicht über der WebView, kein
  DOM-Element – die reservierte Fläche im Layout bleibt daher leer, das
  Overlay legt sich optisch darüber. Im Browser/Web-Fallback (kein natives
  Plugin verfügbar) bleibt der bisherige Text-Platzhalter erhalten.
- **Einwilligung verwalten**: Kleiner Link im Orts-Zeit-Wecker-Tab
  („Werbe-Einwilligung verwalten“, nur sichtbar wenn laut AdMob nötig), öffnet
  `AdMob.showPrivacyOptionsForm()` – von Google für UMP vorgeschrieben, damit
  Nutzer ihre Einwilligung jederzeit ändern können, nicht nur beim ersten Start.

**Was noch vor einem echten Store-Release fehlt** (nicht automatisierbar ohne
Zugangsdaten, die hier nicht vorliegen):

1. In der AdMob-Konsole eigene GDPR-/UMP-Consent-Nachrichten konfigurieren
   (ohne das zeigt `requestConsentInfo` ggf. gar kein Formular an).
2. In der Play Console die Werbe-Angabe und den Data-Safety-Abschnitt
   entsprechend ausfüllen (Standortdaten + Werbe-ID werden verwendet).
3. Auf einem echten Gerät verifizieren, dass Banner tatsächlich geladen werden
   und die Einwilligungs-UI (Formular + „Einwilligung verwalten“-Link) korrekt
   erscheint – ungetestet aus demselben Grund wie Phase 4 (kein Android-SDK/
   Gerät in dieser Umgebung).

### Phase 6 Ergänzung: echte AdMob-IDs, Vorladen, Fallback

Nachtrag zur ursprünglichen Phase-6-Umsetzung, mit echten Zugangsdaten aus
einem eigenen AdMob-Konto:

- **Echte IDs**: `admob_app_id` (`strings.xml`) und `BANNER_AD_UNIT_ID`
  (`www/js/ads.js`) sind jetzt `ca-app-pub-8453553622026562~6853936501` bzw.
  `ca-app-pub-8453553622026562/4356031602` statt Googles Test-IDs. Ab jetzt
  gehen bei einem echten Gerätetest **echte** Anzeigenanfragen raus.
- **Vorladen**: `js/ads.js` lädt den Banner (versteckt, per `showBanner()` +
  sofortigem `hideBanner()`) bereits, sobald mindestens ein Orts-Zeit-Wecker
  scharf geschaltet wird (`locationAlarms.js` → `syncTracking()`), nicht erst
  beim tatsächlichen Klingeln – der genaue Auslöse-Zeitpunkt ist bei
  Geofencing ja nicht vorhersehbar. Der Ladeabschluss wird über die
  `bannerAdLoaded`/`bannerAdFailedToLoad`-Events verfolgt (nicht über das
  Promise von `showBanner()` selbst, das nur die native Entgegennahme des
  Aufrufs bestätigt, nicht den tatsächlichen Anzeigen-Erhalt).
- **Wiederverwendung statt Neuladen**: Nach dem Schließen des
  Klingel-Bildschirms wird der Banner nur versteckt (`hideBanner()`), nicht
  zerstört (`removeBanner()`) – beim nächsten Klingeln reicht dann ein
  schnelles `resumeBanner()` statt eines erneuten Ladevorgangs. Ist die
  vorgeladene Anzeige älter als 30 Minuten (`MAX_PRELOAD_AGE_MS`), wird sie
  verworfen und frisch geladen, damit keine stark veraltete Anzeige gezeigt
  wird. **Dieser 30-Minuten-Wert ist eine eigene, nicht von Google
  vorgegebene Abwägung** (Orts-Zeit-Wecker können ja auch Stunden nach dem
  Scharfschalten auslösen) – vor Live-Schaltung gegen die aktuellen
  AdMob-Richtlinien zur Anzeigen-Aktualität/Impression-Zählung prüfen.
- **Fallback bei fehlender Anzeige**: Konnte keine Anzeige geladen werden
  (z. B. keine Internetverbindung unterwegs – bei einem Orts-Zeit-Wecker ein
  realistischer Fall), zeigt `locationRinging.js` statt eines leeren
  Bereichs eine neutrale Marken-Fläche mit App-Namen
  (`.location-ringing-ad.is-fallback-brand`). Wartezeit dafür ist auf 4
  Sekunden begrenzt (`SHOW_WAIT_TIMEOUT_MS`), damit der Auslöse-Bildschirm
  nicht wegen einer langsamen Verbindung blockiert.
- **Abstand zum Swipe-Bereich**: `padding-top` von `.location-ringing-body`
  bewusst auf 40px erhöht (Puffer zwischen Werbefläche und Titel/
  Beschreibung), zusätzlich zum bereits bestehenden Abstand zum
  Swipe-Bereich weiter unten – Vorkehrung gegen AdMob-Regeln zu
  Mindestabständen zwischen Anzeigen und interaktiven Elementen. Eine
  abschließende Prüfung ist nur auf einem echten Gerät sinnvoll möglich.
- **IAP-Anknüpfungspunkt**: `ads.hasAdFreePurchase()` ist aktuell ein Stub
  (liefert immer `false`), wird aber bereits vor jedem Laden/Anzeigen
  geprüft. Für ein späteres „Werbefrei“-Feature reicht es, diese eine
  Funktion durch einen echten Kauf-Check (z. B. Google Play Billing) zu
  ersetzen.
- **Getestet** wurde die neue Statemaschine (Vorladen → Wiederverwendung →
  Verwerfen bei Alter, Fehlerfall → Fallback, Timeout-Pfad) mit einem
  simulierten nativen AdMob-Plugin per Playwright – die eigentliche
  Netzwerk-/Anzeigen-Auslieferung durch Google selbst ist damit nicht
  abgedeckt und nur auf einem echten Gerät verifizierbar.

**Phase 7 – Testing/Release** ist so weit umgesetzt, wie es ohne
Android-SDK/Gerät und ohne echte Store-/AdMob-Zugangsdaten in dieser
Umgebung möglich ist:

- **Build-Verifikation geprüft, nicht möglich:** Ein echter Gradle-Build
  würde den Download von Android-SDK-Komponenten von Google-Servern
  benötigen (`dl.google.com`, `android.clients.google.com`). Diese sind über
  die Proxy-Policy dieser Umgebung mit 403 (Org-Denial) blockiert – kein
  Workaround, da explizite Richtlinien-Entscheidung, keine technische
  Einschränkung. Der native Android-Teil des Projekts wurde daher nie
  kompiliert; das ist der wichtigste Punkt für den Testplan auf einem
  echten Gerät (siehe Checkliste unten).
- **Code-Review-Pass:** Gezielte Durchsicht aller JS-Module auf Bugs/
  Race-Conditions. Drei echte Fehler gefunden und behoben:
  - `map.js`: Beim Bearbeiten eines bestehenden Orts-Zeit-Weckers wurden
    Orts-IDs bei jedem Speichern neu vergeben statt erhalten zu bleiben –
    dadurch wurde der Ankunfts-/Abfahrts-Tracking-Zustand (`wasInside`)
    unbemerkt zurückgesetzt, was Abfahrt-Auslösungen nach einer Bearbeitung
    verschlucken konnte.
  - `alarmSound.js`: `start()` war nicht idempotent – ein doppelt
    feuerndes Notification-Event hätte das laufende Ton-/Vibrations-
    Intervall überschreiben können, sodass es sich nicht mehr stoppen ließ
    (endloses Piepsen). `start()` ist jetzt sicher mehrfach aufrufbar.
  - `ads.js`: Race Condition – wurde ein Orts-Zeit-Wecker weggewischt,
    während die (potenziell lange auf Nutzerinteraktion wartende)
    DSGVO-Einwilligung noch offen war, konnte danach trotzdem noch ein
    Banner erscheinen, obwohl der Klingel-Bildschirm längst geschlossen
    war. Per Generation-Token behoben.
  - Alle Fixes per Playwright regressionsgetestet (siehe Testergebnisse in
    der Commit-Historie).
- **Eigenes App-Icon + Splash-Screen:** Ersetzt die generischen
  Capacitor-Standard-Platzhalter (blaues „X"-Logo) durch ein selbst
  gestaltetes Wecker-Icon (passend zum dunklen App-Theme, generiert über
  `@capacitor/assets` aus den Quelldateien in `assets/`). Der bisherige
  weiße Standard-Splash wäre beim App-Start als Blitzer gegen das dunkle
  Theme aufgefallen – auch das ist jetzt konsistent dunkel.
- **Release-Signing vorbereitet, kein echter Schlüssel erzeugt:** Das
  Erzeugen eines Signing-Keys ist eine sicherheitskritische,
  unumkehrbare Entscheidung, die dem Projektinhaber gehören muss (ein
  verlorener/kompromittierter Schlüssel bedeutet dauerhaften Verlust der
  Fähigkeit, Updates für dieselbe App im Play Store zu veröffentlichen) –
  das wurde hier bewusst nicht automatisiert. Stattdessen: fertiges
  Signing-Gerüst in `android/app/build.gradle`, das eine git-ignorierte
  `android/keystore.properties` erwartet (Vorlage:
  `android/keystore.properties.example`). Ohne diese Datei bleibt der
  Release-Build unsigniert (z. B. für CI-Kompilierchecks ohne
  Veröffentlichung).
- **ProGuard/R8 bewusst deaktiviert gelassen** (`minifyEnabled false`):
  Capacitor-Plugins registrieren teils über Reflection; ohne die
  Möglichkeit, einen minifizierten Build tatsächlich zu testen, wäre das
  Risiko eines kaputten Release-Builds größer als der Vorteil einer
  kleineren APK.
- **Versionsnummern**: `versionCode 1` / `versionName "1.0.0"`
  (`android/app/build.gradle`), passend zu `package.json`.
- **Datenschutzerklärung** (`PRIVACY.md`): Entwurf basierend auf den
  tatsächlichen Datenflüssen der App (Standort lokal ausgewertet,
  Nominatim/OSM-Netzwerkanfragen, AdMob/UMP). Mit deutlich markierten
  Platzhaltern für Anbieterkennzeichnung/Kontakt, die nur der
  Projektinhaber ausfüllen kann – **kein** rechtsverbindlicher Text, vor
  Veröffentlichung rechtlich prüfen lassen und auf einer öffentlich
  erreichbaren URL hosten (Play Store verlangt eine URL, keine Datei im
  Repo).

### Konsolidierte Checkliste vor der Store-Veröffentlichung

Fasst alle über die Phasen verteilten „vor Release nötig"-Punkte zusammen:

**Technisch / Build**
1. `npx cap sync android`, Projekt in Android Studio öffnen, echten
   Gradle-Build durchführen (hier nie geschehen – höchste Priorität, da der
   native Teil inkl. aller Plugin-Manifest-Merges ungetestet ist).
2. Signing-Key erzeugen (`keytool -genkeypair -v -keystore release.keystore
   -alias weckerundort -keyalg RSA -keysize 2048 -validity 10000`), sicher
   verwahren/sichern (Passwort-Manager + Backup – bei Verlust ist die App
   im Play Store nicht mehr aktualisierbar), `android/keystore.properties`
   aus der `.example`-Vorlage befüllen.
3. Signierten Release-Build/App Bundle erzeugen und auf einem echten Gerät
   installieren und durchtesten (nicht nur Emulator, wegen Akku-/
   Doze-Verhalten).
4. Optional: `minifyEnabled true` erst NACH erfolgreichem Test des
   signierten Release-Builds evaluieren (kleinere APK, aber Regressionsrisiko
   bei Reflection-basierten Plugins).

**Standort/Hintergrund (Phase 4)**
5. Testplan aus Phase 4 abarbeiten: Berechtigungsdialog, App aus Recents
   wegwischen + Auslösung testen, Doze-Modus über Nacht, Geräte-Neustart,
   Akkuverbrauch über 24 h, mindestens ein Gerät mit aggressivem
   Akku-Management (Xiaomi/MIUI o. ä.).
6. Google-Play-Formular „Zugriff auf Standortdaten im Hintergrund"
   ausfüllen (ohne Freigabe wird die App abgelehnt).
7. Vollbild-Alarm-Ergänzung (siehe Abschnitt oben) auf einem echten
   Android-14+-Gerät verifizieren: Hinweis-Dialog erscheint, Einstellungen-
   Weiterleitung funktioniert, und alle vier Testfälle (gesperrt,
   Bildschirm aus, Hintergrund, komplett beendet) tatsächlich einen
   Vollbild-Alarm mit Ton/Vibration auslösen - inkl. mindestens eines
   Geräts mit aggressivem Akku-Management (Prozess-Killing-Verhalten
   variiert stark zwischen Herstellern).
8. Ergänzung "Zuverlässiger Hintergrundbetrieb" (siehe Abschnitt oben) auf
   einem echten Gerät verifizieren: dauerhafte "Orts-Zeit-Wecker aktiv"-
   Notification erscheint beim Aktivieren, Akku-Optimierung-Hinweisdialog
   öffnet den richtigen System-Dialog, und der Dienst überlebt (per
   `START_STICKY`) einen erzwungenen Prozess-Kill unter Speicherdruck -
   inkl. Google-Play-Formular-Begründung für
   `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.
9. Ergänzung "Echtes Dauerklingeln" (siehe Abschnitt oben) auf einem
   echten Gerät verifizieren, für BEIDE Alarm-Arten: Klingel-Pause-Zyklen
   laufen wie konfiguriert ab (globale Standardwerte UND Pro-Alarm-
   Override testen), Bildschirm wacht bei jeder Zyklus-Wiederaufnahme
   zuverlässig wieder auf, "Verpasst"-Benachrichtigung erscheint nach dem
   letzten erfolglosen Zyklus, Swipe-zum-Stoppen beendet den kompletten
   Vorgang (nicht nur den aktuellen Zyklus) zuverlässig in jeder Phase
   (Klingeln UND Pause).

**Werbung/Monetarisierung (Phase 6)**
7. Echtes AdMob-Konto anlegen, App registrieren, echte App-ID/Ad-Unit-ID in
   `android/app/src/main/res/values/strings.xml` (`admob_app_id`) und
   `BANNER_AD_UNIT_ID` in `www/js/ads.js` eintragen.
8. GDPR-/UMP-Consent-Nachrichten in der AdMob-Konsole konfigurieren.
9. Auf echtem Gerät verifizieren: Banner lädt, Consent-Formular erscheint,
   „Werbe-Einwilligung verwalten" funktioniert.

**Store-Listing / Rechtliches**
10. `PRIVACY.md` mit echten Anbieterangaben füllen, rechtlich prüfen lassen,
    öffentlich hosten, URL in der Play-Console-Store-Eintragung hinterlegen.
11. Play-Console Data-Safety-Abschnitt ausfüllen (Standort, Werbe-ID,
    Geräte-ID – passend zu `PRIVACY.md`).
12. Store-Listing erstellen: Kurz-/Vollbeschreibung, Screenshots (auf
    echtem Gerät nach Punkt 3 aufnehmen), Content-Rating-Fragebogen
    (Werbung, Standortzugriff).
13. App-Icon/Store-Grafiken final prüfen – das neue Icon
    (`assets/icon-*.png`) ist ein erster fertiger Entwurf, kein
    zwingend endgültiges Markenzeichen; bei Bedarf durch professionelles
    Design ersetzen.

### Export-/Import-Funktion für Wecker-Daten (Sicherung/Wiederherstellung)

Über ein neues Zahnrad-Icon im Header (`Einstellungen`) lassen sich alle
gespeicherten Standard-Wecker und Orts-Zeit-Wecker als JSON-Datei sichern
und daraus wiederherstellen – unabhängig vom normalen App-Update-Prozess,
z. B. als Absicherung vor einer Neuinstallation. Explizit **nicht**
enthalten sind Timer/Tabata-Presets (laut Aufgabenstellung nur Wecker +
Orts-Zeit-Wecker).

- **Plugin-Wahl**: Für einen echten SAF-„Speicherort wählen"-Dialog
  (`ACTION_CREATE_DOCUMENT`) gibt es kein aktiv gepflegtes
  Capacitor-8-Plugin mit klarer API. Stattdessen die Kombination aus
  offiziellen, aktiv gepflegten Plugins gewählt:
  `@capacitor/filesystem` schreibt die Sicherungsdatei ins
  App-private `Directory.Cache` (keine zusätzliche Android-Berechtigung
  nötig), `@capacitor/share` öffnet danach das native Android-Share-Sheet
  – der Nutzer wählt darüber effektiv das Ziel (z. B. „In Dateien
  speichern", Google Drive, E-Mail an sich selbst). Für den Import kommt
  `@capawesome/capacitor-file-picker` zum Einsatz (Dateiauswahl-Dialog).
  Alle drei sind gegen Capacitor 8 kompatibel; keines der drei verlangt
  zusätzliche `<uses-permission>`-Einträge im Manifest.
- **Web-Fallback**: Ohne natives Plugin (Browser-Vorschau) läuft Export
  über einen Blob-Download (`<a download>`), Import über ein verstecktes
  `<input type="file">` + `FileReader`.
- **Datenformat**: `{ app: 'wecker-ortswecker', exportVersion: 1,
  exportedAt: <ISO-Zeitstempel>, alarms: [...], locationAlarms: [...] }`
  – die rohen `storage.js`-Datensätze, unverändert. `app`/`exportVersion`
  werden beim Import geprüft; eine Datei ohne diese Kennung wird als
  ungültig abgelehnt statt sie ungeprüft zu übernehmen.
- **Import ist nicht-destruktiv**: Datensätze werden per `id` einzeln
  per `upsert` eingespielt (bestehende, nicht in der Sicherung enthaltene
  Wecker bleiben erhalten; Wecker mit übereinstimmender ID werden
  überschrieben). Es wird nie die komplette lokale Liste ersetzt.
- **Reschedule nach Import**: Importierte Wecker/Orts-Zeit-Wecker
  enthalten ggf. `notificationIds`, die auf einer frischen Installation
  gar nicht (mehr) existieren. Nach dem Import werden deshalb
  `alarmsTab.rescheduleAll()` (storniert alte IDs, plant alle aktiven
  Wecker neu) und `locationAlarmsTab.resyncAll()` (Neuzeichnen der
  Kacheln + `syncTracking()` für Vordergrund-Geolocation und native
  Geofences) aufgerufen.
- **Unicode**: Die Basis64-kodierten Datei-Inhalte vom File-Picker-Plugin
  werden über `TextDecoder('utf-8')` dekodiert (nicht per einfachem
  `atob()`), damit Umlaute/Sonderzeichen in Bezeichnungen/Beschreibungen
  korrekt erhalten bleiben – mit Playwright-Testdaten verifiziert.
- **Getestet** wurde der komplette Web-Fallback-Roundtrip (Export →
  Storage leeren, simuliert Neuinstallation → Import → Datenintegrität,
  Reschedule, UI-Refresh) sowie der Fehlerfall einer ungültigen/fremden
  JSON-Datei per Playwright. Der native Pfad (Filesystem/Share/
  File-Picker-Plugin) ist – wie alle nativen Plugins in diesem Projekt –
  nur auf einem echten Gerät abschließend verifizierbar, da hier kein
  Android-SDK/Gerät zur Verfügung steht.

### Geocoding-Ergänzung im Ort-Textfeld (Orts-Zeit-Wecker)

Die Adresssuche im Kartenauswahl-Widget (`js/map.js`) gab es schon seit
Phase 3 (Nominatim-Anfrage + klickbare Trefferliste); folgende Punkte wurden
gezielt ergänzt:

- **Automatischer Pin**: Der jeweils beste Treffer wird jetzt direkt als Pin
  auf der Karte gesetzt (nicht mehr erst nach Klick auf einen Listeneintrag
  nötig). Tippt der Nutzer weiter und die Anfrage liefert ein neues
  Ergebnis, wird derselbe Pin verschoben statt einen weiteren anzuhäufen –
  dafür merkt sich `map.js` die ID des zuletzt automatisch gesetzten Orts
  (`autoMarkerId`) und aktualisiert nur diesen. Die Trefferliste bleibt
  weiterhin sichtbar, falls der Nutzer statt des Top-Treffers einen anderen
  Treffer meint (z. B. gleichnamige Straße in einer anderen Stadt) – ein
  Klick darauf verschiebt ebenfalls nur den einen Pin, statt einen weiteren
  hinzuzufügen. Wird der Pin danach manuell auf der Karte verschoben oder
  über die Orte-Liste entfernt, "löst" er sich von der Automatik – eine
  neue Suche legt dann wieder einen frischen Pin an, statt den vom Nutzer
  bewusst gesetzten zu überschreiben. Ein Tippen/Tap direkt auf die Karte
  fügt weiterhin immer einen unabhängigen, zusätzlichen Ort hinzu (mehrere
  Orte pro Orts-Zeit-Wecker sind ja ein bestehendes Feature).
- **Debounce auf 500 ms**: Die Anfrage läuft frühestens 500 ms nach dem
  letzten Tastenanschlag (vorher 400 ms), um die Anfragen-Rate gegenüber
  Nominatim niedrig zu halten. Zusätzlich verwirft ein einfacher
  Token-Zähler veraltete Antworten, falls trotz Debounce eine ältere
  Anfrage nach einer neueren beantwortet wird.
- **Fehleranzeige im UI**: Statt Fehler/leere Trefferlisten wie bisher
  still zu verwerfen, zeigt ein Hinweistext unter dem Suchfeld jetzt
  „Adresse nicht gefunden – Pin manuell auf der Karte setzen." (keine
  Treffer) bzw. „Keine Internetverbindung – Pin manuell auf der Karte
  setzen." (Netzwerk-/HTTP-Fehler) an. Ein bereits gesetzter Pin bleibt in
  beiden Fällen unangetastet erhalten.
- **User-Agent-Header**: Nominatims Nutzungsbedingungen verlangen einen
  aussagekräftigen User-Agent oder Referer zur Identifikation der
  Anwendung. Im Browser lässt sich der `User-Agent`-Header aus
  Sicherheitsgründen grundsätzlich nicht per `fetch()` überschreiben (von
  keiner Web-App, nicht nur dieser) – dort identifiziert sich die Anfrage
  weiterhin über den echten Browser-User-Agent. Auf einem echten Gerät
  läuft die Anfrage stattdessen über das in `@capacitor/core` eingebaute
  `CapacitorHttp`-Plugin (kein Zusatzpaket nötig), das nativ anfragt und
  beliebige Header inkl. `User-Agent` setzen kann. Der aktuelle Wert
  (`WeckerOrtswecker/1.0.0 (app.weckerundort.mobile; Kontakt:
  [PLATZHALTER: E-Mail-Adresse])`, `js/map.js`) enthält bewusst denselben
  Platzhalter-Hinweis wie schon `PRIVACY.md` – vor Live-Schaltung durch
  eine echte Kontaktadresse ersetzen.
- **Getestet** wurde der komplette Web-Fallback-Ablauf (Treffer → Pin
  setzen, weiterer Treffer → Pin verschieben statt duplizieren, Klick auf
  Alternativtreffer, keine Treffer → Fehlertext, Netzwerkfehler →
  Fehlertext, manueller Kartenklick bleibt unabhängig, Debounce/Race
  vermeidet Mehrfachanfragen, zu kurze Eingabe löst keine Anfrage aus) per
  Playwright mit gemockten Nominatim-Antworten, da `nominatim.
  openstreetmap.org` von dieser Umgebung aus nicht erreichbar ist. Der
  native `CapacitorHttp`-Pfad wurde separat mit einem gemockten
  `CapacitorHttp`-Plugin verifiziert (korrekter `User-Agent`-Header,
  Fehlerbehandlung bei HTTP-Fehlerstatus) – die tatsächliche
  Netzwerk-Auslieferung auf einem echten Gerät ist wie bei allen nativen
  Integrationen in diesem Projekt nur dort abschließend prüfbar.

### Werbefläche fest auf 50% Bildschirmhöhe (Alarm-Auslöse-Bildschirm)

Nachtrag zur Werbefläche im Orts-Zeit-Wecker-Klingel-Bildschirm
(`.location-ringing-ad`, `www/css/style.css` + `www/js/ads.js`):

- **Container per CSS hart auf exakt 50% fixiert**: `flex: 0 0 50%` allein
  reicht nicht ganz aus – ohne `min-height: 0` und `overflow: hidden`
  können Flex-Items über ihre Flex-Basis hinauswachsen, wenn der Inhalt
  (z. B. ein langer Fallback-Text auf einem kurzen/querformatigen
  Bildschirm) mehr Platz beansprucht als die vorgegebenen 50% (bekannte
  Flexbox-Falle: die automatische Mindesthöhe eines Flex-Items ist
  standardmäßig seine Inhaltsgröße, nicht 0). Mit beiden Eigenschaften
  ergänzt bleibt die Fläche nachweislich exakt 50% – per Playwright in
  Hochformat und einem extremen Querformat-/Kurzbildschirm-Fall
  gegengeprüft, jeweils im "Anzeige geladen"- und im "Fallback"-Zustand.
- **AdSize auf `ADAPTIVE_BANNER` umgestellt** (vorher `MEDIUM_RECTANGLE`):
  `@capacitor-community/admob` ruft dafür intern exakt
  `AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize()` auf (siehe
  `BannerExecutor.java` im Plugin) – die von der Aufgabenstellung
  vorgeschlagene Google-API wird also tatsächlich verwendet, allerdings
  indirekt über das Plugin, nicht direkt aus JS aufrufbar.
- **Technische Grenze, die sich nicht auflösen ließ**: Die API des
  Plugins (`BannerAdOptions.adSize`) akzeptiert ausschließlich die festen
  Enum-Werte (`BANNER`, `FULL_BANNER`, `LARGE_BANNER`,
  `MEDIUM_RECTANGLE`, `LEADERBOARD`, `ADAPTIVE_BANNER`, `SMART_BANNER`) –
  eine eigene Pixel-/dp-Höhe lässt sich darüber **nicht** an die native
  AdView übergeben, es gibt keinen "CUSTOM"-Größentyp. Das AdMob-SDK selbst
  kennt für Banner-Anzeigen kein Format, das buchstäblich 50% der
  Bildschirmhöhe ausfüllt (Adaptive Banner sind i. d. R. 50–100dp hoch,
  MEDIUM_RECTANGLE fix 250dp) – ein Anzeigentyp mit derart großer,
  frei bestimmbarer Höhe wäre technisch kein Banner mehr, sondern ein
  anderer AdMob-Anzeigentyp (z. B. Interstitial), oder würde eine eigene
  native Erweiterung dieses Plugins erfordern (Google bietet dafür in der
  nativen SDK zwar `getInlineAdaptiveBannerAdSize(width, maxHeight)` an,
  dieses Plugin bindet diese neuere API aber nicht ein). Die per CSS exakt
  auf 50% fixierte Fläche ist daher weiterhin eine **reservierte
  Höchstfläche**, in der die (kleinere) tatsächliche Anzeige oben
  verankert wird (`TOP_CENTER`, `margin: 0`) – nicht die exakte
  Anzeigengröße selbst. Das ist unverändert gegenüber der ursprünglichen
  Phase-6-Umsetzung, nur jetzt mit einem Format, das eher der
  Bildschirmbreite entspricht und tendenziell eine höhere Füllrate als
  MEDIUM_RECTANGLE hat.
- **Fallback-Fläche verschiebt nichts**: Da Anzeige und Fallback-Text
  dasselbe `#location-ringing-ad`-Element nur unterschiedlich befüllen
  (die native Anzeige selbst wird ohnehin als eigenständige Systemansicht
  über der WebView eingeblendet, nicht ins DOM eingehängt), ist die
  50%-Höhe in beiden Zuständen automatisch identisch – per Test
  bestätigt.

### Werbung jetzt auch im Standard-Wecker-Klingel-Bildschirm

**Bewusste Abkehr von der ursprünglichen Phase-6-Vorgabe**: Bis hierhin
war Werbung explizit auf den Orts-Zeit-Wecker-Auslöse-Bildschirm
beschränkt ("keine Werbung in Standard-Wecker/Stoppuhr/Timer/Tabata/...").
Auf ausdrücklichen Wunsch zeigt jetzt auch der Klingel-Bildschirm des
normalen Weckers (`#ringing-overlay`, `www/js/ringing.js`) dieselbe
Werbefläche nach demselben Muster wie der Orts-Zeit-Wecker – Stoppuhr,
Timer, Tabata und alle übrigen Bildschirme bleiben weiterhin werbefrei.

- **ads.js generalisiert**: `preloadLocationRingingBanner()` /
  `showLocationRingingBanner()` / `hideLocationRingingBanner()` in
  `preloadRingingBanner()` / `showRingingBanner()` / `hideRingingBanner()`
  umbenannt – es gibt weiterhin nur eine einzige native Banner-Instanz für
  die ganze App (Statemaschine unverändert), die sich jetzt beide
  Klingel-Bildschirme teilen. Das ist unkritisch, da beide Bildschirme
  sich gegenseitig ausschließen (immer nur einer sichtbar).
- **ringing.js** erhielt dieselbe Lade-/Fallback-Logik wie
  `locationRinging.js` (`setAdFallback()`, `showRingingBanner()` beim
  Zeigen, `hideRingingBanner()` beim Schließen/Schlummern).
- **Vorladen für Standard-Wecker**: `alarms.js` bekam eine neue
  `maybePreloadRingingBanner()`-Funktion (aufgerufen nach jedem
  Ein-/Ausschalten, Speichern, Löschen und beim Start), die genau wie bei
  den Orts-Zeit-Weckern lädt, sobald mindestens ein Wecker scharf ist.
- **CSS/HTML vereinheitlicht**: `.location-ringing-ad`/
  `.location-ringing-body` sind jetzt generisch `.ringing-ad`/
  `.ringing-body` (von beiden Klingel-Bildschirmen genutzt); der
  Standard-Wecker-Bildschirm wurde auf dieselbe Grundstruktur umgestellt
  (Werbefläche fest oben auf 50%, restlicher Inhalt darunter, Swipe-Bereich
  als eigenes Element ganz unten) statt der vorherigen freien
  `justify-content: space-between`-Verteilung über den ganzen Bildschirm.
  Der i18n-Schlüssel `locationAlarm.adPlaceholder` (Web-Vorschau-Text) heißt
  jetzt `ringing.adPlaceholder`.
- **Getestet** per Playwright (gemocktes AdMob-Plugin): 50%-Höhe in
  geladenem und Fallback-Zustand für beide Klingel-Bildschirme, Vorladen
  bei aktivem Standard-Wecker, Web-Vorschau-Platzhaltertext für beide
  Bildschirme, vollständige Regressionssuite weiterhin ohne Fehler.

### Layout-Härtung: Swipe-Bereich bleibt garantiert erreichbar

Ergänzung zur 50%-Werbefläche: Das Klingel-Bildschirm-Layout (beide
Varianten) wurde defensiv gegen ungewöhnliche Kombinationen aus
Bildschirmgröße, Banner-Zustand und langem Titel-/Beschreibungstext
gehärtet, damit der Swipe-Bereich zum Stoppen des Alarms **niemals**
unerreichbar/aus dem sichtbaren Bereich gedrängt werden kann.

- **`.ringing-overlay`** bleibt bei `position: fixed; inset: 0` (statt
  `height: 100vh`/`100dvh`) - bindet alle vier Kanten robust an den
  Viewport, ohne die aus mobilen Browsern bekannten `vh`-Eigenheiten
  (hier ohnehin irrelevant, da Capacitor-WebView, aber die stabilere
  Wahl). Flexbox-Spalte: `.ringing-ad` → `.ringing-body` → `.ringing-swipe`.
- **`.ringing-body`** (Titel/Beschreibung bzw. Uhrzeit/Titel/
  Schlummern-Button) bekam `min-height: 0` + `overflow-y: auto` ergänzt.
  Ohne `min-height: 0` verhindert die automatische Mindesthöhe eines
  Flex-Items (= dessen Inhaltsgröße), dass dieser Bereich bei wenig Platz
  tatsächlich schrumpft - mit beidem zusammen weicht überschüssiger
  Inhalt (z. B. eine lange Orts-Zeit-Wecker-Beschreibung) durch Scrollen
  innerhalb dieses Bereichs aus, statt das Gesamtlayout zu sprengen.
- **`.ringing-swipe`** behält `flex-shrink: 0` (unverändert seit der
  letzten Ergänzung) - hat also Vorrang vor `.ringing-body` und wird nie
  verkleinert. Ein zusätzliches `position: sticky` wäre hier wirkungslos
  gewesen (`.ringing-overlay` selbst scrollt nicht, und der Swipe-Bereich
  liegt als eigenes Flex-Geschwisterelement ohnehin außerhalb des
  scrollenden `.ringing-body`) und wurde deshalb bewusst weggelassen.
- **`.ringing-ad`**: `flex-shrink` von `0` auf `1` geändert (bleibt bei
  `flex-grow: 0` + `max-height: 50%`, wächst also weiterhin nie über
  50% hinaus). Auf jedem realistischen Bildschirm bleibt die Fläche
  dadurch weiterhin exakt bei 50% (Schrumpfen greift nur, wenn
  Werbefläche + Swipe-Bereich + die reinen Innenabstände von
  `.ringing-body` zusammen mehr Platz brauchen, als der Bildschirm
  hergibt - bei keinem der getesteten, realistischen Bildschirmmaße der
  Fall). Erst in diesem Fall gibt die Werbefläche zuerst Platz ab, statt
  den Swipe-Bereich hinauszudrängen.
- **Getestet** per Playwright: 24 Kombinationen aus 4 Bildschirmgrößen
  (normal, kurz/Querformat, klein, sowie ein absichtlich unrealistisch
  extremer 375×240-Fall) × Standard-Wecker/Orts-Zeit-Wecker ×
  geladene/fehlgeschlagene Anzeige × normaler/sehr langer Text - in
  allen 24 Fällen bleibt der Swipe-Track vollständig innerhalb des
  sichtbaren Viewports. Auf allen realistischen Bildschirmgrößen (ab
  480px Höhe) bleibt die Werbefläche dabei weiterhin exakt bei 50%
  stehen (keine Regression zur vorherigen Ergänzung); nur im
  absichtlich unrealistischen 240px-Extremfall schrumpft sie sichtbar,
  damit der Swipe-Bereich Platz hat.

### Orts-Zeit-Wecker: Vollbild-Alarm statt einfacher Benachrichtigung

Der Trigger-Mechanismus wurde von einer einfachen lokalen Benachrichtigung
(Antippen öffnete die App) auf einen echten Vollbild-Alarm nach Vorbild
nativer Wecker-Apps umgestellt. Das erforderte erstmals **eigenen
nativen Code** in diesem Projekt (`android/app/src/main/java/app/
weckerundort/mobile/`) statt nur der Konfiguration bestehender Plugins,
da `@capacitor/local-notifications` kein `setFullScreenIntent()` anbietet.

**Neue native Klassen:**

- **`WeckerOrtsweckerApplication`** (Application-Subklasse, in
  `AndroidManifest.xml` als `android:name` registriert): registriert
  bereits in `onCreate()` einen Empfänger für die Geofence-Transition-
  Broadcasts von `@capgo/background-geolocation`. Das ist der einzige
  Weg, eine Auslösung auch dann zu erkennen, wenn der App-Prozess beim
  Auslösen bereits komplett beendet war (task-killed) - das Plugin
  registriert seinen eigenen Empfänger nämlich erst in der `load()`-
  Methode seiner Capacitor-Plugin-Instanz, die nur existiert, wenn die
  Activity/WebView tatsächlich läuft.
- **`LocationAlarmNotifier`**: baut und postet die Vollbild-Notification
  - eigener Kanal mit `Importance.HIGH` (tatsächlich schon seit einer
  früheren Phase `IMPORTANCE_MAX=5`) und eigenem Sound (`alarm_default`,
  s. u.), `setFullScreenIntent()` zeigt den Alarm bei gesperrtem
  Bildschirm automatisch vollflächig an, bei entsperrtem/aktivem Gerät
  stattdessen eine Heads-up-Benachrichtigung (Systemverhalten). **Ein
  einziger Codepfad** bedient beide möglichen Auslöser - einen JS-Aufruf
  (`LocationAlarmBridgePlugin.ringFullScreenAlarm()`, App-Prozess lebt)
  oder den rein nativen Geofence-Empfänger (App-Prozess war beendet).
  Damit kein Alarm doppelt ausgelöst wird, prüft der native Empfänger
  zuerst `LocationAlarmBridgePlugin.isJsPipelineLoaded()`: Läuft die
  JS-Pipeline bereits, übernimmt sie (mit vollständiger Wiederholungstyp-
  /Pendel-Zeitfenster-Prüfung, siehe unten) die Entscheidung.
- **`AlarmRingService`**: eigener Foreground-Service für Ton
  (`MediaPlayer` mit `AudioAttributes.USAGE_ALARM`/`STREAM_ALARM` - klingelt
  wie ein echter Wecker unabhängig vom Lautlos-/Klingelton-Profil, da der
  Nutzer die Alarm-Lautstärke separat regelt) **und** Vibration
  (`Vibrator`/`VibratorManager`), gesteuert nach der Ton-/Vibrations-/
  Beides-Einstellung des jeweiligen Alarms - unabhängig vom
  Benachrichtigungskanal-Sound, der nur den kurzen Anfangston beim
  Posten der Notification liefert.
- **`LocationAlarmBridgePlugin`**: die JS-Brücke (`ringFullScreenAlarm`,
  `stopAlarmSound`, `consumePendingAlarm`/`pendingAlarm`-Event,
  `canUseFullScreenIntent`/`openFullScreenIntentSettings` für die
  Android-14-Berechtigung).
- **`MainActivity`**: setzt beim Start über den Vollbild-Intent die für
  die Anzeige über dem Sperrbildschirm nötigen Fenster-Flags
  (`setShowWhenLocked`/`setTurnScreenOn`/`requestDismissKeyguard`,
  Legacy-Flags unter API 27) - **nur** in diesem Fall, ein normaler
  App-Start bleibt unverändert - und reicht die Alarm-Daten an JS weiter
  (`consumePendingAlarm()` bei kaltem Start, `pendingAlarm`-Event bei
  bereits laufender Activity).

**Alarm-Sound-Datei ergänzt**: `res/raw/alarm_default.wav` existierte
bisher trotz Referenz im Benachrichtigungskanal (`notifications.js`,
seit einer früheren Phase) gar nicht - die Kanäle waren also bislang
faktisch lautlos. Da in dieser Umgebung keine Audio-Asset-Werkzeuge zur
Verfügung stehen, wurde ein kurzer, synthetischer Zwei-Ton-Beep (per
Python-`wave`-Modul aus reinen Sinuswerten erzeugt) als echte,
gültige WAV-Datei generiert - deutlich vom Standard-Systemton
unterscheidbar, aber bewusst kein gestalteter/gebrandeter Klang; vor
Store-Release ggf. durch einen professionell produzierten Alarmton
ersetzen.

**JS-seitige Änderungen:**

- `backgroundGeofence.js`: `addGeofence()` sendet jetzt eine `payload`
  mit Titel, Beschreibung und Ton-Einstellung mit - das Plugin
  persistiert und liefert sie bei jeder Transition unverändert zurück
  (`GeofenceStore.buildTransitionData`), sodass der native Pfad ohne
  jeden JS-/localStorage-Zugriff an die nötigen Alarm-Daten kommt.
- `geoTrigger.js`: `triggerCallback` gibt jetzt zusätzlich `locationId`
  und `enter` (Ankunft/Abfahrt) durch.
- `locationAlarms.js`: `notifyAlarmInBackground()` (die alte einfache
  Benachrichtigung) entfernt, ersetzt durch
  `locationAlarmBridge.ringFullScreenAlarm()`. Neuer Hinweis-Dialog
  (`#fullscreen-intent-permission-modal`, Muster wie der bestehende
  „Standort immer erlauben"-Dialog) für die Android-14-
  Systemeinstellungen-Freigabe. `consumePendingAlarm()`/`onPendingAlarm()`
  zeigen das Overlay, nachdem die Activity über den Vollbild-Intent
  gestartet wurde, inkl. nachträglicher Zustands-Buchhaltung
  (`wasInside`/`consumed`), falls diese beim ursprünglichen Auslösen
  nicht laufen konnte (App-Prozess war da noch nicht wieder aktiv).
- `locationRinging.js`: `show()`/`stop()` unterscheiden jetzt per
  `options.nativeAudio`, ob Ton/Vibration vom nativen
  `AlarmRingService` übernommen werden (kein doppelter Ton; `stop()`
  ruft dann `stopAlarmSound()`) oder wie bisher von `alarmSound.js`
  (reiner Vordergrund-Pfad, App war beim Auslösen bereits sichtbar
  geöffnet).
- Neu: `js/locationAlarmBridge.js` (dünner Wrapper um das native Plugin,
  No-Ops im Browser-Vorschau).

**Bekannte, bewusst dokumentierte Grenze**: Ist der App-Prozess beim
Auslösen komplett beendet (kein JS aktiv - der eigentliche
"task-killed"-Fall), kann der rein native Empfänger die nur in
`localStorage` geführten Wiederholungstyp-Regeln (z. B. "einmalig
bereits ausgelöst") und Pendel-Zeitfenster nicht erneut prüfen - er löst
für jede zur registrierten Richtung (Ankunft/Abfahrt, korrekt gefiltert
über `notifyOnEntry`/`notifyOnExit` pro Geofence) passende Transition
aus. In der Praxis harmlos für die häufigsten Fälle (einmalige/
permanente Alarme ohne Pendel-Fenster), kann aber in Randfällen (erneutes
Betreten eines Orts nach bereits ausgelöstem "einmalig"-Alarm, während
die App durchgehend beendet blieb) zu einem zusätzlichen Klingeln führen.
Bei lebendigem App-Prozess (Vordergrund, Hintergrund, gesperrter
Bildschirm, Bildschirm aus - solange der Prozess nicht beendet wurde)
bleibt die vollständige JS-Prüfung in jedem Fall maßgeblich.

**Getestet** per Playwright mit einer gemockten nativen Brücke: Ein
Hintergrund-Trigger ruft `ringFullScreenAlarm()` mit den korrekten
Alarm-Daten auf; ein simulierter Pending-Alarm (Vollbild-Intent-Start)
zeigt das Overlay mit `nativeAudio` und wendet die nachträgliche
Zustands-Buchhaltung korrekt an; `stop()` (Swipe im Overlay) ruft
`stopAlarmSound()` statt der Web-Audio-Logik auf; der Android-14-
Hinweis-Dialog erscheint korrekt, wenn `canUseFullScreenIntent()` "nicht
erlaubt" meldet. Komplette bestehende Regressionssuite läuft weiterhin
fehlerfrei.

**Was sich in dieser Umgebung nicht verifizieren lässt** (wie bei jeder
nativen Änderung in diesem Projekt, hier aber in deutlich größerem
Umfang, da erstmals eigener nativer Code statt nur Plugin-Konfiguration):
die eigentliche Kotlin/Java-Kompilierung und der Gradle-Build (kein
Android-SDK in dieser Umgebung - Verifikation über die vorhandene
GitHub-Actions-CI, siehe unten) sowie das tatsächliche Geräteverhalten in
allen vier angeforderten Testfällen:

1. **Bildschirm gesperrt** - Vollbild-Alarm sollte automatisch über dem
   Sperrbildschirm erscheinen (setFullScreenIntent + Lockscreen-Flags).
2. **Bildschirm aus** - wie 1., zusätzlich muss `setTurnScreenOn(true)`
   den Bildschirm zuverlässig einschalten.
3. **App im Hintergrund** (Prozess lebt) - JS-Pipeline bleibt
   maßgeblich, Notification/Vollbild-Intent über
   `ringFullScreenAlarm()`.
4. **App komplett geschlossen (task-killed)** - rein nativer Pfad über
   `WeckerOrtsweckerApplication`, mit der oben beschriebenen
   dokumentierten Einschränkung bei Wiederholungstyp/Pendel-Fenstern.

Insbesondere Fall 4 ist real bedeutsam: Vor dieser Änderung hätte ein
Auslösen bei komplett beendetem Prozess **überhaupt nichts** bewirkt
(nicht einmal die "einfache" Benachrichtigungsvariante) - der Plugin-
eigene Broadcast-Empfänger existierte in diesem Fall schlicht nicht,
da er erst mit der (nie gestarteten) Capacitor-Bridge registriert wird.
Zudem lässt sich Android-Herstellervariation beim Umgang mit
"App aus Recents entfernt" (manche OEMs beenden den Prozess aggressiver/
schneller als AOSP) nur auf echten Geräten verschiedener Hersteller
prüfen.

### Zuverlässiger Hintergrundbetrieb für das Geofencing

Ergänzung zum Vollbild-Alarm-Umbau oben: Das Geofencing selbst läuft
technisch bereits systemseitig über Google Play Services
(`GeofencingClient` + `PendingIntent`, siehe `@capgo/background-geolocation`)
und würde grundsätzlich auch ohne eigenen Foreground-Service
funktionieren. In der Praxis greifen aber v. a. OEM-eigene, über AOSP
hinausgehende Batteriesparfunktionen (Xiaomi MIUI, Huawei, Samsung u. Ä.)
zusätzlich zum reinen Android-Doze-Modus und können Hintergrund-Prozesse
ohne aktiven Foreground-Service und ohne Ausnahme von der
Akku-Optimierung deutlich früher/aggressiver drosseln. Diese Ergänzung
macht die App robuster dagegen, ähnlich wie Fitness-Tracker-/
Navigations-Apps:

- **Neu: `GeofenceForegroundService.java`** - dauerhafter, dezenter
  Foreground-Service (eigener Low-Importance-Kanal, `setSilent(true)`,
  `setOngoing(true)`, `foregroundServiceType="location"`) mit der
  Notification "Orts-Zeit-Wecker aktiv". Start/Stop über
  `LocationAlarmBridgePlugin.startGeofenceService()`/
  `stopGeofenceService()`, aufgerufen aus `locationAlarms.js`s
  `syncTracking()` - läuft, solange mindestens ein Orts-Zeit-Wecker
  aktiviert ist, wird beendet, sobald keiner mehr aktiv ist.
  `onStartCommand()` gibt `START_STICKY` zurück, damit Android den Dienst
  nach einem harten System-Kill (z. B. unter Speicherdruck) möglichst
  automatisch neu startet, solange noch ein Alarm aktiviert ist - ein
  bewusstes Force-Stop durch den Nutzer selbst kann kein Code umgehen,
  das ist eine Android-Systemgrenze.
- **`ACCESS_BACKGROUND_LOCATION`**: war bereits vor dieser Ergänzung
  korrekt implementiert - `@capgo/background-geolocation`s
  `requestPermissions()` fragt sie erst NACH erteilter
  Vordergrund-Standortberechtigung in einem separaten System-Dialog an
  (`requestBackgroundLocationPermissionIfNeeded()` im Plugin), wie es
  Android ab Version 10 zwingend vorschreibt (beide zusammen in einem
  Dialog anzufragen wird vom System schlicht nicht erlaubt/ignoriert).
  Der bestehende `#background-permission-modal`-Hinweisdialog deckt das
  bereits ab.
- **Neu: Akku-Optimierung-Ausnahme-Dialog** - `#battery-optimization-permission-modal`
  (gleiches Muster wie die bestehenden Standort-/Vollbild-Hinweisdialoge),
  erscheint beim Aktivieren eines Orts-Zeit-Weckers, wenn
  `LocationAlarmBridgePlugin.isIgnoringBatteryOptimizations()` (via
  `PowerManager.isIgnoringBatteryOptimizations()`) noch keine Ausnahme
  meldet. "Einstellungen öffnen" ruft `requestIgnoreBatteryOptimizations()`
  auf, das den direkten System-Dialog via
  `Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` öffnet (Nutzer
  muss dort explizit "Zulassen" tippen) - deutlich schneller als über die
  allgemeine App-Liste in den Einstellungen zu navigieren.
- Neue Manifest-Einträge: `<service>` für `GeofenceForegroundService`,
  Berechtigungen `FOREGROUND_SERVICE_LOCATION` (ab Android 14 zusätzlich
  zu `ACCESS_BACKGROUND_LOCATION` für einen `foregroundServiceType="location"`-
  Service zwingend) und `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`.

**Store-Hinweis**: `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` ist eine
"special use"-Berechtigung, die Google Play beim Veröffentlichen im
Play-Console-Formular explizit begründet werden muss (Zweck: zuverlässige
Auslösung eines vom Nutzer aktiv eingerichteten ortsbasierten Alarms auch
im Hintergrund) - siehe Checkliste unten.

**Getestet** per Playwright mit gemockter nativer Brücke: Aktivieren
eines Orts-Zeit-Weckers ruft `startGeofenceService()` genau einmal auf
(Übergang von "kein aktiver Alarm" zu "mindestens einer aktiv"); der
Akku-Optimierung-Hinweisdialog erscheint korrekt, wenn
`isIgnoringBatteryOptimizations()` "nein" meldet, und ruft nach Klick auf
"Einstellungen öffnen" `requestIgnoreBatteryOptimizations()` genau einmal
auf und blendet sich aus. **Nicht verifizierbar in dieser Umgebung** (wie
bei jeder nativen Ergänzung hier): die tatsächliche Kompilierung
(Verifikation über GitHub-Actions-CI) sowie das reale Verhalten auf
einem Gerät - insbesondere, ob der Foreground-Service den Prozess nach
einem harten Kill tatsächlich per `START_STICKY` neu startet, und wie
sich OEM-spezifische Batteriesparfunktionen (die teils auch mit erteilter
Akku-Optimierung-Ausnahme noch eigene, App-spezifische Schalter kennen,
z. B. MIUIs "Autostart") trotz aller hier implementierten Maßnahmen
verhalten.

### Echtes Dauerklingeln statt einmaliger Benachrichtigung (beide Alarm-Arten)

Der Vollbild-Alarm-Mechanismus (siehe oben) klang bisher, sobald der native
`AlarmRingService` einmal gestartet war, unbegrenzt weiter, bis der Nutzer
per Swipe stoppte - und existierte bislang NUR für den Orts-Zeit-Wecker,
nicht für den Standard-Wecker (der weiterhin nur über
`@capacitor/local-notifications` als einmalige Benachrichtigung mit
Kanal-Standardton auslöste). Diese Ergänzung macht beide Alarm-Arten zu
einem echten Wecker-Erlebnis:

- **Klingel-Pause-Zyklen**: Klingelt (Ton + Vibration je nach Einstellung)
  für eine konfigurierbare Klingeldauer (Standard 60 s), pausiert dann für
  eine konfigurierbare Pausendauer (Standard 5 min), klingelt danach
  erneut - bis zu einer konfigurierbaren Anzahl Zyklen (Standard 3),
  danach endgültiges Verstummen ohne weitere Versuche.
- **Native, eigenständige Zeitsteuerung**: Der komplette Ablauf (nicht nur
  Ton/Vibration selbst) wird in `AlarmRingService.java` über einen
  eigenen `Handler`-Timer verwaltet - JS-Timer würden in einer im
  Hintergrund gedrosselten WebView unzuverlässig laufen, und die
  Benachrichtigung selbst hat keinen eingebauten Wiederholungsmechanismus.
- **Vollbild-Intent bei jeder Wiederaufnahme**: Bei jedem neuen
  Klingel-Zyklus (ab dem zweiten) postet der Dienst die
  Vollbild-Notification erneut (`AlarmNotifier.repost()`), damit der
  Bildschirm zuverlässig wieder aufweckt, falls er während der Pause
  ausgegangen ist - `setFullScreenIntent` ist der einzige von Android
  sanktionierte Weg, das aus einem Service-/Hintergrundkontext heraus zu
  tun (ein direkter `startActivity()`-Aufruf würde an Androids
  Background-Activity-Start-Restriktionen scheitern).
- **"Verpasst"-Benachrichtigung**: Nach dem letzten erfolglosen Zyklus
  ersetzt der Dienst die Vollbild-Notification durch eine normale,
  wegwischbare Benachrichtigung, damit der Nutzer auch später noch sieht,
  dass ein Alarm ausgelöst (aber nicht bestätigt) wurde.
- **Standard-Wecker jetzt ebenfalls über den Vollbild-Alarm-Mechanismus**:
  `AlarmNotifier`/`AlarmRingService`/`MainActivity`/
  `LocationAlarmBridgePlugin` wurden von "nur Orts-Zeit-Wecker" auf beide
  Alarm-Arten generalisiert (neuer `kind`-Parameter, `"standard"` vs.
  `"location"`) - `LocationAlarmNotifier.java` wurde dafür in
  `AlarmNotifier.java` umbenannt. `alarms.js`s `handleFire()` (JS-Pipeline
  lebt) und `ringAlarmFromNativePending()` (kalter Start über den
  Vollbild-Intent) rufen jetzt denselben nativen Ring-Mechanismus wie der
  Orts-Zeit-Wecker.
- **Auf nativer Plattform IMMER über den nativen Dienst** - unabhängig
  davon, ob die App gerade sichtbar ist. Vorher lief der Orts-Zeit-Wecker
  im Vordergrund noch über die Web-Audio-Umsetzung (`alarmSound.js`, ohne
  Zyklen); das hätte das neue Klingel-Pause-Verhalten im Vordergrund
  inkonsistent gemacht. Die Web-Audio-Umsetzung ist jetzt ausschließlich
  der Fallback für die Browser-Vorschau (kein Capacitor-Bridge vorhanden).
- **Einstellungen**: Neue globale Standardwerte im Einstellungen-Dialog
  (Klingeldauer, Pausendauer, Wiederholungszyklen, siehe `ringSettings.js`
  + `window.storage.ringSettings`), mit Möglichkeit zur Überschreibung pro
  einzelnem Alarm (`ringOverrideEnabled` + eigene Werte, in beiden
  Editor-Modals als ausklappbarer Block wie die bestehenden
  Schlummern-/Pendel-Optionen). `ringSettings.resolveForAlarm(alarm)`
  ermittelt die tatsächlich zu verwendenden Werte.
- **Killed-Process-Pfad (nur Orts-Zeit-Wecker)**: Die drei Werte werden
  jetzt auch in den Geofence-`payload` eingebettet (siehe
  `backgroundGeofence.js`), damit der rein native Empfänger
  (`WeckerOrtsweckerApplication`/`AlarmNotifier.handleGeofenceTransition`)
  sie auch ohne laufende JS-Pipeline kennt. Für den Standard-Wecker gibt
  es weiterhin KEINEN entsprechenden rein nativen Auslösepfad - trifft der
  Alarm bei vollständig beendetem Prozess ein, bleibt es bei der
  einmaligen Benachrichtigung mit Kanal-Standardton ohne Zyklen (dieselbe,
  bereits an anderer Stelle dokumentierte Einschränkung wie zuvor beim
  Orts-Zeit-Wecker vor dessen Vollbild-Alarm-Umbau - eine Lösung dafür
  würde einen eigenen `BroadcastReceiver`-Bridge-Mechanismus für
  `@capacitor/local-notifications` erfordern, analog zu
  `WeckerOrtsweckerApplication` für Geofencing, was hier bewusst nicht
  Teil dieser Ergänzung war).
- **Race-Vermeidung beim kalten Start**: `consumePendingAlarm()` ist ein
  einmalig konsumierbarer nativer Aufruf - würden sowohl `alarms.js` als
  auch `locationAlarms.js` ihn selbst aufrufen, bekäme nur eines der
  beiden Module die Daten. Die Verteilung läuft daher zentral in `app.js`
  anhand von `pending.kind`, ebenso die `alarmExpired`-Event-Verteilung.
- **Kein doppeltes Auslösen bei Zyklus-Wiederaufnahme**: Da
  `AlarmNotifier.repost()` bei jedem neuen Zyklus erneut denselben
  Vollbild-Intent feuert, würde `MainActivity.onNewIntent()` ohne
  Gegenmaßnahme auch die Zustands-Buchhaltung (`consumed`,
  `lastTriggeredAt`) bei jedem Zyklus erneut ausführen -
  `ringing.isActive()`/`locationRinging.isActive()` verhindern das, indem
  `ringAlarmFromNativePending()` sofort zurückkehrt, wenn das Overlay für
  diesen Alarm bereits sichtbar ist.

**Getestet** per Playwright (gemockte native Brücke): globale
Ring-Einstellungen werden korrekt gespeichert/geladen; ein Alarm mit
eigenen Klingel-Einstellungen speichert diese korrekt und
`ringFullScreenAlarm()` verwendet sie statt der globalen Standardwerte
(für Standard-Wecker UND Orts-Zeit-Wecker); ein simuliertes
`alarmExpired`-Event schließt ein offenes Overlay automatisch. **Nicht
verifizierbar in dieser Umgebung**: die tatsächliche
Handler-Timer-Ablaufsteuerung in `AlarmRingService` selbst (Zyklen/Pausen
über mehrere Minuten, Bildschirm-Aufwecken bei Wiederaufnahme) - das lässt
sich nur auf einem echten Gerät über die volle Klingeldauer/Pausendauer
hinweg beobachten.

## Entwicklung

```bash
npm install
npx cap sync android
npx cap open android   # öffnet das Projekt in Android Studio
```

Die Web-Quelltexte liegen in `www/`. Nach Änderungen dort `npx cap sync android`
ausführen, um sie ins native Android-Projekt zu übernehmen.
