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

Bekannte Einschränkung: Ein echtes, systemweites Vollbild-Alarmklingeln über den
Sperrbildschirm hinweg (wie bei der nativen Android-Uhr-App), während die App
vollständig beendet ist, benötigt zusätzlichen nativen Code (`AlarmManager` +
`fullScreenIntent`-Activity) über die Capacitor-Standardplugins hinaus. Das aktuelle
Overlay öffnet sich zuverlässig, sobald die App im Vorder-/Hintergrund läuft oder
über die System-Benachrichtigung geöffnet wird – der Feinschliff für den
Sperrbildschirm-Fall ist für Phase 4/7 (echtes Gerät) vorgesehen.

Die weiteren Phasen (Orts-Zeit-Wecker-Kernfeature, Background-Geofencing,
Erweiterungen, Werbung/Monetarisierung, Testing/Release) sind noch offen.

## Entwicklung

```bash
npm install
npx cap sync android
npx cap open android   # öffnet das Projekt in Android Studio
```

Die Web-Quelltexte liegen in `www/`. Nach Änderungen dort `npx cap sync android`
ausführen, um sie ins native Android-Projekt zu übernehmen.
