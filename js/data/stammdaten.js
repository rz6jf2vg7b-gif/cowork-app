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
    return basis.filter((p) => p.aktiv).slice(0, limit);
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
