// Vorgänge — die Akten. Eine Akte ist kein Listeneintrag, sondern ein Verlauf:
// deshalb Zeitstrahl statt Tabelle. Was als Nächstes zu tun ist, steht oben,
// nicht am Ende von 30 Chronologie-Zeilen.
import { el } from "../core/dom.js";
import * as repo from "../data/repo.js";
import * as router from "../core/router.js";
import { zeile, merkmal, leer } from "../ui/liste.js";
import { postenBlatt } from "../ui/postenblatt.js";
import { bereichKurz, bereichLabel } from "../data/stammdaten.js";
import { tag, seitText, klar } from "../core/fmt.js";

const ZEICHEN = { offen: "Offen", wartend: "Wartend", eskaliert: "Eskaliert",
                  abgeschlossen: "Abgeschlossen", erledigt: "Erledigt" };

let geoeffnet = null;

export async function zeichneVorgaenge(wurzel, parameter) {
  if (parameter?.oeffne) geoeffnet = parameter.oeffne;
  const alle = await repo.vorgaenge();
  if (geoeffnet) {
    const v = alle.find((x) => x.id === geoeffnet);
    if (v) return zeichneAkte(wurzel, v);
    geoeffnet = null;
  }

  const offen = alle.filter((v) => !["abgeschlossen", "erledigt"].includes(v.status));
  offen.sort((a, b) => {
    const rang = { eskaliert: 0, offen: 1, wartend: 2 };
    return (rang[a.status] ?? 9) - (rang[b.status] ?? 9) || a.id.localeCompare(b.id);
  });

  wurzel.appendChild(el("header", { class: "kopfzeile" }, [
    el("h1", { text: "Vorgänge" }),
    el("p", { class: "kopf-neben", text: `${offen.length} laufende Akten` }),
  ]));

  if (!offen.length) return void wurzel.appendChild(
    leer("Keine laufenden Vorgänge", "Abgeschlossenes steht unter Mehr."));

  wurzel.appendChild(el("div", { class: "karten" }, offen.map((v) => {
    const letzte = v.chronologie?.at(-1)?.datum;
    return zeile({
      datum: null,
      name: v.titel,
      neben: klar((v.naechsterSchritt || v.projekt || "").split("\n")[0]),
      seit: seitText(letzte),
      merkmale: [
        merkmal(v.id, "stark"),
        merkmal(bereichKurz(v.bereich)),
        merkmal(ZEICHEN[v.status] || v.status, v.status === "eskaliert" ? "voll" : ""),
        merkmal(`${v.chronologie?.length || 0} Einträge`),
      ],
      aufKlick: () => { geoeffnet = v.id; router.neuZeichnen(); },
    });
  })));
}

async function zeichneAkte(wurzel, v) {
  const posten = await repo.postenZumVorgang(v.id);

  wurzel.appendChild(el("button", {
    class: "text-knopf", style: { marginTop: "var(--a4)" }, text: "← Alle Vorgänge",
    onclick: () => { geoeffnet = null; router.neuZeichnen(); },
  }));

  wurzel.appendChild(el("header", { class: "akte-kopf" }, [
    el("div", { class: "akte-nr", text: `${v.id} · ${bereichLabel(v.bereich)}` }),
    el("h1", { class: "akte-titel", text: v.titel }),
    el("div", { class: "akte-felder" }, [
      ["Status", ZEICHEN[v.status] || v.status],
      ["Projekt", klar(v.projekt)],
      ["Typ", klar(v.typ)],
      ["Eröffnet", v.eroeffnet ? tag(v.eroeffnet) : klar(v.eroeffnetRoh)],
      ["Wartet auf", klar(v.wartetAuf)],
      ["Beteiligte", (v.beteiligteKlar || v.beteiligte || []).join(" · ")],
    ].filter(([, w]) => w).flatMap(([n, w]) => [
      el("div", { class: "akte-feldname", text: n }),
      el("div", { class: "akte-feldwert", text: w }),
    ])),
  ]));

  if (v.naechsterSchritt) {
    wurzel.appendChild(el("div", { class: "karte block warnung" }, [
      el("div", { class: "marke", text: "Nächster Schritt" }),
      el("p", { class: "block-text", text: klar(v.naechsterSchritt) }),
    ]));
  }

  if (posten.length) {
    wurzel.appendChild(el("div", { class: "abschnitt-titel" }, [
      el("h2", { text: "Eingang zu dieser Akte" }),
      el("span", { class: "marke", text: `${posten.length}` }),
    ]));
    wurzel.appendChild(el("div", { class: "karten" }, posten.map((p) => zeile({
      datum: p.frist || p.datum, name: p.betreff, neben: p.absender,
      merkmale: [p.anzahlMails > 1 ? merkmal(`${p.anzahlMails} Mails`) : null],
      aufKlick: () => postenBlatt(p),
    }))));
  }

  const letzte = v.chronologie?.at(-1)?.datum;
  wurzel.appendChild(el("div", { class: "abschnitt-titel" }, [
    el("h2", { text: "Chronologie" }),
    el("span", { class: "marke",
      text: `${v.chronologie?.length || 0} Einträge · ${letzte ? seitText(letzte) : ""}` }),
  ]));

  // Neueste zuerst: bei 30 Einträgen ist der letzte Stand das Gesuchte,
  // nicht der Beginn im Juli.
  const chronik = [...(v.chronologie || [])].reverse();
  wurzel.appendChild(el("div", { class: "strahl" }, chronik.map((c) => el("div", {
    class: `strahl-eintrag${c.richtung === "aus" ? " aus" : ""}`,
  }, [
    el("div", { class: "strahl-datum",
      text: `${tag(c.datum)}${c.zeit ? ` ${c.zeit}` : ""}`
            + (c.richtung === "aus" ? " · Ausgang" : "") }),
    el("div", { class: "strahl-text", text: c.textKlar || klar(c.text) }),
    c.notizen?.length
      ? el("div", { class: "block-hinweis", text: c.notizen.join(" · ") })
      : null,
  ].filter(Boolean)))));
}
