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

Bekannte Einschränkungen:
- Die Standort-Auswertung läuft nur, solange die App geöffnet ist (Vordergrund/
  kurzzeitig Hintergrund) – echtes Geofencing im vollständig geschlossenen
  Zustand kommt mit dem nativen Plugin in Phase 4.
- Die Nominatim-Geocoding-API ist ein kostenloser Dienst mit Nutzungsrichtlinien
  (Rate-Limits); für produktiven Einsatz in größerem Maßstab sollte ein
  dedizierter Geocoding-Anbieter mit eigenem API-Key eingeplant werden.
- Auf einem echten Gerät fehlt bislang die Berechtigungsanfrage/Erklärung für
  „Standort immer erlauben" (ACCESS_BACKGROUND_LOCATION) – ebenfalls Phase 4.

Die weiteren Phasen (Background-Geofencing, Erweiterungen, Werbung/
Monetarisierung, Testing/Release) sind noch offen.

## Entwicklung

```bash
npm install
npx cap sync android
npx cap open android   # öffnet das Projekt in Android Studio
```

Die Web-Quelltexte liegen in `www/`. Nach Änderungen dort `npx cap sync android`
ausführen, um sie ins native Android-Projekt zu übernehmen.
