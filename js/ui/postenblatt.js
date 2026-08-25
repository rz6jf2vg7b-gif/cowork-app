// Das Detailblatt eines Eingangsposten: alles Bekannte, und die vier Wege
// hinaus. Der Dossiername steht als Text da statt als Link — obsidian://-
// Deeplinks funktionieren bei Steffen nicht, ein toter Link wäre schlimmer
// als ein Name zum Suchen.
import { el, icon, hinweis } from "../core/dom.js";
import { sheet, schliesse } from "./sheet.js";
import * as repo from "../data/repo.js";
import * as db from "../data/db.js";
import * as store from "../core/store.js";
import * as router from "../core/router.js";
import { bereichLabel } from "../data/stammdaten.js";
import { tag, fristText, seitText, klar } from "../core/fmt.js";
import { dokumentenblock } from "./dokumente.js";

function feld(name, wert, roh = false) {
  if (!wert) return null;
  return [el("div", { class: "akte-feldname", text: name }),
          el("div", { class: "akte-feldwert", ...(roh ? { html: wert } : { text: wert })})];
}

export async function postenBlatt(p) {
  const dateien = await repo.dokumenteZu(p.id).catch(() => []);
  const felder = [
    feld("Eingang", tag(p.datum) + (p.datumBis ? ` – ${tag(p.datumBis)}` : "")),
    feld("Absender", p.absender),
    feld("Bereich", p.bereich ? bereichLabel(p.bereich) : "noch nicht zugeordnet"),
    feld("Typ", p.typ),
    feld("Frist", p.frist ? fristText(p.frist, p.fristZeit) : p.fristText),
    feld("Wartet seit", p.wartetSeit ? `${tag(p.wartetSeit)} · ${seitText(p.wartetSeit)}` : null),
    feld("Wartet auf", klar(p.wartetAuf)),
    feld("Vorgang", p.vorgang),
    feld("Umfang", p.anzahlMails > 1 ? `${p.anzahlMails} Mails gebündelt` : null),
    feld("Dossier", p.notiz ? `${p.notiz} — in Obsidian suchen` : null),
  ].filter(Boolean).flat();

  const inhalt = el("div", {}, [
    el("p", { class: "block-text", text: klar(p.betreff) }),
    el("div", { class: "akte-felder" }, felder),
    dokumentenblock(dateien),
    !p.geprueft
      ? el("p", { class: "block-hinweis",
          text: "Vom Morgen-Briefing angelegt und noch nicht bestätigt." })
      : null,
  ]);

  const knopf = (text, art, tun) => el("button", { class: `knopf ${art}`, text, onclick: tun });

  sheet({
    titel: p.absender,
    inhalt,
    aktionen: [
      p.vorgang ? knopf("Zur Akte", "", () => {
        schliesse();
        router.zeige("vorgaenge", { mit: { oeffne: p.vorgang } });
      }) : null,
      !p.geprueft ? knopf("Bestätigen", "", () => setzen(p, { geprueft: true }, "Bestätigt.")) : null,
      knopf("Erledigt", "voll", () => setzen(p, { status: "erledigt" }, "Auf erledigt gesetzt.")),
    ].filter(Boolean),
  });
}

async function setzen(p, felder, meldung) {
  try {
    await repo.aendern(db.STORE_POSTEN, p, felder);
    schliesse();
    hinweis(meldung, "gut");
    store.geaendert();
  } catch (e) {
    hinweis(`Konnte nicht gespeichert werden: ${e.message}`, "warnung");
  }
}
