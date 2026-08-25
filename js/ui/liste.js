// Der gemeinsame Zeilen-Baustein. Eingangsposten, Aufgaben und Vorgänge sehen
// bewusst gleich aus: auf „Heute" stehen sie nebeneinander, und drei
// Darstellungen für dieselbe Sache wären dort nur Lärm.
//
// Bewusst kompakt gehalten (~62 statt 105 px). Die erste Fassung zeigte auf
// dem iPhone sieben Zeilen; für 33 Aufgaben waren das fünf Bildschirme. Dazu
// trug jede vierte von fünf Zeilen einen schwarzen „⚙️ UNGEPRÜFT"-Block —
// ein Merkmal, das an 81 % der Zeilen steht, unterscheidet nichts, es
// dominiert nur. Es ist jetzt ein kleines Zeichen vor dem Titel.
import { el, icon } from "../core/dom.js";
import { tagKurz, stufe, tageBis } from "../core/fmt.js";

export function merkmal(text, art = "") {
  return text ? el("span", { class: `merkmal ${art}`, text: String(text) }) : null;
}

/** Genau ein Zeitwort statt Datum UND Restlaufzeit nebeneinander.
 *  Was zählt, hängt vom Abstand ab: bei Überfälligkeit die Dauer, sonst der Tag. */
function zeitwort(datum) {
  const t = tageBis(datum);
  if (t === null) return { text: "—", stufe: "ohne" };
  if (t < 0) return { text: `${-t} T`, stufe: "ueberfaellig" };
  if (t === 0) return { text: "heute", stufe: "heute" };
  // "in 6 T" statt "6 T": ohne das Wörtchen stand dieselbe Angabe für
  // "6 Tage überfällig" und "in 6 Tagen", unterschieden nur durch die
  // Strichstärke — auf dem Telefon nicht zuverlässig lesbar.
  if (t <= 7) return { text: `in ${t} T`, stufe: "bald" };
  return { text: tagKurz(datum), stufe: "spaeter" };
}

/**
 * @param {object} o
 * @param {string} o.datum      bestimmt Randmarke und Zeitspalte
 * @param {string} o.name       die Sache selbst — eine Zeile, dann Auslassung
 * @param {string} o.neben      Herkunft. Weglassen, wenn die Abschnitts-
 *                              überschrift dasselbe schon sagt
 * @param {Array}  o.merkmale   nur Unterscheidendes — nicht das, was überall steht
 * @param {boolean} o.ungeprueft  zeigt ⚙ vor dem Titel
 */
export function zeile({ datum, name, neben, merkmale = [], erledigt = false,
                        ungeprueft = false, aufKlick, aufHaken, hakenAn = false,
                        seit = null, einzug = false }) {
  const z = datum ? zeitwort(datum) : { text: "", stufe: "ohne" };

  const titel = el("div", { class: "zeile-name" }, [
    ungeprueft ? el("span", { class: "zeile-fahne", title: "ungeprüft", text: "⚙" }) : null,
    el("span", { text: name }),
  ].filter(Boolean));

  // Herkunft und Merkmale teilen sich eine Zeile. Getrennt wären es zwei,
  // und die zweite trüge fast nie genug Inhalt, um sie zu rechtfertigen.
  const fussTeile = [
    neben ? el("span", { class: "zeile-neben", text: neben }) : null,
    seit ? el("span", { class: "zeile-neben", text: seit }) : null,
    ...merkmale.filter(Boolean),
  ].filter(Boolean);

  const klassen = ["zeile", z.stufe === "ueberfaellig" ? "ueberfaellig" : "",
                   z.stufe === "heute" ? "heute" : "", erledigt ? "erledigt" : "",
                   einzug ? "eingerueckt" : ""].filter(Boolean).join(" ");

  return el(aufKlick ? "button" : "div",
    { class: klassen, ...(aufKlick ? { onclick: aufKlick } : {}) },
    [
      el("div", { class: `zeile-zeit ${z.stufe}`, text: z.text }),
      el("div", { class: "zeile-text" }, [
        titel,
        fussTeile.length ? el("div", { class: "zeile-fuss" }, fussTeile) : null,
      ].filter(Boolean)),
      aufHaken
        ? el("button", {
            class: `haken-knopf${hakenAn ? " an" : ""}`,
            "aria-label": hakenAn ? "Wieder öffnen" : "Erledigt",
            onclick: (ev) => { ev.stopPropagation(); aufHaken(); },
          }, [icon("haken", 14)])
        : null,
    ].filter(Boolean));
}

/** Aufklappbare Gruppe — Projekt, Bucket oder Bereich.
 *  Ohne sie stehen 33 Aufgaben als 33 Zeilen da, davon zehn zum selben Projekt. */
export function gruppe({ label, kurz, zahlen = [], offen = false, kinder, beimUmschalten }) {
  const kopf = el("button", { class: `gruppe-kopf${offen ? " offen" : ""}`, onclick: beimUmschalten }, [
    el("span", { class: "gruppe-pfeil", text: offen ? "▾" : "▸" }),
    el("span", { class: "gruppe-label", text: label }),
    el("span", { class: "gruppe-zahlen", text: zahlen.filter(Boolean).join(" · ") }),
  ]);
  return el("section", { class: "gruppe" },
    [kopf, offen ? el("div", { class: "karten" }, kinder()) : null].filter(Boolean));
}

export function abschnitt(titel, neben, kinder) {
  const inhalte = [].concat(kinder).filter(Boolean);
  if (!inhalte.length) return null;
  return el("section", {}, [
    el("div", { class: "abschnitt-titel" }, [
      el("h2", { text: titel }),
      neben ? el("span", { class: "marke", text: neben }) : null,
    ]),
    el("div", { class: "karten" }, inhalte),
  ]);
}

export function leer(titel, text) {
  return el("div", { class: "leer-block" }, [
    el("p", {}, [el("strong", { text: titel }), text || ""]),
  ]);
}
