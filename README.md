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
| **Eingang** | Alle Posten mit Suche, Filter (offen / mit Frist / überfällig / ungeprüft) und Bereichsauswahl |
| **Vorgänge** | Die Akten. Detail als Zeitstrahl, neueste Einträge zuerst, „Nächster Schritt" oben |
| **Aufgaben** | Microsoft Planner, live. Abhaken schreibt sofort zurück |
| **Fristen** | Monatsraster über alle drei Quellen, optional als Outlook-Termin |
| **Mehr** | Verbindung, Ausgang, abgeschlossene Vorgänge, Datenstand |

**Durchlauf** (Mittelknopf) führt in einem Zug durch alles, was hängt:
ungeprüfte ⚙️-Posten bestätigen oder verwerfen → gerissene Fristen → Altlasten
über 30 Tage. Eine Sache je Bildschirm, fünf Wege hinaus. Bewusst keine Liste:
eine Liste lässt sich überfliegen, und genau das ist mit diesen Posten seit
Wochen passiert.

Auf dem Telefon zeigt die Leiste vier Reiter — nur so sitzt der Durchlauf-Knopf
mittig. Vorgänge und Fristen sind dort über *Heute* und *Mehr* erreichbar; ab
768 px erscheinen alle sechs in einer Seitenleiste.

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
