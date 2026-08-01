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

Die weiteren Phasen (volle Funktionslogik, Orts-Zeit-Wecker-Kernfeature,
Background-Geofencing, Erweiterungen, Werbung/Monetarisierung, Testing/Release)
sind noch offen.

## Entwicklung

```bash
npm install
npx cap sync android
npx cap open android   # öffnet das Projekt in Android Studio
```

Die Web-Quelltexte liegen in `www/`. Nach Änderungen dort `npx cap sync android`
ausführen, um sie ins native Android-Projekt zu übernehmen.
