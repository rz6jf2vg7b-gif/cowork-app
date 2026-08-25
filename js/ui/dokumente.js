// Die Dokumente eines Eingangspostens: Mail, Anhänge, Scans.
//
// Sie fehlten in der ersten Fassung ganz — im Durchlauf stand nur das Dossier,
// also die Zusammenfassung des Morgen-Briefings. Über eine Rechnung lässt sich
// aber nicht entscheiden, ohne sie gesehen zu haben.
import { el, icon, hinweis } from "../core/dom.js";
import * as inbox from "../sync/inbox.js";

const ZEICHEN = { mail: "Mail", anhang: "Anhang", scan: "Scan" };

export function dokumentenblock(dateien, { titel = "Dokumente" } = {}) {
  if (!dateien?.length) return null;
  return el("div", { class: "dokumente" }, [
    el("div", { class: "marke", text: `${titel} · ${dateien.length}` }),
    el("div", { class: "karten" }, dateien.map(zeileFuer)),
  ]);
}

function zeileFuer(d) {
  const endung = (d.name.split(".").pop() || "").toUpperCase();
  return el("button", { class: "dokument", onclick: () => oeffnen(d) }, [
    el("span", { class: "dokument-typ", text: endung.slice(0, 4) }),
    el("span", { class: "dokument-text" }, [
      el("span", { class: "dokument-name", text: d.name }),
      el("span", { class: "zeile-neben", text: [ZEICHEN[d.art] || d.art, d.betreff].filter(Boolean).join(" · ") }),
    ]),
    el("span", { class: "dokument-pfeil" }, [icon("pfeilRechts", 14)]),
  ]);
}

async function oeffnen(d) {
  try {
    const u = await inbox.adresseNachPfad(d.ordner, d.name);
    if (u) window.open(u, "_blank", "noopener");
    else hinweis("Datei nicht gefunden — vielleicht schon abgelegt.", "warnung");
  } catch (e) {
    hinweis(`Ließ sich nicht öffnen: ${e.message}`, "warnung");
  }
}
