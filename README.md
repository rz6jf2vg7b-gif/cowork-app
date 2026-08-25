# CoWork

Eingang · Aufgaben · Vorgänge — als Web-App für iPhone, iPad und Mac.
Schwesteranwendung der Stundenerfassung, gleiche Bauart, gleicher Projektstamm.

**Stand 24.08.2026 — Erstfassung.** Läuft, aber noch nicht auf Steffens Geräten
installiert. Was dafür fehlt, steht unter „Vor der ersten Nutzung".

---

## Wozu

Eingang, Aufgaben und Vorgänge sind eigentlich *eine Kette*: ein Reiz kommt
herein (Eingang), wird zu einer Akte (Vorgang), aus der ein nächster Schritt
folgt (Aufgabe). Bisher lagen die drei in drei Formaten ohne gemeinsame
Oberfläche — und deshalb entstand regelmäßig, was am 02.08.2026 protokolliert
wurde: 26 QGW-Mails an einer Zeile, zwei Posten elf Tage lang als „überfällig"
geführt, obwohl längst geantwortet war.

Der eigentliche Mangel war nie Nachlässigkeit, sondern Mechanik: der
Morgen-Briefing-Task kann bauartbedingt nur *hinzufügen*. Ein Erfassungsprozess
ohne Gegenstück erzeugt zwangsläufig Scheinrückstände. Diese App ist das
Gegenstück — deshalb sitzt in der Mitte der Navigationsleiste kein „Neu",
sondern **Durchlauf**.

---

## Ansichten

| Reiter | Was er zeigt |
|---|---|
| **Heute** | Lage in vier Kacheln (überfällig · heute fällig · ungeprüft ⚙️ · Altlast > 30 T), dann überfällige Fristen und „Bei anderen" |
| **Post** | Scans · Eingang · Ausgang · Alle. Suche, Filter (offen / mit Frist / überfällig / ungeprüft), Bereichsauswahl |
| **Vorgänge** | Die Akten. Detail als Zeitstrahl, neueste Einträge zuerst, „Nächster Schritt" oben |
| **Aufgaben** | Microsoft Planner, live. Nach Projekt gruppiert oder nach Frist. Abhaken schreibt sofort zurück |
| **Fristen** | Monatsraster über alle drei Quellen, optional als Outlook-Termin |
| **Mehr** | Verbindung, abgeschlossene Vorgänge, Datenstand, Sprungziele |

**Durchlauf** führt in einem Zug durch alles, was hängt — gerissene Fristen
zuerst, dann Ungeprüftes, dann Altlasten über 30 Tage. Wer abbricht, hat das
Dringendste hinter sich. Eine Sache je Bildschirm; bewusst keine Liste, denn
eine Liste lässt sich überfliegen, und genau das ist mit diesen Posten seit
Wochen passiert.

Je Sache vier Schritte: **Dokumente ansehen** → **Dossier lesen** →
**zuordnen** (Projekt oder Bereich) → **entscheiden**.

**Die Dokumente** sind Mail, Anhänge und Scans — antippen öffnet sie. Die
Verknüpfung Posten → Datei fehlte im Datenmodell ganz: ein Posten kennt sein
Dossier, aber nicht die Rechnung, um die es geht. `dokumentenindex.py`
rekonstruiert sie aus den `.eml`-Kopfzeilen (Absender + Datum); 58 der 93
Mails tragen Anhänge, und alle 70 losen Dateien in `00_INBOX/eMails` stammen
aus genau diesen Mails. 20 von 28 Posten bekommen dadurch Dateien. Bei
Gleichstand ordnet das Skript bewusst nichts zu.

**„Erledigt" legt mit ab.** Steht ein Ziel und gibt es Dateien, heißt der Knopf
„Erledigt · 3 Dateien ablegen" und trägt sie in `ablage.json` ein. Ohne das
verschwände der Eintrag aus der Liste, während die Rechnung weiter unsortiert
in `00_INBOX` läge — der Grund, warum diese Fassung entstanden ist.

Welche Entscheidungen zur Wahl stehen, bestimmt der Grund:

| Grund | Frage | Wege |
|---|---|---|
| ungeprüft | Stimmt der Eintrag? | Stimmt so · Weg damit · Später ansehen |
| überfällig | Frist ist gerissen — was gilt? | Erledigt · Neue Frist · Später ansehen |
| Altlast | Liegt seit Wochen — was gilt? | Erledigt · Lebt noch (Uhr zurücksetzen) · Weg damit · Später |

Die erste Fassung hatte **fünf feste Knöpfe für drei verschiedene Fragen**, und
das ging schief: „Wartet weiter" und „Überspringen" riefen exakt dieselbe
Funktion, „Frist auf nächste Woche" erfand Termine bei Posten ohne Frist, und
bei Planner-Aufgaben war „Verwerfen" identisch mit „Erledigt". Die
Beschriftungen nennen jetzt die Wirkung, nicht die Absicht — und es gibt
„Zurück".

**Warum die Zuordnung mitten im Durchlauf sitzt:** Kein einziger Eingangsposten
trug bisher ein Projekt (`projektId` war überall leer). Hier liegt die Sache
ohnehin gerade vor — es ist der billigste Moment, es nachzuholen. Wird ein
Projekt gewählt, gewinnt dessen Bereich: ein Projekt zu nennen ist die genauere
Aussage als ein Bereich, der oft nur geschätzt war.

**Warum das Dossier und nicht die Mail:** Von 23 Posten haben 18 eine
Obsidian-Notiz, aber nur 2 eine gleichnamige `.eml` — die Namen sind
auseinandergelaufen. Und `obsidian://`-Deeplinks funktionieren auf Steffens
Geräten nicht (geprüft 01.08.2026). Also wird der Text geholt und in der App
gezeigt.

**Scans — der Eingangskorb.** Was du mit dem iPhone einscannst, landet in
OneDrive unter `00_INBOX/Scans`; der Morgen-Briefing-Monitor legt Mailanhänge
unter `00_INBOX/eMails` ab. Beides war bisher unsichtbar — und die 70 Anhänge
hatten überhaupt keinen Weg hinaus: der Monitor legt sie ab, nichts holt sie
wieder heraus. Die Ansicht listet sie mit Vorschau; antippen öffnet die
Zuordnung (Projekt oder Bereich).

**Die App verschiebt die Datei nicht selbst.** Die 100 Projektordner auf
OneDrive sind Arbeitskopien, die `projekt_rucksync.py` einmalig vom NAS
befüllt hat — den Weg zurück gibt es nicht. Eine dort abgelegte Datei läge in
einer Kopie, die niemand mehr beachtet. Stattdessen wird die Entscheidung in
`CoWork_OS/data/ablage.json` notiert, und auf dem Mac führt sie aus:

```bash
python3 ~/Library/CloudStorage/OneDrive-kreativLABOR42/CoWork_OS/00_resources/scripts/ablage_ausfuehren.py
python3 ~/.../ablage_ausfuehren.py --ausfuehren
```

Ohne Schalter ist es ein Prüflauf. Kopiert wird über eine SHA-256-Prüfung, die
Quelle fällt erst danach weg, und überschrieben wird nie — gleichnamige Dateien
werden nummeriert.

**Kein Fach im Projekt.** Die Struktur aus `projektstruktur.md` v2.4 existiert
nur in der untermStrich-Vorlage: von 174 Projekten auf dem NAS haben 75
überhaupt ein `01_SCH`, und darunter liegen `01_Beteiligte / 02_Post / 03_Doku`
statt `01_IN/IN`. Ein festes Fach wäre bei zwei Dritteln falsch. Die App legt
deshalb nur fest, **welches Projekt** — die Datei landet in dessen `00_INBOX`.

**Warum Ein- und Ausgang in einer Ansicht:** SKILL 06 heißt „Eingang & Ausgang",
und der Ausgang ist dort gleichrangig. Am 02.08.2026 kam heraus, dass zwei Posten
elf Tage lang als überfällig liefen, obwohl längst geantwortet war — sichtbar wird
das nur, wenn beide Richtungen nebeneinander stehen. Ein versendeter Brief mit
Status *Antwort offen* landet deshalb auch in der Nachfassliste auf *Heute*.

Auf dem Telefon zeigt die Leiste **fünf** Reiter und keinen Mittelknopf; der
Durchlauf steht dort als großer Knopf auf *Heute*. Die erste Fassung opferte
für den Mittelknopf ausgerechnet *Vorgänge* — die Akte war damit nur über
Umwege erreichbar, obwohl sie den Kern des Systems bildet. *Fristen* bleibt
mobil ausgeblendet und ist über die Kachel auf *Heute* erreichbar; ab 768 px
zeigt die Seitenleiste alle sechs plus den Durchlauf.

**Gruppierung nach Projekt** gibt es bei den Aufgaben, nicht im Eingang. Von
33 Aufgaben tragen 21 ihr Projekt als Präfix im Titel („QGW: …"), zehn davon
dasselbe — gruppiert werden aus 33 Zeilen sieben Gruppen. Aufgelöst wird gegen
den echten Katalog: 222 Projekte tragen ein Kürzel, `QGW` → 1909, `OFS` → 2019.
Bei Mehrdeutigkeit entscheidet `f_29` (Projekt aktiv): „Theodor-Heuss-Schule"
trifft 1701 (Bau B, laufend) und 2010 (Bau C, abgeschlossen).

**Im Eingang bewusst nicht.** Posten tragen kein Projekt-Präfix; wirft man
Betreff und Absender in denselben Auflöser, treffen dreibuchstabige Kürzel
zufällig — der MVV-Posten „Schnitte UW Roche" landete bei „UW Sprendlingen",
der E.ON-Abschlag bei „Haushalt". Der einzige verlässliche Schlüssel wäre der
Vorgang, den aber nur 5 von 23 Posten tragen.

---

## Woher die Daten kommen

```
untermStrich  ─┐
MVV TV.D.3    ─┼─→ CoWork_OS/data/stammdaten.json ─┬─→ CoWork
eigene Bereiche┘                                    └─→ Stundenerfassung

Outlook-Monitor ─→ CoWork_OS/data/eingang.json   ─┬─→ CoWork (lesen + schreiben)
Claude-Session  ─→            vorgaenge.json      │
                              ausgang.json        └─→ dashboards_bauen.py
                                                       └→ HTML + MD für Obsidian

Microsoft Planner ─────────────────────────────────→ CoWork (live über Graph)
```

**Seit 24.08.2026 ist JSON das Primärformat.** `eingang.html`, `eingang.md`,
`vorgaenge.md`, `vorgaenge.html`, `ausgang.html` und `ausgang.md` werden von
`CoWork_OS/00_resources/scripts/dashboards_bauen.py` erzeugt — von Hand
bearbeitet überlebt dort nichts den nächsten Lauf.

Gelesen und geschrieben wird **direkt in `CoWork_OS/data/`** über Microsoft
Graph, nicht in eine Zweitkopie unter `Apps/`. Der Ordner liegt ohnehin im
OneDrive-Baum, den der Mac synchronisiert; eine Zwischenkopie wäre nur ein
weiterer Stand gewesen, der auseinanderlaufen kann.

**Aufgaben bekommen kein JSON.** Planner ist seit dem 01.08.2026 die einzige
Liste, in der gearbeitet wird — ein eigener Abzug wäre genau die zweite Liste,
die damals abgeschafft wurde. Der lokale Zwischenspeicher ist kein zweiter
Stand, sondern nur das zuletzt Gesehene fürs Funkloch.

**Gleichzeitiges Schreiben:** Jede Datei wird mit ihrem eTag gelesen und mit
`If-Match` zurückgeschrieben. Bei `412` wird neu gelesen, **satzweise** nach
`geaendert` zusammengeführt und erneut versucht. Zwei Geräte, die verschiedene
Posten anfassen, überschreiben sich damit nicht.

---

## Aufbau

```
index.html · manifest.webmanifest · sw.js
css/tokens.css     ← wörtlich aus der Stundenerfassung
css/app.css        ← tragende Abschnitte wörtlich übernommen, Rest eigen
js/core/           dom · router · store · fmt
js/data/           db (IndexedDB) · repo (Fachlogik) · stammdaten
js/sync/           microsoft (Anmeldung) · cowork (OneDrive) · planner · auto
js/ui/             liste · sheet · postenblatt · durchlauf
js/views/          heute · eingang · vorgaenge · aufgaben · kalender · mehr
```

`tokens.css`, `router.js`, `dom.js`, `microsoft.js` und `sheet.js` sind
identische Kopien aus der Stundenerfassung. Änderungen dort gehören in beide
Apps — sonst driften die Oberflächen auseinander.

Zwei Eigenheiten, die beim Bauen Fehler verursacht haben und deshalb
festgehalten gehören:

1. **Die Zeichenfunktionen sind asynchron, der Router ist es nicht.** Wird
   während einer laufenden Zeichnung erneut gezeichnet, hängen beide Läufe an
   dieselbe Wurzel und die Ansicht steht doppelt da. Deshalb baut jeder Lauf in
   einen eigenen Behälter und hängt ihn nur ein, wenn er noch der jüngste ist.
2. **Das JSON hält Rohtext mit Markdown**, damit der Markdown-Zwilling
   verlustfrei zurückgeschrieben werden kann. Angezeigt wird davon nichts —
   dafür gibt es `klar()` in `core/fmt.js`. Wer eine neue Ansicht baut und das
   vergisst, bekommt `**offen: Schlussrechnung**` in der Liste.

---

## Vor der ersten Nutzung

1. **Umleitungs-URI in Entra eintragen.** App „CoWork_OS Claude" →
   Authentifizierung → Plattform „Einzelseitenanwendung (SPA)" → die Adresse
   dieser App als **zweite** URI ergänzen (die der Stundenerfassung bleibt).
   Ohne diesen Eintrag lehnt Microsoft die Anmeldung mit `AADSTS9002326` ab —
   die App sagt das im Klartext.
2. **Veröffentlichen**, analog zur Stundenerfassung über GitHub Pages.
3. Auf dem iPhone über Safari → Teilen → „Zum Home-Bildschirm".

**Berechtigungen:** Die App fordert dieselben Rechte wie die Stundenerfassung
(`User.Read`, `Files.ReadWrite.All`, `Calendars.ReadWrite`). Planner wird
*nicht* eigens angefordert — nach Administratorzustimmung trägt das Token alle
konsentierten Rechte, auch nicht angeforderte (nachgemessen am 01.08.2026).
Sollten die Planner-Aufrufe dennoch mit `403` scheitern, ist die Abhilfe eine
Zeile: `Tasks.ReadWrite` in `RECHTE` in `js/sync/microsoft.js` ergänzen.

`Mail.Send` ist der App bewusst nie erteilt worden. Diese App versendet nichts.

---

## Pflege

```bash
# Projektstamm neu bauen (nach ustrich- oder MVV-Aktualisierung)
python3 ~/Library/CloudStorage/OneDrive-kreativLABOR42/CoWork_OS/00_resources/scripts/stammdaten.py

# HTML + Markdown aus dem JSON neu erzeugen
python3 ~/Library/CloudStorage/OneDrive-kreativLABOR42/CoWork_OS/00_resources/scripts/dashboards_bauen.py
```

Eigene Bereiche und Projekte (SGG, Sidehustle, Privat, Joy) stehen in
`CoWork_OS/data/stammdaten_eigen.json`. Der Generator **liest** sie nur — was
dort steht, überlebt jeden Neulauf.

`migration_json.py` war ein Einmal-Skript für die Umstellung und weigert sich
inzwischen, gegen erzeugte Dateien zu laufen. Nicht erneut ausführen.
