// Eine Ablage-Entscheidung notieren. Ausgeführt wird sie auf dem Mac.
//
// Die App verschiebt bewusst nicht selbst: die Projektordner auf OneDrive sind
// Arbeitskopien, `projekt_rucksync.py` läuft nur NAS → OneDrive. Eine dort
// abgelegte Datei läge in einer Kopie, die niemand mehr beachtet.
//
// Schlüssel ist Ordner + Dateiname, nicht die Graph-Kennung: `ablage_ausfuehren.py`
// sucht die Datei ohnehin über den Namen, und so entstehen keine Doppel, wenn
// dieselbe Datei aus dem Eingangskorb und aus dem Durchlauf zugeordnet wird.
import * as db from "./db.js";

export const schluessel = (ordner, name) => `${ordner}/${name}`;

export function eintrag({ ordner, name, ziel, istProjekt }) {
  const jetzt = new Date().toISOString();
  return {
    id: schluessel(ordner, name),
    name,
    quelle: ordner,
    zielArt: istProjekt ? "projekt" : "bereich",
    zielId: ziel.id,
    zielLabel: istProjekt ? `${ziel.kuerzel || ziel.nr || ""} ${ziel.name}`.trim() : ziel.label,
    projektNr: istProjekt ? ziel.nr : null,
    projektName: istProjekt ? ziel.name : null,
    bereichsPfad: istProjekt ? null : ziel.pfad,
    zugeordnetAm: jetzt,
    // Was in der App entsteht, hat Steffen selbst gewählt — also bestätigt.
    // Der Morgen-Briefing-Task schreibt dagegen bestaetigt:false, und
    // ablage_ausfuehren.py vollzieht nur Bestätigtes.
    bestaetigt: true,
    erledigt: false,
    geaendert: jetzt,
    geloescht: null,
  };
}

export async function merken(daten) {
  const satz = eintrag(daten);
  await db.schreiben(db.STORE_ABLAGE, satz);
  await db.schreiben(db.STORE_OFFEN, { id: `ablage:${satz.id}`, store: db.STORE_ABLAGE,
                                       satzId: satz.id, am: satz.geaendert });
  return satz;
}

/** Mehrere Dateien auf dasselbe Ziel — der Fall aus dem Durchlauf, wo ein
 *  Posten seine Mail und deren Anhänge mitbringt. */
export async function merkeAlle(dateien, ziel, istProjekt) {
  const raus = [];
  for (const d of dateien) {
    raus.push(await merken({ ordner: d.ordner, name: d.name, ziel, istProjekt }));
  }
  return raus;
}
