# Datenschutzerklärung – Wecker & Ortswecker

> **Hinweis (bitte vor Verwendung lesen und entfernen):** Dies ist ein
> Entwurf, kein rechtsverbindlicher Text und keine Rechtsberatung. Er wurde
> auf Basis dessen erstellt, welche Daten die App laut Code tatsächlich
> verarbeitet (siehe README, Abschnitt "Datenflüsse" weiter unten als
> Nachweis). Vor Veröffentlichung:
> 1. Von einer für Datenschutzrecht qualifizierten Person prüfen lassen,
>    insbesondere wenn Nutzer außerhalb Deutschlands/der EU angesprochen
>    werden.
> 2. Aktuell nur als In-App-Modal eingebunden (`www/index.html`,
>    `#legal-privacy-modal`) – Google Play verlangt in der Play Console
>    zusätzlich eine öffentlich erreichbare Privacy-Policy-**URL** (kein
>    Datei-/App-Link). Vor Store-Einreichung diesen Text zusätzlich z. B.
>    über GitHub Pages hosten und die URL dort eintragen.
> 3. Bei jeder funktionalen Änderung der App (neue Datenverarbeitung, neues
>    SDK) diesen Text mit aktualisieren – bei Änderungen hier auch das
>    inhaltsgleiche Modal in `www/index.html` aktuell halten.

Stand: 14.08.2026

## 1. Verantwortlicher

Daniel Schwarz
WEB Schwarz
Meergässle 8
89180 Berghülen
E-Mail: service@web-schwarz.de

(Impressumspflichtige Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG) siehe
gesondert `IMPRESSUM.md` bzw. das Impressum-Modal in der App.)

## 2. Übersicht: Welche Daten verarbeitet diese App?

„Wecker & Ortswecker" ist bewusst lokal-first aufgebaut: Wecker, Stoppuhr,
Timer, Intervall-Presets und Orts-Zeit-Wecker werden **ausschließlich auf
Ihrem Gerät gespeichert** (im lokalen App-Speicher). Es gibt keinen eigenen
Server/Cloud-Sync-Dienst des Anbieters, an den diese Daten übertragen werden.

Es gibt drei Ausnahmen, bei denen Daten das Gerät verlassen:

| Zweck | Empfänger | Welche Daten | Rechtsgrundlage |
|---|---|---|---|
| Adresssuche im Orts-Zeit-Wecker-Editor | Nominatim/OpenStreetMap-Geocoding-Dienst | Ihre eingegebene Sucheingabe, technisch notwendig: IP-Adresse | Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) bzw. Einwilligung durch aktive Nutzung der Suche |
| Kartenkacheln im Orts-Zeit-Wecker-Editor | OpenStreetMap-Tile-Server | Sichtbarer Kartenausschnitt, technisch notwendig: IP-Adresse | Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) |
| Werbeanzeigen | Google AdMob | Werbekennung, Näherungs-/Standortdaten (falls Einwilligung erteilt), Geräteinformationen | Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) über das Google User Messaging Platform (UMP) Consent-Formular |
| Kauf/Verwaltung der Pro-Version (werbefreies Jahres-Abo) | Google Play Billing | Kaufbestätigung/Abo-Status Ihres Google-Kontos; Zahlungsabwicklung selbst läuft vollständig bei Google, diese App erhält keine Zahlungsdaten (Kartennummer o. Ä.) | Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) |

Standortdaten für die Kernfunktion „Orts-Zeit-Wecker" (Geofencing) werden
**auf dem Gerät ausgewertet** (Abstandsberechnung bzw. native Android-
Geofencing-API) und nicht an den Anbieter dieser App übertragen. Sie
verlassen das Gerät nur insoweit, wie es die Android-Systemdienste
(Google Play Services Standortbestimmung) für die Positionsbestimmung selbst
technisch benötigen – das liegt in der Verantwortung von Google, nicht des
App-Anbieters.

## 3. Standortdaten (Orts-Zeit-Wecker)

Die Funktion „Orts-Zeit-Wecker" benötigt Zugriff auf Ihren Standort, um
Alarme bei Ankunft/Abfahrt an von Ihnen festgelegten Orten auszulösen.

- **Zweck:** ausschließlich zur Auslösung der von Ihnen eingerichteten Orts-
  Zeit-Wecker.
- **Speicherort:** lokal auf dem Gerät (die von Ihnen festgelegten Orte,
  Radien und der zuletzt bekannte „innerhalb/außerhalb"-Status).
- **Hintergrund-Standort:** Für Alarme, die auch bei geschlossener App
  auslösen sollen, wird zusätzlich die Berechtigung „Standort immer
  erlauben" benötigt. Diese wird erst angefragt, nachdem Sie einen Orts-
  Zeit-Wecker aktiviert haben, mit vorheriger Erklärung im Dialog. Sie
  können diese Berechtigung jederzeit in den Android-Systemeinstellungen
  widerrufen; die App funktioniert dann weiter, Orts-Zeit-Wecker lösen aber
  nur noch aus, solange die App geöffnet ist.
- **Weitergabe:** Standortdaten werden von dieser App nicht an den Anbieter
  oder sonstige Dritte übertragen oder verkauft. Ausnahme: Falls Sie der
  personalisierten Werbung zustimmen, kann eine grobe Standortnäherung an
  Google AdMob zur Anzeigenausspielung übermittelt werden (siehe Abschnitt
  5) – das ist unabhängig von der Geofencing-Funktion.

## 4. Benachrichtigungen

Die App nutzt lokale Benachrichtigungen (kein Push-Dienst, keine
Übertragung an einen Server), um Wecker, Timer und Orts-Zeit-Wecker auch
auszulösen, wenn die App nicht im Vordergrund ist. Diese Benachrichtigungen
werden ausschließlich auf Ihrem Gerät geplant und verarbeitet.

## 5. Werbung (Google AdMob)

Beim Auslösen eines Orts-Zeit-Weckers wird eine Werbeanzeige über Google
AdMob eingeblendet. Bevor eine Anzeige angefragt wird, holt die App über das
Google User Messaging Platform (UMP) Ihre Einwilligung ein, sofern diese
nach EWR-/DSGVO-Vorgaben erforderlich ist. Ohne Einwilligung (bzw. wenn
keine Einwilligung nötig ist, weil keine personenbezogene Verarbeitung
stattfindet) wird keine Anzeige angefragt.

Über Google AdMob können folgende Daten verarbeitet werden: Werbekennung
(Advertising ID), Geräte-/App-Informationen, ggf. grobe Standortnäherung.
Diese Verarbeitung unterliegt der Datenschutzerklärung von Google:
<https://policies.google.com/privacy>

Sie können Ihre Werbe-Einwilligung jederzeit in der App ändern: Tab
„Orts-Zeit-Wecker" → „Werbe-Einwilligung verwalten".

[PLATZHALTER: Falls zum Zeitpunkt der Veröffentlichung ein echtes AdMob-
Konto samt konfigurierten GDPR-Nachrichten verwendet wird, hier ggf. die
genauen in der AdMob-Konsole hinterlegten Zwecke/Partner ergänzen, wie sie
im Consent-Formular angezeigt werden.]

## 6. Pro-Version (kostenpflichtiges Abo)

Die App bietet optional ein werbefreies Jahres-Abo ("Pro-Version") an. Kauf,
Zahlungsabwicklung, Rechnungsstellung, Verlängerung und Kündigung laufen
vollständig über Google Play Billing – diese App selbst verarbeitet und
speichert keine Zahlungsdaten (z. B. Kartennummer). Die App fragt lediglich
bei Google Play ab, ob für Ihr Google-Konto ein aktives Abo vorliegt, um die
Werbung entsprechend auszublenden. Die Verwaltung des Abos (Kündigung,
Zahlungsmethode) erfolgt direkt im Play Store unter „Zahlungen und Abos".
Rechtsgrundlage ist die Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).

## 7. Datenspeicherung und -löschung

Alle in der App angelegten Inhalte (Wecker, Timer, Tabata-Presets,
Orts-Zeit-Wecker inkl. hinterlegter Orte) verbleiben lokal auf Ihrem Gerät,
bis Sie sie in der App löschen oder die App deinstallieren bzw. deren
App-Daten in den Android-Einstellungen löschen. Es gibt keine serverseitige
Kopie beim Anbieter.

## 8. Ihre Rechte

Nach der DSGVO haben Sie u. a. das Recht auf Auskunft (Art. 15), Berichtigung
(Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18),
Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21) sowie das Recht,
eine erteilte Einwilligung jederzeit mit Wirkung für die Zukunft zu
widerrufen (Art. 7 Abs. 3). Da die App-Daten lokal auf Ihrem Gerät liegen,
können Sie Auskunft/Löschung für diese Daten selbst direkt in der App bzw.
über die Android-App-Einstellungen vornehmen. Für Anfragen zur
AdMob-Werbeverarbeitung wenden Sie sich zusätzlich an Google (siehe Link
oben) sowie an die unter Punkt 1 genannte Kontaktadresse.

Sie haben zudem das Recht, sich bei einer Datenschutzaufsichtsbehörde zu
beschweren.

## 9. Änderungen dieser Datenschutzerklärung

Diese Datenschutzerklärung wird angepasst, sobald sich die
Datenverarbeitung durch neue App-Funktionen ändert (z. B. neue
Drittanbieter-SDKs).
