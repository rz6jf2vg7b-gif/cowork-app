// Der Durchlauf — das Gegenstück, das im System bisher fehlte.
//
// Der Morgen-Briefing-Task kann nur hinzufügen. Ein Erfassungsprozess ohne
// Gegenstück erzeugt zwangsläufig Scheinrückstände: 14 Posten standen deshalb
// monatelang auf "offen", zwei davon waren längst beantwortet. Hier wird
// abgeschlossen — eine Sache nach der anderen, mit vier klaren Wegen hinaus.
//
// Bewusst kein Listenformat: eine Liste lässt sich überfliegen, und genau das
// ist mit diesen Posten seit Wochen passiert.
import { el, icon, hinweis } from "../core/dom.js";
import { sheet, schliesse } from "./sheet.js";
import * as repo from "../data/repo.js";
import * as db from "../data/db.js";
import * as planner from "../sync/planner.js";
import * as store from "../core/store.js";
import { bereichLabel } from "../data/stammdaten.js";
import { tag, seitText, fristText, klar } from "../core/fmt.js";

const HEUTE = () => new Date().toISOString().slice(0, 10);
const inTagen = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function sammeln(art) {
  const [unge, alt, ueber] = await Promise.all([
    repo.ungeprueft(), repo.altlasten(30), repo.ueberfaellig(),
  ]);
  const posten = [];
  const gesehen = new Set();
  const zufuegen = (grund, e) => {
    const schluessel = `${e.art}:${e.satz.id}`;
    if (gesehen.has(schluessel)) return;
    gesehen.add(schluessel);
    posten.push({ ...e, grund });
  };

  if (art === "ungeprueft" || art === "alles")
    for (const e of unge) zufuegen("ungeprueft", e);
  if (art === "ueberfaellig" || art === "alles")
    for (const f of ueber) zufuegen("ueberfaellig", { art: f.art, satz: f.satz, titel: f.titel, neben: f.neben });
  if (art === "altlast" || art === "alles")
    for (const e of alt) zufuegen("altlast", e);
  return posten;
}

const FRAGE = {
  ungeprueft: "Stimmt das so?",
  ueberfaellig: "Frist ist gerissen — was gilt?",
  altlast: "Liegt seit über 30 Tagen — was gilt?",
};

export async function durchlaufStarten(art = "alles") {
  const posten = await sammeln(art);
  if (!posten.length) return void hinweis("Nichts zu durchlaufen.", "gut");

  let i = 0;
  const blatt = sheet({ titel: "Durchlauf", inhalt: el("div") });

  function zeichne() {
    if (i >= posten.length) {
      schliesse();
      hinweis(`Durchlauf beendet — ${posten.length} ${posten.length === 1 ? "Sache" : "Sachen"} bearbeitet.`, "gut");
      store.geaendert();
      return;
    }
    const p = posten[i];
    const s = p.satz;
    const anteil = Math.round((i / posten.length) * 100);

    const grundtext = p.grund === "ungeprueft"
      ? "Vom Morgen-Briefing angelegt und nie bestätigt."
      : p.grund === "altlast"
        ? `Keine Bewegung ${seitText(s.letzteBewegung || s.wartetSeit || s.datum)}.`
        : s.frist ? fristText(s.frist, s.fristZeit) : "Frist überschritten.";

    const felder = [
      ["Art", p.art === "aufgabe" ? "Planner-Aufgabe" : p.art === "vorgang" ? "Vorgang" : "Eingangsposten"],
      ["Bereich", s.bereich ? bereichLabel(s.bereich) : null],
      ["Eingang", s.datum ? tag(s.datum) : null],
      ["Frist", s.frist ? tag(s.frist) : klar(s.fristText) || null],
      ["Wartet auf", repo.istIch(s.wartetAuf) ? null : klar(s.wartetAuf) || null],
      ["Vorgang", s.vorgang || s.id?.startsWith?.("VG-") ? (s.vorgang || s.id) : null],
    ].filter(([, w]) => w);

    blatt.koerper.replaceChildren(el("div", { class: "durchlauf" }, [
      el("div", { class: "durchlauf-zaehler", text: `${i + 1} von ${posten.length}` }),
      el("div", { class: "durchlauf-fortschritt" }, [el("span", { style: { width: `${anteil}%` } })]),
      el("div", { class: "durchlauf-sache" }, [
        el("h3", { class: "durchlauf-frage", text: FRAGE[p.grund] }),
        el("p", { class: "block-text", text: klar(p.titel) }),
        p.neben ? el("p", { class: "block-neben", text: klar(p.neben) }) : null,
        el("p", { class: "durchlauf-grund", text: grundtext }),
        el("div", { class: "akte-felder" }, felder.flatMap(([n, w]) => [
          el("div", { class: "akte-feldname", text: n }),
          el("div", { class: "akte-feldwert", text: w }),
        ])),
      ]),
      el("div", { class: "durchlauf-wege" }, wege(p)),
    ]));
  }

  function wege(p) {
    const knopf = (text, art, tun) => el("button", { class: `knopf ${art}`, text, onclick: tun });
    const weiter = () => { i++; zeichne(); };

    const gemein = [
      knopf("Erledigt", "voll", () => tun(p, "erledigt", weiter)),
      knopf("Frist auf nächste Woche", "", () => tun(p, "verschieben", weiter)),
      knopf("Wartet weiter", "", weiter),
      knopf("Überspringen", "", weiter),
    ];
    if (p.grund === "ungeprueft") {
      return [knopf("Bestätigen", "voll", () => tun(p, "bestaetigen", weiter)),
              knopf("Verwerfen", "", () => tun(p, "verwerfen", weiter)),
              ...gemein.slice(1)];
    }
    return gemein;
  }

  async function tun(p, was, weiter) {
    try {
      if (p.art === "aufgabe") {
        if (was === "erledigt") { await planner.erledigen(p.satz); await lokal(db.STORE_AUFGABEN, p.satz, { erledigt: true, fortschritt: 100 }); }
        if (was === "bestaetigen") { await planner.bestaetigen(p.satz); await lokal(db.STORE_AUFGABEN, p.satz, { geprueft: true }); }
        if (was === "verwerfen") { await planner.erledigen(p.satz); await lokal(db.STORE_AUFGABEN, p.satz, { erledigt: true, fortschritt: 100 }); }
        if (was === "verschieben") { await planner.fristSetzen(p.satz, inTagen(7)); await lokal(db.STORE_AUFGABEN, p.satz, { faellig: inTagen(7) }); }
      } else {
        const store_ = p.art === "vorgang" ? db.STORE_VORGAENGE : db.STORE_POSTEN;
        const felder = was === "erledigt" ? { status: "erledigt" }
          : was === "bestaetigen" ? { geprueft: true }
          : was === "verwerfen" ? { status: "erledigt", verworfen: true, geprueft: true }
          : was === "verschieben" ? { frist: inTagen(7), fristText: `${tag(inTagen(7))} (verschoben ${tag(HEUTE())})` }
          : {};
        await repo.aendern(store_, p.satz, felder);
      }
      weiter();
    } catch (e) {
      hinweis(`Ging nicht: ${e.message}`, "warnung");
    }
  }

  const lokal = (s, satz, felder) =>
    db.schreiben(s, { ...satz, ...felder, letzteBewegung: HEUTE() });

  zeichne();
}
