# Datenschema — CoWork

Nur primitive Typen und ISO-8601-Datumsstrings, wie in der Stundenerfassung.
Damit bleibt dieselbe Struktur ohne Anpassung als Swift-`Codable` nutzbar,
falls die App später nativ neu gebaut wird.

Ablage: `CoWork_OS/data/` im OneDrive-Baum. Die App liest und schreibt dort
über Microsoft Graph; der Mac sieht dieselben Dateien lokal.

---

## Eingangsposten (`eingang.json` → `posten`)

| Feld | Bedeutung |
|---|---|
| `id` | `EP-####`, fortlaufend |
| `datum` / `datumBis` | Eingang; `datumBis` nur bei gebündelten Posten (Zeitraum) |
| `absender` · `betreff` | **Rohtext mit Markdown** — für die Anzeige durch `klar()` schicken |
| `typ` | `DOC` · `ANF` · `MHG` · `RCH` · `TER` · `MAI` |
| `bereich` | `kl` · `mvv` · `sgg` · `sidehustle` · `privat` · `joy` · `null` |
| `bereichUnklar` | `true`, wenn die Zuordnung offen ist (im Dashboard `?`) |
| `vorgang` | `VG-JJNN-###` oder `null` |
| `frist` · `fristZeit` · `fristDringend` | echter Termin, Uhrzeit, „sofort" |
| `fristText` | die ursprüngliche Formulierung, ohne berechnete Verfallshinweise |
| `wartetSeit` | **Wartedatum, keine Frist.** „offen seit 10.07." landet hier |
| `status` | `offen` · `wartend` · `erledigt` |
| `wartetAuf` | Freitext. `Steffen` heißt „liegt bei mir" und ist kein Nachfassziel |
| `notiz` | Dateiname des Obsidian-Dossiers, ohne Endung |
| `anzahlMails` | > 1 bei gebündelten Posten |
| `geprueft` | `false` = vom Morgen-Briefing angelegt, von Steffen nicht bestätigt (`⚙️`) |
| `letzteBewegung` | wird bei jeder Änderung gesetzt; Bezugspunkt des Altlast-Radars |
| `geaendert` | ISO-Zeitstempel. **Entscheidet den Zusammenführungs-Konflikt** |
| `geloescht` | Grabstein. Der Satz bleibt, damit die Löschung auf andere Geräte übergeht |

Dazu auf oberster Ebene: `briefings[]` (die ⚙️-Abschnitte der Morgen-Briefings)
und `hinweise[]` (erläuternde Abschnitte wie „Bündelung am 01.08.2026").

**Warum `frist` und `wartetSeit` getrennt sind:** „Terminvorschlag offen seit
10.07." als Frist gelesen meldet „45 Tage überfällig" für etwas, das nie einen
Termin hatte — und verdeckt damit die Posten, die wirklich einen haben.

---

## Vorgang (`vorgaenge.json` → `vorgaenge`)

| Feld | Bedeutung |
|---|---|
| `id` | `VG-JJNN-###` |
| `status` | `offen` · `wartend` · `eskaliert` · `abgeschlossen` |
| `statusText` | die vollständige Statuszeile inkl. Begründung einer Herabstufung |
| `projekt` · `typ` · `eroeffnet` · `wartetAuf` | Kopfdaten, Rohtext |
| `beteiligte[]` / `beteiligteKlar[]` | roh und bereinigt |
| `naechsterSchritt` | **mehrzeilig** — trägt bei VG-26KL-005 eine Liste mit zehn Punkten |
| `chronologie[]` | `{datum, zeit, text, textKlar, notizen[], richtung, teil}` |
| `teile[]` | **die Blockfolge des Markdown-Körpers — die Rückschreibgarantie** |

### Zu `teile`

`vorgaenge.md` ist gewachsen, nicht generiert. Drei Eigenheiten haben je einen
Datenverlust verursacht, bevor sie erkannt waren:

1. Felder sind **mehrzeilig**. Eine Regex, die nur die Zeile hinter dem
   Doppelpunkt liest, verliert die kompletten nummerierten Listen.
2. Es gibt Felder, die niemand modelliert hatte: `Hinweis`, `Offene
   Verknüpfung`, `Seriennummer`, `Offen, Entscheidung Steffen`.
3. Die Chronologie-Tabelle wird bei `VG-26KL-004` **mitten drin** von einem
   Hinweis-Block unterbrochen und läuft danach weiter.

Deshalb speichert `teile` die Reihenfolge selbst:
`{typ: "feld", name, wert}` · `{typ: "text", wert}` · `{typ: "chronologie", zeilen: [[datum, text], …]}`

Der Generator schreibt daraus zurück. **Was nicht in `teile` steht, existiert
nach dem nächsten Lauf nicht mehr.** Strukturierte Felder (`status`,
`wartetAuf`) gewinnen beim Schreiben, alles andere bleibt unverändert.

Zusätzlich auf oberster Ebene: `bereichstexte` (Erläuterung je Bereichs­abschnitt)
und `fusszeile`.

---

## Ausgangseintrag (`ausgang.json` → `eintraege`)

`id` (`AP-####`) · `datum` / `datumBis` · `empfaenger` · `betreff` · `typ`
(`MAI`, `MAI+ANL`) · `bereich` · `vorgang` · `status` (`versendet`,
`versendet · Antwort offen`) · `notiz`.

---

## Stammdaten (`stammdaten.json`)

`bereiche[]` mit `id` · `label` · `kurz` · `aliase[]` · `reihung` · `altLabel`.

Das **erste Alias** ist das Kürzel der Dashboards (`KL`, `MV`, `PR`, `SGG`) —
gewachsen und in Steffens Listen seit dem 09.07.2026 in Gebrauch. `kurz` ist
der Anzeigename in den Apps. `altLabel` hält den früheren Abschnittsnamen in
`vorgaenge.md` fest (`MVV Netze GmbH`, `Passive Income`), sonst findet der
Generator die Erläuterungstexte nicht wieder.

`projekte[]` — 800 Sätze: 161 kreativLABOR42 (untermStrich), 617 MVV
(TV.D.3-Liste), 6 SGG, 6 Sidehustle, 6 Privat, 4 Joy. Erzeugt von
`stammdaten.py`; die vier händisch gepflegten Bereiche stammen aus
`stammdaten_eigen.json` und werden **nie überschrieben**.

Feldzuordnung untermStrich → App wie in der Stundenerfassung
(`docs/SCHEMA.md` dort, Abschnitt „Projekt").

---

## Planner-Aufgabe (nur zwischengespeichert)

`id` · `titel` · `geprueft` · `bucket` · `bereich` · `faellig` · `fortschritt`
· `erledigt` · `etag`.

Kein Grabstein, kein `geaendert`: Planner ist die Wahrheit, der lokale Stand
wird bei jedem Abgleich vollständig ersetzt. `geprueft` ergibt sich daraus, ob
der **Planner-Titel** mit `⚙️` beginnt — dort und nur dort sitzt der Marker.
Bestätigen heißt deshalb: den Titel in Planner umbenennen.

`etag` ist Pflicht bei jeder Änderung; ist es veraltet, antwortet Graph mit
`412` — dann neu lesen statt erzwingen.
