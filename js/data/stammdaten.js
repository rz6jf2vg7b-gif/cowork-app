// Bereiche und Projekte — der gemeinsame Stamm beider Apps.
// Quelle: CoWork_OS/data/stammdaten.json, erzeugt von stammdaten.py.
import * as db from "./db.js";

// Notnagel, solange nichts geladen ist. Ohne ihn stünde beim allerersten Start
// überall "unbekannt", weil die Bereiche erst mit dem ersten Abgleich kommen.
const VORGABE = [
  { id: "kl", label: "kreativLABOR42", kurz: "kL42", aliase: ["KL"] },
  { id: "mvv", label: "MVV Netze", kurz: "MVV", aliase: ["MV"] },
  { id: "sgg", label: "SGG T2,6 GbR", kurz: "SGG", aliase: ["SG"] },
  { id: "sidehustle", label: "Sidehustle", kurz: "SH", aliase: ["PI"] },
  { id: "privat", label: "Privat", kurz: "Privat", aliase: ["PR"] },
  { id: "joy", label: "Joy", kurz: "Joy", aliase: [] },
];

let bereiche = VORGABE;
let projekte = [];
let nachId = new Map();

export async function laden() {
  projekte = await db.alle(db.STORE_PROJEKTE);
  nachId = new Map(projekte.map((p) => [p.id, p]));
  kuerzelIndex = null;                     // Index bei nächster Nutzung neu bauen
  const gespeichert = (await db.holen(db.STORE_KONFIG, "bereiche"))?.value;
  bereiche = gespeichert?.length ? gespeichert : VORGABE;
  return projekte;
}

export async function bereicheMerken(liste) {
  if (!liste?.length) return;
  await db.schreiben(db.STORE_KONFIG, { key: "bereiche", value: liste });
  bereiche = liste;
}

export const alleBereiche = () => bereiche;
export const bereich = (id) => bereiche.find((b) => b.id === id) || null;
export const bereichLabel = (id) => bereich(id)?.label || "ohne Bereich";
export const bereichKurz = (id) => (id ? (bereich(id)?.aliase?.[0] || bereich(id)?.kurz || id) : "?");

export const alleProjekte = () => projekte;
export const projekt = (id) => nachId.get(id) || null;
export const projektName = (id) => projekt(id)?.name || null;

/** Suche wie in der Stundenerfassung: Kürzel schlägt Nummer schlägt Name.
 *  "QGW" muss das Stadtquartier finden, nicht den ersten Namenstreffer. */
export function suche(text, { bereich: b = null, limit = 40 } = {}) {
  const worte = (text || "").toLowerCase().trim().split(/\s+/).filter(Boolean);
  let basis = projekte;
  if (b) basis = basis.filter((p) => p.bereich === b);
  if (!worte.length) {
    // Ohne Suchbegriff nach Bereich sortieren, kreativLABOR42 zuerst. Ungefiltert
    // dominieren die 617 MVV-Projekte die 161 des Büros — und ein Scan gehört
    // fast immer zu einem Büroprojekt.
    const rang = new Map(bereiche.map((b, i) => [b.id, b.reihung ?? i]));
    return basis.filter((p) => p.aktiv)
      .sort((a, b) => (rang.get(a.bereich) ?? 99) - (rang.get(b.bereich) ?? 99)
        || String(b.nr || "").localeCompare(String(a.nr || "")))
      .slice(0, limit);
  }
  const treffer = [];
  for (const p of basis) {
    const suchtext = [p.nr, p.kuerzel, p.name, p.ort, p.auftrag].filter(Boolean).join(" ").toLowerCase();
    if (!worte.every((w) => suchtext.includes(w))) continue;
    treffer.push({ p, punkte: guete(p, worte[0]) + (p.aktiv ? 15 : 0) });
  }
  treffer.sort((a, b2) => b2.punkte - a.punkte || a.p.name.localeCompare(b2.p.name));
  return treffer.slice(0, limit).map((t) => t.p);
}

/* ===== Projekt aus freiem Text erkennen ================================
 *
 * Die Kette Eingang → Vorgang → Aufgabe bricht bei der Aufgabe ab: Planner
 * kennt keine Vorgangsnummer. Das einzige durchgehende Band ist das Projekt —
 * es steht bei 63 % der Aufgaben als Präfix im Titel ("QGW: …") und ist
 * derselbe Stamm wie in der Stundenerfassung.
 *
 * Aufgelöst wird gegen den echten Katalog, nicht geraten: 222 Projekte tragen
 * ein Kürzel (QGW → 1909, OFS → 2019, T2,6 → 2016). Was sich nicht auflösen
 * lässt, behält seinen Rohtext als Gruppenname — Fielmann und Salon etwa
 * existieren in untermStrich gar nicht (bekannte Lücke seit 01.08.2026).
 */
let kuerzelIndex = null;

function indexBauen() {
  // Projektnummern, die mehrfach vergeben sind, tragen keine Information und
  // fliegen raus: "1909" gehört sowohl zum Stadtquartier (QGW) als auch zu
  // WE21_Familie Hofmeier. Ein Treffer darauf wäre geraten, nicht erkannt.
  const nrZaehler = new Map();
  for (const p of projekte) {
    if (p.nr && /^\d{4}$/.test(String(p.nr))) {
      nrZaehler.set(String(p.nr), (nrZaehler.get(String(p.nr)) || 0) + 1);
    }
  }

  // Kürzel, die zugleich ein Bereichsname sind, tragen keine Projekt-
  // information: "MVV" in "MVV-Buchungsschluss" meint den Lebensbereich,
  // nicht das Projekt "MVV Mastbegehung 2026".
  const bereichsworte = new Set();
  for (const b of bereiche) {
    for (const w of [b.id, b.kurz, b.label, ...(b.aliase || [])]) {
      if (w) bereichsworte.add(einheitlich(w));
    }
  }

  kuerzelIndex = [];
  for (const p of projekte) {
    if (p.kuerzel && p.kuerzel.length >= 2 && !bereichsworte.has(einheitlich(p.kuerzel))) {
      kuerzelIndex.push({ begriff: einheitlich(p.kuerzel), id: p.id, rang: 0 });
    }
    if (p.nr && /^\d{4}$/.test(String(p.nr)) && nrZaehler.get(String(p.nr)) === 1) {
      kuerzelIndex.push({ begriff: String(p.nr), id: p.id, rang: 1 });
    }
  }
  // Kürzel schlagen Nummern, längere schlagen kürzere. Ohne die erste Regel
  // gewinnt die vierstellige Nummer gegen das dreistellige Kürzel — genau
  // daran ging "1909 QGW" ans falsche Projekt.
  kuerzelIndex.sort((a, b) => a.rang - b.rang || b.begriff.length - a.begriff.length);
}

const entschaerft = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normal = (s) => (s || "").toLowerCase().replace(/[\s_,./–-]+/g, "");

/** Kleinschreibung und Leerzeichen um Trennzeichen vereinheitlichen.
 *  Zwei Planner-Aufgaben schreiben "T2, 6:", das Kürzel lautet "T2,6" —
 *  ohne diesen Schritt sind das zwei verschiedene Projekte. */
const einheitlich = (s) => (s || "").toLowerCase()
  .replace(/\s*([,./–-])\s*/g, "$1")
  .replace(/\s+/g, " ")
  .trim();

/** Das Projekt zu einem Textstück, oder null. */
export function projektAus(text) {
  if (!text) return null;
  if (!kuerzelIndex) indexBauen();
  const t = einheitlich(text);

  // 1. Kürzel oder Projektnummer, an Wortgrenzen — sonst trifft "T2" in
  //    "T2,6" und in jedem beliebigen Kennzeichen.
  for (const { begriff, id } of kuerzelIndex) {
    if (new RegExp(`(^|[^\\wäöüß])${entschaerft(begriff)}([^\\wäöüß]|$)`, "i").test(t)) {
      return nachId.get(id) || null;
    }
  }

  // 2. Ganzes Präfix im Projektnamen enthalten — nur bei genau einem Treffer.
  //    Fängt "Theodor-Heuss-Schule:" ab, dessen Kürzel THS-B im Titel fehlt.
  const n = normal(text);
  if (n.length >= 5) {
    const treffer = projekte.filter((p) => normal(p.name).includes(n));
    if (treffer.length === 1) return treffer[0];
    // Mehrdeutig: der Projektstatus entscheidet. "Theodor-Heuss-Schule" trifft
    // 1701 (Bau B, aktiv) und 2010 (Bau C, abgeschlossen) — gemeint ist immer
    // das laufende. Genau dafür gibt es f_29 in untermStrich.
    const laufend = treffer.filter((p) => p.aktiv);
    if (laufend.length === 1) return laufend[0];
  }
  return null;
}

/** Gruppenschlüssel für eine Liste: bevorzugt das erkannte Projekt, sonst der
 *  Rohtext des Präfixes, sonst der Bereich. Nie leer — eine Zeile ohne Gruppe
 *  fiele aus der Ansicht heraus. */
export function gruppe(text, ersatzLabel = "Ohne Projekt") {
  const praefix = (text || "").split(":")[0].trim();
  const p = projektAus(praefix) || projektAus(text);
  if (p) {
    return { id: p.id, label: p.kuerzel ? `${p.kuerzel} · ${p.name}` : p.name,
             kurz: p.kuerzel || p.nr || p.name, projekt: p };
  }
  if (praefix && praefix.length >= 3 && praefix.length < 40 && praefix !== text) {
    return { id: `roh:${praefix}`, label: praefix, kurz: praefix, projekt: null };
  }
  return { id: `ersatz:${ersatzLabel}`, label: ersatzLabel, kurz: ersatzLabel, projekt: null };
}

function guete(p, wort) {
  const k = (p.kuerzel || "").toLowerCase();
  const n = String(p.nr || "").toLowerCase();
  const name = p.name.toLowerCase();
  if (k === wort) return 100;
  if (n === wort) return 95;
  if (k.startsWith(wort)) return 80;
  if (n.startsWith(wort)) return 70;
  if (name.startsWith(wort)) return 60;
  return 30;
}
