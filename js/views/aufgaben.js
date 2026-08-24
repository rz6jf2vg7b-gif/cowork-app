// Aufgaben — Microsoft Planner, live. Abhaken schreibt sofort zurück, damit
// die Liste auf dem iPhone und im Planner nie auseinanderfallen.
import { el, hinweis } from "../core/dom.js";
import * as repo from "../data/repo.js";
import * as db from "../data/db.js";
import * as planner from "../sync/planner.js";
import * as store from "../core/store.js";
import * as router from "../core/router.js";
import { zeile, merkmal, leer } from "../ui/liste.js";
import { bereichKurz } from "../data/stammdaten.js";
import { tageBis } from "../core/fmt.js";

let zeigeErledigte = false;

export async function zeichneAufgaben(wurzel) {
  const alle = await repo.aufgaben();
  const liste = alle.filter((a) => zeigeErledigte || !a.erledigt);

  // Nach Bucket gruppieren, überfällige aber zuerst — sonst versteckt sich
  // eine gerissene Frist unter einer Überschrift weiter unten.
  const ueber = liste.filter((a) => a.faellig && tageBis(a.faellig) < 0 && !a.erledigt);
  const rest = liste.filter((a) => !ueber.includes(a));
  const gruppen = new Map();
  for (const a of rest) {
    const k = a.bucket || "Ohne Bucket";
    if (!gruppen.has(k)) gruppen.set(k, []);
    gruppen.get(k).push(a);
  }

  wurzel.appendChild(el("header", { class: "kopfzeile" }, [
    el("h1", { text: "Aufgaben" }),
    el("p", { class: "kopf-neben",
      text: `${alle.filter((a) => !a.erledigt).length} offen in Planner` }),
  ]));

  if (!alle.length) {
    return void wurzel.appendChild(leer("Noch nichts geladen",
      store.zustand.angemeldet ? "Der nächste Abgleich holt die Aufgaben aus Planner."
                               : "Unter Mehr mit Microsoft anmelden."));
  }

  if (ueber.length) {
    wurzel.appendChild(el("div", { class: "abschnitt-titel" }, [
      el("h2", { text: "Überfällig" }),
      el("span", { class: "marke", text: `${ueber.length}` }),
    ]));
    wurzel.appendChild(el("div", { class: "karten" }, ueber.map(aufgabenZeile)));
  }

  for (const [bucket, aufgaben] of gruppen) {
    wurzel.appendChild(el("div", { class: "abschnitt-titel" }, [
      el("h2", { text: bucket }),
      el("span", { class: "marke", text: `${aufgaben.length}` }),
    ]));
    wurzel.appendChild(el("div", { class: "karten" }, aufgaben.map(aufgabenZeile)));
  }

  wurzel.appendChild(el("button", {
    class: "text-knopf", style: { marginTop: "var(--a6)" },
    text: zeigeErledigte ? "Erledigte ausblenden" : "Erledigte zeigen",
    onclick: () => { zeigeErledigte = !zeigeErledigte; router.neuZeichnen(); },
  }));
}

function aufgabenZeile(a) {
  return zeile({
    datum: a.faellig,
    name: a.titel,
    neben: a.bucket,
    erledigt: a.erledigt,
    hakenAn: a.erledigt,
    merkmale: [
      a.bereich ? merkmal(bereichKurz(a.bereich)) : null,
      !a.geprueft ? merkmal("⚙️ ungeprüft", "voll") : null,
    ],
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
