// Der gemeinsame Zeilen-Baustein. Eingangsposten, Aufgaben und Vorgänge sehen
// bewusst gleich aus: Steffen soll auf "Heute" nicht drei Darstellungen
// nebeneinander lesen müssen, nur weil die Sachen aus drei Quellen kommen.
import { el, icon } from "../core/dom.js";
import { tagKurz, wochentag, stufe, tageBis, seitText } from "../core/fmt.js";

export function merkmal(text, art = "") {
  return text ? el("span", { class: `merkmal ${art}`, text: String(text) }) : null;
}

/**
 * @param {object} o
 * @param {string} o.datum      ISO-Datum, bestimmt Randmarke und linke Spalte
 * @param {string} o.name       die Sache selbst
 * @param {string} o.neben      Herkunft (Absender, Bucket, Projekt)
 * @param {Array}  o.merkmale   Beschriftungen: Bereich, Vorgang, Anzahl
 * @param {Function} o.aufKlick
 * @param {Function} o.aufHaken wenn gesetzt, erscheint das Abhakfeld
 */
export function zeile({ datum, name, neben, merkmale = [], erledigt = false,
                        aufKlick, aufHaken, hakenAn = false, seit = null }) {
  const s = datum ? stufe(datum) : "ohne";
  const t = datum ? tageBis(datum) : null;

  const datumsfeld = el("div", { class: "zeile-datum" }, [
    el("div", { text: datum ? tagKurz(datum) : "—" }),
    el("div", { text: datum ? (t < 0 ? `${-t} T` : wochentag(datum)) : "" }),
  ]);

  const inhalt = el("div", { class: "zeile-text" }, [
    el("div", { class: "zeile-name", text: name }),
    neben ? el("div", { class: "zeile-neben", text: neben }) : null,
    seit ? el("div", { class: "zeile-neben", text: seitText(seit) }) : null,
    merkmale.filter(Boolean).length
      ? el("div", { class: "zeile-fuss" }, merkmale.filter(Boolean))
      : null,
  ]);

  const rechts = aufHaken
    ? el("div", { class: "zeile-rechts" }, [
        el("button", {
          class: `haken-knopf${hakenAn ? " an" : ""}`,
          "aria-label": hakenAn ? "Wieder öffnen" : "Erledigt",
          onclick: (ev) => { ev.stopPropagation(); aufHaken(); },
        }, [icon("haken", 15)]),
      ])
    : null;

  const klassen = ["zeile", s === "ueberfaellig" ? "ueberfaellig" : "",
                   s === "heute" ? "heute" : "", erledigt ? "erledigt" : ""]
    .filter(Boolean).join(" ");

  return el(aufKlick ? "button" : "div",
            { class: klassen, ...(aufKlick ? { onclick: aufKlick } : {}) },
            [datumsfeld, inhalt, rechts]);
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
