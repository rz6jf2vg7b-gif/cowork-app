// Detailblatt einer Planner-Aufgabe.
//
// Es fehlte, und das fiel erst beim Kürzen der Zeilen auf: Aufgabentitel sind
// lang ("Schachtbauteile-Freigabe entscheiden (~700 € zzgl. Einbau, Erdbau
// Hauck)"), die Zeile zeigt zwei Zeilen davon. Ohne Blatt war der Rest
// unerreichbar — und eine Frist ließ sich überhaupt nicht ändern.
import { el, hinweis } from "../core/dom.js";
import { sheet, schliesse } from "./sheet.js";
import * as db from "../data/db.js";
import * as planner from "../sync/planner.js";
import * as store from "../core/store.js";
import { bereichLabel, gruppe as gruppeFuer } from "../data/stammdaten.js";
import { tag, fristText, klar } from "../core/fmt.js";

const inTagen = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function feld(name, wert) {
  if (!wert) return null;
  return [el("div", { class: "akte-feldname", text: name }),
          el("div", { class: "akte-feldwert", text: wert })];
}

export function aufgabenBlatt(a) {
  const projekt = gruppeFuer(a.titel, a.bucket || "");
  const inhalt = el("div", {}, [
    // Der vollständige Titel — in der Liste steht er gekürzt
    el("p", { class: "block-text", text: klar(a.titel) }),
    el("div", { class: "akte-felder" }, [
      feld("Fällig", a.faellig ? fristText(a.faellig) : "ohne Frist"),
      feld("Projekt", projekt.projekt ? projekt.label : null),
      feld("Bucket", a.bucket),
      feld("Bereich", a.bereich ? bereichLabel(a.bereich) : null),
      feld("Stand", a.erledigt ? "erledigt" : `${a.fortschritt || 0} %`),
    ].filter(Boolean).flat()),
    !a.geprueft
      ? el("p", { class: "block-hinweis",
          text: "Vom Morgen-Briefing angelegt und noch nicht bestätigt. "
              + "Bestätigen entfernt das ⚙ aus dem Planner-Titel." })
      : null,
  ].filter(Boolean));

  const knopf = (text, art, tun) => el("button", { class: `knopf ${art}`, text, onclick: tun });

  sheet({
    titel: a.bucket || "Aufgabe",
    inhalt,
    aktionen: [
      knopf(a.erledigt ? "Wieder öffnen" : "Erledigt", "voll",
            () => tun(a, a.erledigt ? "oeffnen" : "erledigen")),
      !a.geprueft ? knopf("Bestätigen", "", () => tun(a, "bestaetigen")) : null,
      knopf("Frist +1 Woche", "", () => tun(a, "verschieben")),
    ].filter(Boolean),
  });
}

async function tun(a, was) {
  try {
    if (was === "erledigen") { await planner.erledigen(a); await lokal(a, { erledigt: true, fortschritt: 100 }); }
    if (was === "oeffnen") { await planner.oeffnen(a); await lokal(a, { erledigt: false, fortschritt: 0 }); }
    if (was === "bestaetigen") { await planner.bestaetigen(a); await lokal(a, { geprueft: true }); }
    if (was === "verschieben") {
      const neu = inTagen(7);
      await planner.fristSetzen(a, neu);
      await lokal(a, { faellig: neu });
    }
    schliesse();
    hinweis("In Planner übernommen.", "gut");
    store.geaendert();
  } catch (e) {
    hinweis(/412|precondition/i.test(e.message)
      ? "Die Aufgabe wurde anderswo geändert — nach dem Abgleich erneut versuchen."
      : `Planner meldet: ${e.message}`, "warnung");
  }
}

const lokal = (a, felder) => db.schreiben(db.STORE_AUFGABEN, { ...a, ...felder });
