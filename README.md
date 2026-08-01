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

1. Ein echtes Google-AdMob-Konto anlegen und die App darin registrieren, um
   eine echte App-ID und Ad-Unit-ID zu erhalten.
2. `android/app/src/main/res/values/strings.xml` (`admob_app_id`) und
   `BANNER_AD_UNIT_ID` in `www/js/ads.js` durch die echten IDs ersetzen – aktuell
   stehen dort Googles offizielle, öffentlich dokumentierte TEST-IDs
   (`ca-app-pub-3940256099942544...`). Diese zeigen zuverlässig als "Test Ad"
   markierte Anzeigen, erzeugen aber keinerlei Umsatz.
3. In der AdMob-Konsole eigene GDPR-/UMP-Consent-Nachrichten konfigurieren
   (ohne das zeigt `requestConsentInfo` ggf. gar kein Formular an).
4. In der Play Console die Werbe-Angabe und den Data-Safety-Abschnitt
   entsprechend ausfüllen (Standortdaten + Werbe-ID werden verwendet).
5. Auf einem echten Gerät verifizieren, dass Banner tatsächlich geladen werden
   und die Einwilligungs-UI (Formular + „Einwilligung verwalten“-Link) korrekt
   erscheint – ungetestet aus demselben Grund wie Phase 4 (kein Android-SDK/
   Gerät in dieser Umgebung).

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

## Entwicklung

```bash
npm install
npx cap sync android
npx cap open android   # öffnet das Projekt in Android Studio
```

Die Web-Quelltexte liegen in `www/`. Nach Änderungen dort `npx cap sync android`
ausführen, um sie ins native Android-Projekt zu übernehmen.
