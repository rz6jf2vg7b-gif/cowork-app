// Post — Eingang und Ausgang nebeneinander.
//
// Warum beides in einer Ansicht: SKILL 06 heißt „Eingang & Ausgang", und der
// Ausgang ist dort gleichrangig. Am 02.08.2026 kam heraus, dass zwei Posten
// elf Tage lang als überfällig liefen, obwohl längst geantwortet war — sichtbar
// wird das nur, wenn beide Richtungen nebeneinander stehen. Als Abschnitt unter
// „Mehr" wäre der Ausgang genau das geblieben, was er vorher war: ein Anhang,
// in den niemand schaut.
import { el, icon, anhaengen, hinweis } from "../core/dom.js";
import * as repo from "../data/repo.js";
import * as inbox from "../sync/inbox.js";
import { zuordnen } from "../ui/zuordnen.js";
import * as router from "../core/router.js";
import { zeile, merkmal, abschnitt, leer } from "../ui/liste.js";
import { postenBlatt } from "../ui/postenblatt.js";
import { bereichKurz, alleBereiche } from "../data/stammdaten.js";
import { tageBis, klar, seitText } from "../core/fmt.js";

const RICHTUNGEN = [
  // "Scans" steht vorn, weil es der einzige Zustand ist, in dem noch etwas zu
  // entscheiden ist. Eingang und Ausgang sind bereits erfasst.
  { id: "scans", label: "Scans" },
  { id: "ein", label: "Eingang" },
  { id: "aus", label: "Ausgang" },
  { id: "alle", label: "Alle" },
];

const FILTER = [
  { id: "offen", label: "Offen", passt: (p) => !["erledigt", "abgeschlossen"].includes(p.status) },
  { id: "frist", label: "Mit Frist", passt: (p) => !!p.frist || !!p.fristText },
  { id: "ueber", label: "Überfällig", passt: (p) => p.frist && tageBis(p.frist) < 0 },
  { id: "unge", label: "Ungeprüft", passt: (p) => !p.geprueft },
  { id: "alle", label: "Alle", passt: () => true },
];

let richtung = "ein";
// Bewusst KEINE Gruppierung nach Projekt wie bei den Aufgaben. Posten tragen
// kein Projekt-Präfix im Betreff; wirft man Betreff und Absender in den
// Auflöser, treffen dreibuchstabige Kürzel zufällig — der MVV-Posten "Schnitte
// UW Roche" landete bei "UW Sprendlingen", der E.ON-Abschlag bei "Haushalt".
// Der einzige verlässliche Schlüssel wäre der Vorgang, den aber nur 5 von 23
// Posten tragen. Bei 23 Posten und 42 px Zeilenhöhe sind das zwei Bildschirme
// — die Bereichs-Chips genügen als Ordnung.
let filter = "offen";
let bereichsfilter = null;
let suchtext = "";

// Der Eingangskorb wird bei jedem Öffnen frisch von OneDrive geholt statt in
// IndexedDB gespiegelt: er ändert sich durch Scannen am Telefon, nicht durch
// die App. Ein zwischengespeicherter Stand wäre sofort veraltet.
let korb = null;
let korbLaeuft = false;

export async function zeichnePost(wurzel, parameter) {
  if (parameter?.richtung) richtung = parameter.richtung;
  if (parameter?.wartetAuf) { richtung = "ein"; filter = "offen"; suchtext = ""; }

  if (richtung === "scans") return zeichneScans(wurzel);

  const [posten, ausgang] = await Promise.all([repo.posten(), repo.ausgang()]);
  const w = suchtext.toLowerCase();

  // ---- Eingang ------------------------------------------------------------
  const f = FILTER.find((x) => x.id === filter) || FILTER[0];
  let ein = richtung === "aus" ? [] : posten.filter(f.passt);
  if (bereichsfilter) ein = ein.filter((p) => p.bereich === bereichsfilter);
  if (parameter?.wartetAuf) ein = ein.filter((p) => (p.wartetAuf || "").includes(parameter.wartetAuf));
  if (w) ein = ein.filter((p) => `${p.absender} ${p.betreff} ${p.vorgang || ""}`.toLowerCase().includes(w));

  // ---- Ausgang ------------------------------------------------------------
  let aus = richtung === "ein" ? [] : ausgang.slice();
  if (bereichsfilter) aus = aus.filter((e) => e.bereich === bereichsfilter);
  if (w) aus = aus.filter((e) => `${e.empfaenger} ${e.betreff || ""} ${e.vorgang || ""}`.toLowerCase().includes(w));

  wurzel.appendChild(el("header", { class: "kopfzeile" }, [
    el("h1", { text: "Post" }),
    el("p", { class: "kopf-neben", text: kopfzeile(parameter, ein, aus, posten, ausgang) }),
  ]));

  // Richtung — der wichtigste Umschalter, deshalb ganz oben
  wurzel.appendChild(el("div", { class: "segment" }, RICHTUNGEN.map((r) => el("button", {
    class: `segment-knopf${r.id === richtung ? " aktiv" : ""}`,
    onclick: () => { richtung = r.id; neu(wurzel); },
    text: r.label,
  }))));

  wurzel.appendChild(el("div", { class: "suchzeile" }, [
    el("span", { class: "suchfeld-icon" }, [icon("suche", 17)]),
    el("input", {
      class: "suchfeld", type: "search", inputmode: "search", value: suchtext,
      placeholder: richtung === "aus" ? "Empfänger, Thema, Vorgang" : "Absender, Betreff, Vorgang",
      oninput: (ev) => { suchtext = ev.target.value; neu(wurzel); },
    }),
  ]));

  // Statusfilter gibt es nur im Eingang — der Ausgang kennt keine Fristen
  if (richtung === "ein") {
    wurzel.appendChild(el("div", { class: "segment" }, FILTER.map((x) => el("button", {
      class: `segment-knopf${x.id === filter ? " aktiv" : ""}`,
      onclick: () => { filter = x.id; neu(wurzel); },
      text: x.label,
    }))));
  }

  const benutzt = alleBereiche().filter((b) =>
    posten.some((p) => p.bereich === b.id) || ausgang.some((e) => e.bereich === b.id));
  if (benutzt.length > 1) {
    wurzel.appendChild(el("div", { class: "chipzeile" }, [
      el("button", {
        class: `chip${bereichsfilter ? "" : " aktiv"}`, text: "Alle Bereiche",
        onclick: () => { bereichsfilter = null; neu(wurzel); },
      }),
      ...benutzt.map((b) => el("button", {
        class: `chip${bereichsfilter === b.id ? " aktiv" : ""}`, text: b.label,
        onclick: () => { bereichsfilter = b.id; neu(wurzel); },
      })),
    ]));
  }

  if (!ein.length && !aus.length) {
    return void wurzel.appendChild(leer("Nichts in dieser Auswahl",
      "Andere Richtung wählen, Filter ändern oder die Suche leeren."));
  }

  if (richtung === "alle") {
    // Beide Richtungen chronologisch verschränkt — der eigentliche Schriftwechsel.
    const alle = [
      ...ein.map((p) => ({ datum: p.datumBis || p.datum, art: "ein", satz: p })),
      ...aus.map((e) => ({ datum: e.datumBis || e.datum, art: "aus", satz: e })),
    ].sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));
    wurzel.appendChild(el("div", { class: "karten" },
      alle.map((x) => (x.art === "ein" ? eingangsZeile(x.satz) : ausgangsZeile(x.satz)))));
    return;
  }

  if (richtung === "aus") {
    return void anhaengen(wurzel, el("div", { class: "karten" }, sortiertAus(aus).map(ausgangsZeile)));
  }
  anhaengen(wurzel, el("div", { class: "karten" }, sortiertEin(ein).map((p) => eingangsZeile(p))));
}

async function zeichneScans(wurzel) {
  const zugeordnet = new Map((await repo.ablage()).map((z) => [z.id, z]));

  wurzel.appendChild(el("header", { class: "kopfzeile" }, [
    el("h1", { text: "Post" }),
    el("p", { class: "kopf-neben",
      text: korb === null ? "Eingangskorb wird geholt …"
          : `${korb.filter((d) => !zugeordnet.has(d.id)).length} von ${korb.length} noch ohne Ziel` }),
  ]));

  wurzel.appendChild(el("div", { class: "segment" }, RICHTUNGEN.map((r) => el("button", {
    class: `segment-knopf${r.id === richtung ? " aktiv" : ""}`,
    onclick: () => { richtung = r.id; neu(wurzel); },
    text: r.label,
  }))));

  if (korb === null) {
    if (!korbLaeuft) {
      korbLaeuft = true;
      inbox.dateien()
        .then((d) => { korb = d; })
        .catch((e) => { korb = []; hinweis(`Eingangskorb: ${e.message}`, "warnung"); })
        .finally(() => { korbLaeuft = false; router.neuZeichnen(); });
    }
    return void wurzel.appendChild(leer("Einen Moment",
      "Der Eingangskorb wird von OneDrive geholt."));
  }

  if (!korb.length) {
    return void wurzel.appendChild(leer("Der Eingangskorb ist leer",
      "Gescannte Post landet in OneDrive unter 00_INBOX/Scans, "
      + "Anhänge aus dem Morgen-Briefing unter 00_INBOX/eMails."));
  }

  wurzel.appendChild(el("button", {
    class: "text-knopf", style: { margin: "var(--a3) 0" }, text: "Neu holen",
    onclick: () => { korb = null; neu(wurzel); },
  }));

  const ziel = (d) => zugeordnet.get(d.id) || zugeordnet.get(`00_INBOX/${d.quelle}/${d.name}`);
  const offen = korb.filter((d) => !ziel(d));
  const vorschlag = korb.filter((d) => ziel(d)?.bestaetigt === false);
  const fertig = korb.filter((d) => ziel(d) && ziel(d).bestaetigt !== false);

  // Vorschläge zuerst: sie warten auf eine Entscheidung, alles andere nicht.
  anhaengen(wurzel, abschnitt("Vorschlag — bitte bestätigen", `${vorschlag.length}`,
    vorschlag.map((d) => korbZeile(d, ziel(d), wurzel))));
  anhaengen(wurzel, abschnitt("Ohne Ziel", `${offen.length}`,
    offen.map((d) => korbZeile(d, null, wurzel))));
  anhaengen(wurzel, abschnitt("Bestätigt — wartet auf den Mac", `${fertig.length}`,
    fertig.map((d) => korbZeile(d, ziel(d), wurzel))));
}

function korbZeile(d, ziel, wurzel) {
  const vorschlag = ziel?.bestaetigt === false;
  return zeile({
    datum: d.geaendert,
    name: d.name,
    neben: vorschlag && ziel.grund ? ziel.grund : `${d.quelle} · ${inbox.lesbar(d.groesse)}`,
    erledigt: !!ziel && !vorschlag,
    ungeprueft: vorschlag,
    merkmale: [
      merkmal(d.endung.toUpperCase()),
      ziel ? merkmal(ziel.zielLabel.slice(0, 24), vorschlag ? "voll" : "stark") : null,
      vorschlag && ziel.sicherheit ? merkmal(ziel.sicherheit) : null,
    ],
    aufKlick: () => zuordnen(d, () => neu(wurzel), ziel),
  });
}

function kopfzeile(parameter, ein, aus, posten, ausgang) {
  if (parameter?.wartetAuf) return `wartet auf ${parameter.wartetAuf}`;
  if (richtung === "ein") return `${ein.length} von ${posten.length} Posten`;
  if (richtung === "aus") {
    const offen = aus.filter((e) => /Antwort offen/i.test(e.status || "")).length;
    return `${aus.length} von ${ausgang.length} versendet` + (offen ? ` · ${offen} ohne Antwort` : "");
  }
  return `${ein.length + aus.length} Vorgänge im Schriftwechsel`;
}

// Ohne Frist ans Ende, aber nach Eingangsdatum — sonst stünde Werbung
// zwischen den Sachen mit Termin.
const sortiertEin = (l) => l.sort((a, b) => (a.frist || "9999").localeCompare(b.frist || "9999")
  || (b.datum || "").localeCompare(a.datum || ""));
const sortiertAus = (l) => l.sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));

function eingangsZeile(p) {
  return zeile({
    datum: p.frist || p.datum,
    name: klar(p.betreff),
    neben: p.absender,
    seit: !p.frist && p.wartetSeit ? seitText(p.wartetSeit) : null,
    erledigt: ["erledigt", "abgeschlossen"].includes(p.status),
    ungeprueft: !p.geprueft,
    merkmale: [
      richtung === "alle" ? merkmal("Ein") : null,
      merkmal(p.bereich ? bereichKurz(p.bereich) : "?"),
      p.typ ? merkmal(p.typ) : null,
      p.vorgang ? merkmal(p.vorgang, "stark") : null,
      p.anzahlMails > 1 ? merkmal(`${p.anzahlMails} Mails`) : null,
      // Steffen selbst ist kein Nachfassziel — als Merkmal stünde er an fast
      // jeder Zeile und wäre reines Rauschen.
      p.wartetAuf && !repo.istIch(p.wartetAuf) ? merkmal(klar(p.wartetAuf).slice(0, 18)) : null,
    ],
    aufKlick: () => postenBlatt(p),
  });
}

function ausgangsZeile(e) {
  const wartet = /Antwort offen/i.test(e.status || "");
  return zeile({
    datum: e.datumBis || e.datum,
    name: klar(e.betreff) || "(ohne Betreff)",
    neben: e.empfaenger,
    merkmale: [
      richtung === "alle" ? merkmal("Aus", "stark") : null,
      merkmal(e.bereich ? bereichKurz(e.bereich) : "?"),
      e.typ ? merkmal(e.typ) : null,
      e.vorgang ? merkmal(e.vorgang, "stark") : null,
      wartet ? merkmal("Antwort offen", "voll") : null,
    ],
    aufKlick: e.vorgang
      ? () => router.zeige("vorgaenge", { mit: { oeffne: e.vorgang } })
      : null,
  });
}

function neu(wurzel) {
  const oben = wurzel.scrollTop;
  router.neuZeichnen();
  wurzel.scrollTop = oben;
}
