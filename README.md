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
- **Auslöse-Bildschirm**: Werbefläche (Platzhalter, ~50 % der Höhe – echtes
  AdMob folgt in Phase 6), Titel + Beschreibung darunter, Stopp per Swipe,
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

Die weiteren Phasen (Erweiterungen, Werbung/Monetarisierung, Testing/Release)
sind noch offen.

## Entwicklung

```bash
npm install
npx cap sync android
npx cap open android   # öffnet das Projekt in Android Studio
```

Die Web-Quelltexte liegen in `www/`. Nach Änderungen dort `npx cap sync android`
ausführen, um sie ins native Android-Projekt zu übernehmen.
