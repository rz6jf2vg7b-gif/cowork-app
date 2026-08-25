// Der Durchlauf — das Gegenstück, das im System bisher fehlte.
//
// Der Morgen-Briefing-Task kann bauartbedingt nur hinzufügen. Ein
// Erfassungsprozess ohne Gegenstück erzeugt zwangsläufig Scheinrückstände:
// 14 Posten standen deshalb monatelang auf „offen", zwei davon waren längst
// beantwortet. Hier wird abgeschlossen — eine Sache je Bildschirm.
//
// Zweite Fassung. Die erste hatte fünf feste Knöpfe für drei verschiedene
// Fragen, und das ging schief: „Wartet weiter" und „Überspringen" taten exakt
// dasselbe, „Frist auf nächste Woche" erfand Termine bei Posten ohne Frist,
// und bei Aufgaben war „Verwerfen" identisch mit „Erledigt". Jetzt bestimmt
// der Grund, welche Entscheidungen überhaupt zur Wahl stehen — und die
// Beschriftung nennt die Wirkung, nicht die Absicht.
import { el, icon, hinweis } from "../core/dom.js";
import { sheet, schliesse } from "./sheet.js";
import * as repo from "../data/repo.js";
import * as db from "../data/db.js";
import * as planner from "../sync/planner.js";
import * as store from "../core/store.js";
import * as dossier from "../sync/dossier.js";
import * as ablegen from "../data/ablegen.js";
import { dokumentenblock } from "./dokumente.js";
import { alleBereiche, bereichLabel, suche, projekt as projektMit } from "../data/stammdaten.js";
import { tag, seitText, fristText, klar } from "../core/fmt.js";

const HEUTE = () => new Date().toISOString().slice(0, 10);
const inTagen = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

// Wohin ein Bereich ablegt. Diese Ordner liegen echt auf OneDrive — anders
// als die Projekte, die auf dem NAS wohnen.
const BEREICHSZIEL = {
  privat: { id: "pr", label: "Privat", pfad: "02_AREAS/Privat" },
  joy: { id: "joy", label: "Joy · Familie", pfad: "02_AREAS/Privat/Familie" },
  sgg: { id: "sgg", label: "SGG T2,6 Mannheim", pfad: "02_AREAS/SGG_T2-6_Mannheim" },
  kl: { id: "kl", label: "kreativLABOR42 · Büro", pfad: "02_AREAS/kreativLABOR42" },
  mvv: { id: "mvv", label: "MVV Netze", pfad: "02_AREAS/MVV_Netze" },
  sidehustle: { id: "si", label: "Sidehustle", pfad: "02_AREAS/PassiveIncome" },
};

const FRAGE = {
  ungeprueft: "Stimmt der Eintrag?",
  ueberfaellig: "Frist ist gerissen — was gilt?",
  altlast: "Liegt seit Wochen — was gilt?",
};

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
  // Reihenfolge ist Absicht: gerissene Fristen zuerst, dann Ungeprüftes,
  // dann Altlasten. Wer abbricht, hat das Dringendste hinter sich.
  if (art === "ueberfaellig" || art === "alles")
    for (const f of ueber) zufuegen("ueberfaellig", { art: f.art, satz: f.satz, titel: f.titel, neben: f.neben });
  if (art === "ungeprueft" || art === "alles")
    for (const e of unge) zufuegen("ungeprueft", e);
  if (art === "altlast" || art === "alles")
    for (const e of alt) zufuegen("altlast", e);
  return posten;
}

export async function durchlaufStarten(art = "alles") {
  const posten = await sammeln(art);
  if (!posten.length) return void hinweis("Nichts zu durchlaufen.", "gut");

  let i = 0;
  let zuordnung = null;          // offene Auswahl: null | "projekt" | "bereich"
  let dossierText = null;
  let dateien = [];              // Dokumente des aktuellen Postens
  const blatt = sheet({ titel: "Durchlauf", inhalt: el("div") });

  const weiter = () => { i++; ruecksetzen(); zeichne(); };
  const zurueck = () => { i = Math.max(0, i - 1); ruecksetzen(); zeichne(); };
  function ruecksetzen() { zuordnung = null; dossierText = null; dateien = []; dateienHolen(); }

  // Dokumente nachladen und nachzeichnen. Sie kommen aus dem lokalen Index,
  // also schnell — aber asynchron, deshalb nicht im Zeichenlauf selbst.
  async function dateienHolen() {
    const p = posten[i];
    if (!p || p.art === "aufgabe") return;
    const d = await repo.dokumenteZu(p.satz.id).catch(() => []);
    if (posten[i] === p) { dateien = d; zeichne(); }
  }

  function zeichne() {
    if (i >= posten.length) {
      schliesse();
      hinweis(`Durchlauf beendet — ${posten.length} durchgesehen.`, "gut");
      store.geaendert();
      return;
    }
    const p = posten[i];
    const s = p.satz;

    blatt.koerper.replaceChildren(el("div", { class: "durchlauf" }, [
      el("div", { class: "durchlauf-kopf" }, [
        el("span", { class: "durchlauf-zaehler", text: `${i + 1} von ${posten.length}` }),
        i > 0 ? el("button", { class: "text-knopf", text: "← Zurück", onclick: zurueck }) : null,
      ].filter(Boolean)),
      el("div", { class: "durchlauf-fortschritt" },
        [el("span", { style: { width: `${Math.round((i / posten.length) * 100)}%` } })]),

      el("h3", { class: "durchlauf-frage", text: FRAGE[p.grund] }),
      el("p", { class: "block-text", text: klar(p.titel) }),
      p.neben ? el("p", { class: "block-neben", text: klar(p.neben) }) : null,
      el("p", { class: "durchlauf-grund", text: grundtext(p) }),

      el("div", { class: "akte-felder" }, felder(p).flatMap(([n, w]) => [
        el("div", { class: "akte-feldname", text: n }),
        el("div", { class: "akte-feldwert", text: w }),
      ])),

      dossierKnopf(s),
      dossierText ? el("pre", { class: "dossier", text: dossierText }) : null,
      dokumentenblock(dateien),

      zuordnungsblock(p),
      el("div", { class: "durchlauf-wege" }, wege(p)),
    ].filter(Boolean)));
  }

  // ---- Dossier ------------------------------------------------------------
  function dossierKnopf(s) {
    if (!s.notiz) return null;
    if (dossierText) {
      return el("button", { class: "text-knopf", text: "Dossier zuklappen",
        onclick: () => { dossierText = null; zeichne(); } });
    }
    return el("button", { class: "knopf", onclick: async () => {
      dossierText = "wird geholt …";
      zeichne();
      try {
        const md = await dossier.lesen(s.notiz);
        dossierText = md ? dossier.alsText(md) : "Dossier nicht gefunden.";
      } catch (e) {
        dossierText = `Dossier ließ sich nicht laden: ${e.message}`;
      }
      zeichne();
    } }, [icon("vorgaenge", 16), el("span", { text: "Dossier lesen" })]);
  }

  // ---- Zuordnung ----------------------------------------------------------
  // Kein Posten trägt bisher ein Projekt (das Feld ist überall leer). Hier ist
  // der Moment, in dem es sich mit einem Griff nachholen lässt — die Sache
  // liegt ohnehin gerade vor.
  function zuordnungsblock(p) {
    if (p.art === "vorgang") return null;
    const s = p.satz;
    const projekt = s.projektId ? projektMit(s.projektId) : null;

    const stand = el("div", { class: "zuordnung-stand" }, [
      el("span", { class: "marke", text: "Zuordnung" }),
      el("span", { class: "zuordnung-wert", text:
        [projekt ? (projekt.kuerzel || projekt.nr || projekt.name) : null,
         s.bereich ? bereichLabel(s.bereich) : null].filter(Boolean).join(" · ") || "noch keine" }),
    ]);

    const schalter = el("div", { class: "chipzeile" }, [
      el("button", { class: `chip${zuordnung === "projekt" ? " aktiv" : ""}`, text: "Projekt",
        onclick: () => { zuordnung = zuordnung === "projekt" ? null : "projekt"; zeichne(); } }),
      el("button", { class: `chip${zuordnung === "bereich" ? " aktiv" : ""}`, text: "Bereich",
        onclick: () => { zuordnung = zuordnung === "bereich" ? null : "bereich"; zeichne(); } }),
    ]);

    return el("div", { class: "zuordnung" },
      [stand, schalter,
       zuordnung === "projekt" ? projektwahl(p) : null,
       zuordnung === "bereich" ? bereichswahl(p) : null].filter(Boolean));
  }

  function projektwahl(p) {
    let treffer = suche("", { limit: 6 });
    const liste = el("div", { class: "karten" });
    const zeichneListe = () => liste.replaceChildren(...treffer.map((pr) => el("button", {
      class: "treffer",
      // Der Bereich des Projekts gewinnt: ein Projekt zu wählen ist die
      // genauere Aussage als der Bereich, der oft nur geschätzt war.
      onclick: () => setzen(p, { projektId: pr.id, bereich: pr.bereich || p.satz.bereich,
                                 bereichUnklar: false }),
    }, [
      el("span", { class: "treffer-marke", text: pr.kuerzel || pr.nr || "—" }),
      el("span", { class: "treffer-text" }, [
        el("span", { class: "treffer-name", text: pr.name }),
        el("span", { class: "zeile-neben", text: [pr.nr, pr.ort].filter(Boolean).join(" · ") }),
      ]),
    ])));
    zeichneListe();
    return el("div", {}, [
      el("div", { class: "suchzeile" }, [
        el("span", { class: "suchfeld-icon" }, [icon("suche", 17)]),
        el("input", { class: "suchfeld", type: "search", placeholder: "Kürzel, Nummer, Name",
          inputmode: "search", autocomplete: "off",
          oninput: (ev) => { treffer = suche(ev.target.value, { limit: 6 }); zeichneListe(); } }),
      ]),
      liste,
    ]);
  }

  function bereichswahl(p) {
    return el("div", { class: "chipzeile" }, alleBereiche().map((b) => el("button", {
      class: `chip${p.satz.bereich === b.id ? " aktiv" : ""}`, text: b.label,
      onclick: () => setzen(p, { bereich: b.id, bereichUnklar: false }),
    })));
  }

  async function setzen(p, felder) {
    const store_ = p.art === "aufgabe" ? db.STORE_AUFGABEN : db.STORE_POSTEN;
    if (p.art === "aufgabe") {
      await db.schreiben(store_, { ...p.satz, ...felder });
      p.satz = { ...p.satz, ...felder };
    } else {
      p.satz = await repo.aendern(store_, p.satz, felder);
    }
    zuordnung = null;
    zeichne();
    hinweis("Zugeordnet.", "gut");
  }

  // ---- Entscheidungen -----------------------------------------------------
  function wege(p) {
    const k = (text, art, was) => el("button", {
      class: `knopf ${art}`, text,
      onclick: was ? () => tun(p, was) : weiter,
    });
    const hatFrist = !!(p.satz.frist || p.satz.faellig);

    if (p.grund === "ungeprueft") {
      return [
        k("Stimmt so", "voll", "bestaetigen"),
        k("Weg damit", "", "verwerfen"),
        k("Später ansehen", "", null),
      ];
    }
    if (p.grund === "ueberfaellig") {
      return [
        k(erledigtText(p), "voll", "erledigt"),
        hatFrist ? k("Neue Frist: in einer Woche", "", "verschieben") : null,
        k("Später ansehen", "", null),
      ].filter(Boolean);
    }
    // Altlast: das Entscheidende ist der Unterschied zwischen „lebt noch"
    // und „ist tot". Die Uhr zurückzusetzen ist eine eigene Antwort.
    return [
      k(erledigtText(p), "voll", "erledigt"),
      k("Lebt noch — Uhr zurücksetzen", "", "angefasst"),
      k("Weg damit", "", "verwerfen"),
      k("Später ansehen", "", null),
    ];
  }

  /** "Erledigt" heißt nur dann wirklich erledigt, wenn die Dokumente auch
   *  abgelegt werden. Sonst verschwindet der Eintrag aus der Liste, während
   *  die Rechnung weiter unsortiert in 00_INBOX liegt — genau die Kritik,
   *  die den Umbau ausgelöst hat. */
  function erledigtText(p) {
    const ziel = zielVon(p);
    if (was_ablegbar(p, ziel)) {
      const n = dateien.length;
      return `Erledigt · ${n} ${n === 1 ? "Datei" : "Dateien"} ablegen`;
    }
    return "Erledigt";
  }

  const was_ablegbar = (p, ziel) => p.art !== "aufgabe" && dateien.length > 0 && !!ziel;

  function zielVon(p) {
    const s = p.satz;
    if (s.projektId) {
      const pr = projektMit(s.projektId);
      if (pr) return { ziel: pr, istProjekt: true };
    }
    if (s.bereich) {
      const b = BEREICHSZIEL[s.bereich];
      if (b) return { ziel: b, istProjekt: false };
    }
    return null;
  }

  async function tun(p, was) {
    try {
      if (was === "erledigt") {
        const z = zielVon(p);
        if (was_ablegbar(p, z)) {
          await ablegen.merkeAlle(dateien, z.ziel, z.istProjekt);
          hinweis(`${dateien.length} zur Ablage vorgemerkt.`, "gut");
        }
      }
      if (p.art === "aufgabe") await aufgabe(p.satz, was);
      else {
        const store_ = p.art === "vorgang" ? db.STORE_VORGAENGE : db.STORE_POSTEN;
        await repo.aendern(store_, p.satz, postenFelder(was));
      }
      weiter();
    } catch (e) {
      hinweis(`Ging nicht: ${e.message}`, "warnung");
    }
  }

  async function aufgabe(a, was) {
    if (was === "bestaetigen") { await planner.bestaetigen(a); return lokal(a, { geprueft: true }); }
    if (was === "verschieben") { await planner.fristSetzen(a, inTagen(7)); return lokal(a, { faellig: inTagen(7) }); }
    if (was === "angefasst") return lokal(a, { letzteBewegung: HEUTE() });
    // Erledigt und Verworfen sind bei Planner-Aufgaben tatsächlich dasselbe:
    // Planner kennt kein „verworfen". Der Unterschied wird lokal vermerkt,
    // damit die Auswertung ihn später trennen kann.
    await planner.erledigen(a);
    return lokal(a, { erledigt: true, fortschritt: 100, verworfen: was === "verwerfen" });
  }

  const postenFelder = (was) => ({
    bestaetigen: { geprueft: true },
    erledigt: { status: "erledigt" },
    verwerfen: { status: "erledigt", verworfen: true, geprueft: true },
    angefasst: { letzteBewegung: HEUTE(), geprueft: true },
    verschieben: { frist: inTagen(7), fristText: `${tag(inTagen(7))} (verschoben ${tag(HEUTE())})` },
  }[was] || {});

  const lokal = (a, felder) => db.schreiben(db.STORE_AUFGABEN, { ...a, ...felder, letzteBewegung: HEUTE() });

  function grundtext(p) {
    const s = p.satz;
    if (p.grund === "ungeprueft") return "Vom Morgen-Briefing angelegt und nie bestätigt.";
    if (p.grund === "altlast") return `Keine Bewegung ${seitText(s.letzteBewegung || s.wartetSeit || s.datum)}.`;
    const d = s.frist || s.faellig;
    return d ? fristText(d, s.fristZeit) : "Frist überschritten.";
  }

  function felder(p) {
    const s = p.satz;
    return [
      ["Art", p.art === "aufgabe" ? "Planner-Aufgabe" : p.art === "vorgang" ? "Vorgang" : "Eingangsposten"],
      ["Eingang", s.datum ? tag(s.datum) : null],
      ["Frist", s.frist ? tag(s.frist) : s.faellig ? tag(s.faellig) : klar(s.fristText) || null],
      ["Wartet auf", repo.istIch(s.wartetAuf) ? null : klar(s.wartetAuf) || null],
      ["Vorgang", s.vorgang || null],
    ].filter(([, w]) => w);
  }

  ruecksetzen();
  zeichne();
}
