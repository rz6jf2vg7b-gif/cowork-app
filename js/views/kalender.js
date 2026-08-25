// Frist-Kalender — alle Termine aus Eingang, Aufgaben und Vorgängen in einer
// Monatsansicht. Ein Punkt je Frist, gefüllt = eigene Sache, offen = wartet
// auf andere. Farblos, weil die App farblos ist: die Dringlichkeit steht in
// der Liste darunter, nicht im Raster.
import { el, hinweis } from "../core/dom.js";
import * as repo from "../data/repo.js";
import * as router from "../core/router.js";
import { graph } from "../sync/microsoft.js";
import { zeile, merkmal, leer } from "../ui/liste.js";
import { postenBlatt } from "../ui/postenblatt.js";
import { aufgabenBlatt } from "../ui/aufgabenblatt.js";
import { bereichKurz } from "../data/stammdaten.js";
import { tag, tageBis } from "../core/fmt.js";

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
let monat = new Date().toISOString().slice(0, 7);
let gewaehlt = null;

export async function zeichneKalender(wurzel) {
  const fristen = await repo.fristen();
  const [jahr, mon] = monat.split("-").map(Number);
  const erster = new Date(Date.UTC(jahr, mon - 1, 1));
  const tage = new Date(Date.UTC(jahr, mon, 0)).getUTCDate();
  const versatz = (erster.getUTCDay() + 6) % 7;      // Montag als erste Spalte
  const heute = new Date().toISOString().slice(0, 10);

  const jeTag = new Map();
  for (const f of fristen) {
    if (!jeTag.has(f.datum)) jeTag.set(f.datum, []);
    jeTag.get(f.datum).push(f);
  }

  wurzel.appendChild(el("header", { class: "kopfzeile" }, [
    el("h1", { text: "Fristen" }),
    el("p", { class: "kopf-neben", text: `${fristen.length} Termine insgesamt` }),
  ]));

  wurzel.appendChild(el("div", { class: "monatswechsel" }, [
    el("button", { class: "text-knopf", text: "◀", onclick: () => bewege(-1) }),
    el("div", { class: "monatsname",
      text: erster.toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }) }),
    el("button", { class: "text-knopf", text: "▶", onclick: () => bewege(1) }),
  ]));

  wurzel.appendChild(el("div", { class: "monat" }, [
    ...WOCHENTAGE.map((w) => el("div", { class: "kalender-wochentag", text: w })),
    ...Array.from({ length: versatz }, () => el("div", { class: "monat-tag fremd" })),
    ...Array.from({ length: tage }, (_, k) => {
      const iso = `${jahr}-${String(mon).padStart(2, "0")}-${String(k + 1).padStart(2, "0")}`;
      const eintraege = jeTag.get(iso) || [];
      return el("button", {
        class: `monat-tag${iso === heute ? " heute" : ""}`,
        onclick: () => { gewaehlt = gewaehlt === iso ? null : iso; router.neuZeichnen(); },
      }, [
        el("div", { class: "monat-zahl", text: String(k + 1) }),
        el("div", { class: "monat-punkte" }, eintraege.slice(0, 8).map((f) => el("span", {
          class: `monat-punkt${f.satz?.wartetAuf && f.satz.wartetAuf !== "Steffen" ? " offen" : ""}`,
        }))),
      ]);
    }),
  ]));

  const auswahl = gewaehlt ? (jeTag.get(gewaehlt) || []) : fristen.filter((f) => f.datum.startsWith(monat));
  wurzel.appendChild(el("div", { class: "abschnitt-titel" }, [
    el("h2", { text: gewaehlt ? tag(gewaehlt) : "Im Monat" }),
    el("span", { class: "marke", text: `${auswahl.length}` }),
  ]));

  wurzel.appendChild(auswahl.length
    ? el("div", { class: "karten" }, auswahl.map((f) => zeile({
        datum: f.datum, name: f.titel, neben: f.neben,
        merkmale: [merkmal(bereichKurz(f.bereich)),
                   merkmal(f.art === "aufgabe" ? "Aufgabe" : "Eingang"),
                   f.vorgang ? merkmal(f.vorgang, "stark") : null],
        aufKlick: () => (f.art === "posten" ? postenBlatt(f.satz) : aufgabenBlatt(f.satz)),
      })))
    : leer("Keine Frist", "In diesem Zeitraum steht nichts an."));

  if (auswahl.length) {
    wurzel.appendChild(el("button", {
      class: "knopf", style: { marginTop: "var(--a5)" },
      text: gewaehlt ? "Diesen Tag in Outlook eintragen" : "Diesen Monat in Outlook eintragen",
      onclick: () => nachOutlook(auswahl),
    }));
  }
}

function bewege(n) {
  const [j, m] = monat.split("-").map(Number);
  const d = new Date(Date.UTC(j, m - 1 + n, 1));
  monat = d.toISOString().slice(0, 7);
  gewaehlt = null;
  router.neuZeichnen();
}

/** Fristen als Ganztagestermine in den Outlook-Kalender. Bewusst als
 *  Sammelaktion und nicht automatisch: ein Kalender, der sich von selbst
 *  füllt, wird als Rauschen wahrgenommen und dann ignoriert. */
async function nachOutlook(fristen) {
  let gesetzt = 0;
  for (const f of fristen) {
    const ende = new Date(Date.parse(f.datum + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
    try {
      await graph("/me/events", {
        methode: "POST",
        koerper: {
          subject: `Frist: ${f.titel}`,
          body: { contentType: "text", content: `${f.neben || ""}\nAus CoWork — ${f.art}` },
          isAllDay: true,
          start: { dateTime: `${f.datum}T00:00:00`, timeZone: "W. Europe Standard Time" },
          end: { dateTime: `${ende}T00:00:00`, timeZone: "W. Europe Standard Time" },
          categories: ["CoWork"],
        },
      });
      gesetzt++;
    } catch (e) {
      hinweis(`Outlook meldet: ${e.message}`, "warnung");
      break;
    }
  }
  if (gesetzt) hinweis(`${gesetzt} ${gesetzt === 1 ? "Termin" : "Termine"} in Outlook angelegt.`, "gut");
}
