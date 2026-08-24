// Eingang — alles, was hereinkam und noch nicht erledigt ist.
// Gebündelte Posten bleiben eine Zeile: die 26 QGW-Mails sind ein Geschäftsfall,
// keine 26 Aufgaben. Aufgeklappt wird über den Vorgang, nicht über die Liste.
import { el, icon } from "../core/dom.js";
import * as repo from "../data/repo.js";
import * as router from "../core/router.js";
import { zeile, merkmal, leer } from "../ui/liste.js";
import { postenBlatt } from "../ui/postenblatt.js";
import { bereichKurz, alleBereiche } from "../data/stammdaten.js";
import { tageBis, klar } from "../core/fmt.js";

const FILTER = [
  { id: "offen", label: "Offen", passt: (p) => !["erledigt", "abgeschlossen"].includes(p.status) },
  { id: "frist", label: "Mit Frist", passt: (p) => !!p.frist || !!p.fristText },
  { id: "ueber", label: "Überfällig", passt: (p) => p.frist && tageBis(p.frist) < 0 },
  { id: "unge", label: "Ungeprüft", passt: (p) => !p.geprueft },
  { id: "alle", label: "Alle", passt: () => true },
];

let filter = "offen";
let bereichsfilter = null;
let suchtext = "";

export async function zeichneEingang(wurzel, parameter) {
  if (parameter?.wartetAuf) { filter = "offen"; suchtext = ""; }
  const alle = await repo.posten();
  const f = FILTER.find((x) => x.id === filter) || FILTER[0];

  let liste = alle.filter(f.passt);
  if (bereichsfilter) liste = liste.filter((p) => p.bereich === bereichsfilter);
  if (parameter?.wartetAuf) liste = liste.filter((p) => (p.wartetAuf || "").includes(parameter.wartetAuf));
  if (suchtext) {
    const w = suchtext.toLowerCase();
    liste = liste.filter((p) => `${p.absender} ${p.betreff} ${p.vorgang || ""}`.toLowerCase().includes(w));
  }
  // Ohne Frist ans Ende, aber nach Eingangsdatum — sonst stünde Werbung
  // zwischen den Sachen mit Termin.
  liste.sort((a, b) => (a.frist || "9999").localeCompare(b.frist || "9999")
    || (b.datum || "").localeCompare(a.datum || ""));

  wurzel.appendChild(el("header", { class: "kopfzeile" }, [
    el("h1", { text: "Eingang" }),
    el("p", { class: "kopf-neben",
      text: parameter?.wartetAuf ? `wartet auf ${parameter.wartetAuf}`
                                 : `${liste.length} von ${alle.length} Posten` }),
  ]));

  // Suche
  wurzel.appendChild(el("div", { class: "suchzeile" }, [
    el("span", { class: "suchfeld-icon" }, [icon("suche", 17)]),
    el("input", {
      class: "suchfeld", type: "search", placeholder: "Absender, Betreff, Vorgang",
      value: suchtext, inputmode: "search",
      oninput: (ev) => { suchtext = ev.target.value; zeichneNeu(wurzel); },
    }),
  ]));

  // Filter
  wurzel.appendChild(el("div", { class: "segment" }, FILTER.map((x) => el("button", {
    class: `segment-knopf${x.id === filter ? " aktiv" : ""}`,
    onclick: () => { filter = x.id; zeichneNeu(wurzel); },
    text: x.label,
  }))));

  // Bereiche
  const benutzt = alleBereiche().filter((b) => alle.some((p) => p.bereich === b.id));
  if (benutzt.length > 1) {
    wurzel.appendChild(el("div", { class: "chipzeile" }, [
      el("button", {
        class: `chip${bereichsfilter ? "" : " aktiv"}`, text: "Alle Bereiche",
        onclick: () => { bereichsfilter = null; zeichneNeu(wurzel); },
      }),
      ...benutzt.map((b) => el("button", {
        class: `chip${bereichsfilter === b.id ? " aktiv" : ""}`, text: b.label,
        onclick: () => { bereichsfilter = b.id; zeichneNeu(wurzel); },
      })),
    ]));
  }

  if (!liste.length) {
    wurzel.appendChild(leer("Nichts in dieser Auswahl",
      "Anderen Filter wählen oder die Suche leeren."));
    return;
  }

  wurzel.appendChild(el("div", { class: "karten" }, liste.map((p) => zeile({
    datum: p.frist || p.datum,
    name: klar(p.betreff),
    neben: p.absender,
    seit: !p.frist && p.wartetSeit ? p.wartetSeit : null,
    erledigt: ["erledigt", "abgeschlossen"].includes(p.status),
    merkmale: [
      merkmal(p.bereich ? bereichKurz(p.bereich) : "?"),
      p.typ ? merkmal(p.typ) : null,
      p.vorgang ? merkmal(p.vorgang, "stark") : null,
      p.anzahlMails > 1 ? merkmal(`${p.anzahlMails} Mails`) : null,
      !p.geprueft ? merkmal("⚙️ ungeprüft", "voll") : null,
      // Steffen selbst ist kein Nachfassziel — als Merkmal stünde er an fast
      // jeder Zeile und wäre reines Rauschen.
      p.wartetAuf && !repo.istIch(p.wartetAuf) ? merkmal(klar(p.wartetAuf).slice(0, 18)) : null,
    ],
    aufKlick: () => postenBlatt(p),
  }))));
}

function zeichneNeu(wurzel) {
  const oben = wurzel.scrollTop;
  router.neuZeichnen();
  wurzel.scrollTop = oben;
}
