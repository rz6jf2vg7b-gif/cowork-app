// Fachliche Sicht auf die gespeicherten Daten. Alles, was mehr als eine
// Ansicht braucht, steht hier — nicht in den Ansichten selbst.
import * as db from "./db.js";
import { tageBis, tageSeit, HEUTE } from "../core/fmt.js";

const lebend = (s) => !s.geloescht;
const offen = (s) => !["erledigt", "abgeschlossen"].includes(s.status);

export const posten = async () => (await db.alle(db.STORE_POSTEN)).filter(lebend);
export const vorgaenge = async () => (await db.alle(db.STORE_VORGAENGE)).filter(lebend);
export const ausgang = async () => (await db.alle(db.STORE_AUSGANG)).filter(lebend);
export const aufgaben = async () => db.alle(db.STORE_AUFGABEN);
export const projekte = async () => db.alle(db.STORE_PROJEKTE);
/** Die Dateien zu einem Posten. Erzeugt von dokumentenindex.py auf dem Mac:
 *  im Datenmodell fehlt die Verknüpfung, sie wird über die .eml-Kopfzeilen
 *  rekonstruiert (Absender + Datum). 20 von 28 Posten haben dadurch Dateien. */
export async function dokumenteZu(postenId) {
  const e = await db.holen(db.STORE_DOKUMENTE, postenId);
  return e?.dateien || [];
}

export const ablage = async () => (await db.alle(db.STORE_ABLAGE)).filter(lebend);
/** Zugeordnet, aber vom Mac noch nicht ausgeführt. */
export const ablageOffen = async () => (await ablage()).filter((z) => !z.erledigt);

export const offenePosten = async () => (await posten()).filter(offen);
export const offeneVorgaenge = async () => (await vorgaenge()).filter(offen);

/** Alles mit Datum aus allen drei Quellen — die Grundlage für Heute und den
 *  Frist-Kalender. Eine Frist ist eine Frist, egal woher sie stammt. */
export async function fristen() {
  const raus = [];
  for (const p of await offenePosten()) {
    if (p.frist) raus.push({ art: "posten", id: p.id, datum: p.frist, zeit: p.fristZeit,
                             titel: p.betreff, neben: p.absender, bereich: p.bereich,
                             vorgang: p.vorgang, satz: p });
  }
  for (const a of await aufgaben()) {
    if (a.faellig && !a.erledigt) raus.push({ art: "aufgabe", id: a.id, datum: a.faellig,
                                              titel: a.titel, neben: a.bucket,
                                              bereich: a.bereich, satz: a });
  }
  raus.sort((x, y) => x.datum.localeCompare(y.datum));
  return raus;
}

export const ueberfaellig = async () => (await fristen()).filter((f) => tageBis(f.datum) < 0);
export const heuteFaellig = async () => (await fristen()).filter((f) => tageBis(f.datum) === 0);

/** Ungeprüftes aus dem Morgen-Briefing — Posten wie Aufgaben. Der Marker sitzt
 *  bei Posten im Feld, bei Aufgaben im Planner-Titel. */
export async function ungeprueft() {
  return [
    ...(await offenePosten()).filter((p) => !p.geprueft)
      .map((p) => ({ art: "posten", satz: p, titel: p.betreff, neben: p.absender })),
    ...(await aufgaben()).filter((a) => !a.geprueft && !a.erledigt)
      .map((a) => ({ art: "aufgabe", satz: a, titel: a.titel, neben: a.bucket })),
  ];
}

/** Altlast-Radar: was sich seit über N Tagen nicht bewegt hat. Als Bezugspunkt
 *  gilt die letzte Bewegung, nicht das Eingangsdatum — ein Posten, an dem
 *  gestern gearbeitet wurde, ist keine Altlast, auch wenn er im März kam. */
export async function altlasten(tage = 30) {
  const bewegung = (s) => s.letzteBewegung || s.wartetSeit || s.datumBis || s.datum || s.angelegt;
  const alt = [];
  for (const p of await offenePosten()) {
    const t = tageSeit(bewegung(p));
    if (t !== null && t >= tage) alt.push({ art: "posten", satz: p, tage: t,
                                            titel: p.betreff, neben: p.absender });
  }
  for (const v of await offeneVorgaenge()) {
    const letzte = v.chronologie?.length ? v.chronologie[v.chronologie.length - 1].datum : v.eroeffnet;
    const t = tageSeit(letzte);
    if (t !== null && t >= tage) alt.push({ art: "vorgang", satz: v, tage: t,
                                            titel: v.titel, neben: v.projekt });
  }
  alt.sort((a, b) => b.tage - a.tage);
  return alt;
}

/** Steffen selbst ist kein Nachfassziel. Rund 24 der 27 Einträge tragen ihn
 *  als "Wartet auf" — er ist ja der Bearbeiter. Bliebe er drin, wäre die
 *  Nachfassliste nur eine zweite Arbeitsliste und der eigentliche Zweck
 *  (wo hängt es bei anderen?) ginge in der eigenen Masse unter. */
const ICH = /^steffen\b/i;
export const istIch = (wer) => ICH.test((wer || "").trim());

/** Nach "Wartet auf" gruppiert — die Nachfassliste. Zeigt, wo andere am Zug
 *  sind; ohne diese Sicht sieht jeder offene Posten aus wie eigene Arbeit. */
export async function wartetAuf({ ohneMich = true } = {}) {
  const gruppen = new Map();
  const zufuegen = (wer, eintrag) => {
    const schluessel = (wer || "—").trim();
    if (!gruppen.has(schluessel)) gruppen.set(schluessel, []);
    gruppen.get(schluessel).push(eintrag);
  };
  for (const p of await offenePosten()) {
    if (p.wartetAuf) zufuegen(p.wartetAuf, { art: "posten", satz: p, titel: p.betreff,
                                             seit: p.wartetSeit || p.datum });
  }
  // Ein versendeter Brief ohne Antwort ist der klarste Fall von "liegt bei
  // jemand anderem" — er stand bisher nur im Ausgang und tauchte in keiner
  // Nachfassliste auf. Genau daran ist der Kellermann-Vorgang hängen geblieben.
  for (const e of await ausgang()) {
    if (!/Antwort offen/i.test(e.status || "")) continue;
    zufuegen(e.empfaenger, { art: "ausgang", satz: e, titel: e.betreff,
                             seit: e.datumBis || e.datum });
  }
  for (const v of await offeneVorgaenge()) {
    if (!v.wartetAuf) continue;
    // "Wartet auf" führt bei Vorgängen mehrere Beteiligte, getrennt durch ·
    for (const wer of v.wartetAuf.split("·")) {
      const name = wer.replace(/\s*—.*$/, "").trim();
      if (name) zufuegen(name, { art: "vorgang", satz: v, titel: v.titel,
                                 seit: v.chronologie?.at(-1)?.datum });
    }
  }
  return [...gruppen.entries()]
    .filter(([wer]) => !(ohneMich && (istIch(wer) || wer === "—")))
    .map(([wer, eintraege]) => ({ wer, eintraege,
      aeltester: eintraege.reduce((m, e) => Math.max(m, tageSeit(e.seit) ?? 0), 0) }))
    .sort((a, b) => b.aeltester - a.aeltester);
}

export const vorgang = async (id) => (await vorgaenge()).find((v) => v.id === id) || null;
export const projekt = async (id) => (await projekte()).find((p) => p.id === id) || null;

export async function postenZumVorgang(vid) {
  return (await posten()).filter((p) => p.vorgang === vid);
}

/** Änderung festhalten: Zeitstempel setzen, lokal speichern, für den nächsten
 *  Abgleich vormerken. Ohne die Vormerkung ginge eine Änderung verloren, die
 *  im Funkloch entstanden ist. */
export async function aendern(store, satz, felder) {
  const neu = { ...satz, ...felder, geaendert: new Date().toISOString(),
                letzteBewegung: HEUTE() };
  await db.schreiben(store, neu);
  await db.schreiben(db.STORE_OFFEN, { id: `${store}:${neu.id}`, store, satzId: neu.id,
                                       am: new Date().toISOString() });
  return neu;
}

export const offeneAenderungen = () => db.alle(db.STORE_OFFEN);
export const aenderungErledigt = (id) => db.entfernen(db.STORE_OFFEN, id);
