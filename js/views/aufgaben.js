// Aufgaben — Microsoft Planner, live. Abhaken schreibt sofort zurück, damit
// die Liste auf dem iPhone und im Planner nie auseinanderfallen.
//
// Gruppiert nach Projekt, nicht nach Bucket: von 33 Aufgaben tragen 21 ihr
// Projekt im Titel ("QGW: …"), zehn davon dasselbe. Flach nebeneinander waren
// das zehn verstreute Zeilen und fünf Bildschirme Scrollen. Der Bucket sagt
// dagegen nur, in welchem Lebensbereich es liegt — das steht schon im Filter.
import { el, hinweis, anhaengen } from "../core/dom.js";
import * as repo from "../data/repo.js";
import * as db from "../data/db.js";
import * as planner from "../sync/planner.js";
import * as store from "../core/store.js";
import * as router from "../core/router.js";
import { zeile, merkmal, gruppe, abschnitt, leer } from "../ui/liste.js";
import { bereichKurz, gruppe as gruppeFuer } from "../data/stammdaten.js";
import { aufgabenBlatt } from "../ui/aufgabenblatt.js";
import { tageBis, klar } from "../core/fmt.js";

const ORDNUNGEN = [
  { id: "projekt", label: "Nach Projekt" },
  { id: "frist", label: "Nach Frist" },
];

let ordnung = "projekt";
let zeigeErledigte = false;
const zugeklappt = new Set();

export async function zeichneAufgaben(wurzel) {
  const alle = await repo.aufgaben();
  const liste = alle.filter((a) => zeigeErledigte || !a.erledigt);
  const offen = alle.filter((a) => !a.erledigt);

  wurzel.appendChild(el("header", { class: "kopfzeile" }, [
    el("h1", { text: "Aufgaben" }),
    el("p", { class: "kopf-neben",
      text: `${offen.length} offen in Planner · ${ueberfaellige(offen).length} überfällig` }),
  ]));

  if (!alle.length) {
    return void wurzel.appendChild(leer("Noch nichts geladen",
      store.zustand.angemeldet ? "Der nächste Abgleich holt die Aufgaben aus Planner."
                               : "Unter Mehr mit Microsoft anmelden."));
  }

  wurzel.appendChild(el("div", { class: "segment" }, ORDNUNGEN.map((o) => el("button", {
    class: `segment-knopf${o.id === ordnung ? " aktiv" : ""}`,
    onclick: () => { ordnung = o.id; router.neuZeichnen(); },
    text: o.label,
  }))));

  if (ordnung === "frist") {
    const ueber = ueberfaellige(liste);
    anhaengen(wurzel, abschnitt("Überfällig", `${ueber.length}`, ueber.map(aufgabenZeile)));
    const rest = liste.filter((a) => !ueber.includes(a))
      .sort((a, b) => (a.faellig || "9999").localeCompare(b.faellig || "9999"));
    anhaengen(wurzel, abschnitt("Weiter", `${rest.length}`, rest.map(aufgabenZeile)));
  } else {
    for (const g of nachProjekt(liste)) {
      // Gruppen mit Überfälligem stehen offen — sonst versteckt die Gruppierung
      // genau das, was sie sichtbar machen soll.
      const auf = g.ueberfaellig > 0 ? !zugeklappt.has(g.id) : zugeklappt.has(`offen:${g.id}`);
      wurzel.appendChild(gruppe({
        label: g.label,
        offen: auf,
        zahlen: [g.ueberfaellig ? `${g.ueberfaellig} überfällig` : null, `${g.aufgaben.length} offen`],
        kinder: () => g.aufgaben.map((a) => aufgabenZeile(a, true)),
        beimUmschalten: () => {
          const s = g.ueberfaellig > 0 ? g.id : `offen:${g.id}`;
          zugeklappt.has(s) ? zugeklappt.delete(s) : zugeklappt.add(s);
          router.neuZeichnen();
        },
      }));
    }
  }

  wurzel.appendChild(el("button", {
    class: "text-knopf", style: { marginTop: "var(--a6)" },
    text: zeigeErledigte ? "Erledigte ausblenden" : "Erledigte zeigen",
    onclick: () => { zeigeErledigte = !zeigeErledigte; router.neuZeichnen(); },
  }));
}

const ueberfaellige = (l) => l.filter((a) => a.faellig && tageBis(a.faellig) < 0 && !a.erledigt);

function nachProjekt(liste) {
  const gruppen = new Map();
  for (const a of liste) {
    const g = gruppeFuer(a.titel, a.bucket || "Ohne Projekt");
    if (!gruppen.has(g.id)) gruppen.set(g.id, { ...g, aufgaben: [], ueberfaellig: 0 });
    const eintrag = gruppen.get(g.id);
    eintrag.aufgaben.push(a);
    if (a.faellig && tageBis(a.faellig) < 0 && !a.erledigt) eintrag.ueberfaellig++;
  }
  // Ein Rohpräfix mit nur einer Aufgabe ist keine Gruppe, sondern Rauschen:
  // "Entscheiden:", "Obsidian:", "Freigabe erteilen:" waren je eine eigene
  // Überschrift für je eine Zeile. Ohne erkanntes Projekt wandern sie in
  // ihren Bucket. Ab zwei Aufgaben bleibt das Präfix stehen — dann ist es
  // vermutlich doch ein Projekt, das nur nicht in untermStrich steht.
  for (const [id, g] of [...gruppen]) {
    if (g.projekt || !id.startsWith("roh:") || g.aufgaben.length > 1) continue;
    const a = g.aufgaben[0];
    const ziel = `ersatz:${a.bucket || "Ohne Projekt"}`;
    if (!gruppen.has(ziel)) {
      gruppen.set(ziel, { id: ziel, label: a.bucket || "Ohne Projekt",
                          kurz: a.bucket, projekt: null, aufgaben: [], ueberfaellig: 0 });
    }
    const z = gruppen.get(ziel);
    z.aufgaben.push(a);
    z.ueberfaellig += g.ueberfaellig;
    gruppen.delete(id);
  }

  for (const g of gruppen.values()) {
    g.aufgaben.sort((a, b) => (a.faellig || "9999").localeCompare(b.faellig || "9999"));
  }
  // Dringlichkeit vor Menge: was brennt, steht oben.
  return [...gruppen.values()].sort((a, b) =>
    b.ueberfaellig - a.ueberfaellig || b.aufgaben.length - a.aufgaben.length
    || a.label.localeCompare(b.label));
}

function aufgabenZeile(a, inGruppe = false) {
  // In der Gruppe ist das Projekt schon in der Überschrift genannt — dann trägt
  // der Titel es doppelt. Das Präfix fliegt raus.
  const titel = inGruppe ? klar(a.titel).replace(/^[^:]{2,30}:\s*/, "") : klar(a.titel);
  return zeile({
    datum: a.faellig,
    name: titel || klar(a.titel),
    neben: inGruppe ? null : a.bucket,
    erledigt: a.erledigt,
    hakenAn: a.erledigt,
    ungeprueft: !a.geprueft,
    einzug: inGruppe,
    merkmale: [inGruppe ? null : (a.bereich ? merkmal(bereichKurz(a.bereich)) : null)],
    aufKlick: () => aufgabenBlatt(a),
    aufHaken: () => umschalten(a),
  });
}

async function umschalten(a) {
  const neu = !a.erledigt;
  try {
    // Erst lokal, dann Planner: die Liste soll sofort reagieren. Scheitert der
    // Rückweg, wird zurückgedreht — sonst zeigt die App etwas an, was in
    // Planner nie angekommen ist.
    await db.schreiben(db.STORE_AUFGABEN, { ...a, erledigt: neu, fortschritt: neu ? 100 : 0 });
    store.geaendert();
    await (neu ? planner.erledigen(a) : planner.oeffnen(a));
    hinweis(neu ? "In Planner abgehakt." : "In Planner wieder geöffnet.", "gut");
    store.abgleichen({ still: true }).catch(() => {});
  } catch (e) {
    await db.schreiben(db.STORE_AUFGABEN, a);
    store.geaendert();
    hinweis(/412|precondition/i.test(e.message)
      ? "Die Aufgabe wurde anderswo geändert — nach dem Abgleich erneut versuchen."
      : `Planner meldet: ${e.message}`, "warnung");
  }
}
