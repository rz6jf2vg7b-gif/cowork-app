// Zustand der App: laden, abgleichen, benachrichtigen. Die Ansichten fragen
// nie selbst bei OneDrive an — sie zeichnen, was hier liegt, und werden neu
// gezeichnet, wenn sich etwas ändert.
import * as db from "../data/db.js";
import * as repo from "../data/repo.js";
import * as cowork from "../sync/cowork.js";
import * as planner from "../sync/planner.js";
import * as microsoft from "../sync/microsoft.js";

const hoerer = new Set();
export const abonnieren = (f) => { hoerer.add(f); return () => hoerer.delete(f); };
const melden = () => hoerer.forEach((f) => f());

export const zustand = {
  geladen: false,
  abgleichLaeuft: false,
  letzterAbgleich: null,
  letzterFehler: null,
  angemeldet: false,
};

const KONFIG = "stand";

async function konfigLesen() {
  return (await db.holen(db.STORE_KONFIG, KONFIG))?.value || {};
}

async function konfigSchreiben(werte) {
  const alt = await konfigLesen();
  await db.schreiben(db.STORE_KONFIG, { key: KONFIG, value: { ...alt, ...werte } });
}

export async function starten() {
  const stand = await konfigLesen();
  zustand.letzterAbgleich = stand.letzterAbgleich || null;
  zustand.angemeldet = microsoft.angemeldet();
  zustand.geladen = true;
  melden();
}

const LISTEN = [
  ["eingang", db.STORE_POSTEN],
  ["vorgaenge", db.STORE_VORGAENGE],
  ["ausgang", db.STORE_AUSGANG],
  ["stammdaten", db.STORE_PROJEKTE],
  ["ablage", db.STORE_ABLAGE],
];

/** Ein Durchgang: OneDrive lesen, offene eigene Änderungen hochschieben,
 *  Planner nachziehen. Fehler brechen den Lauf nicht ab — eine unerreichbare
 *  Datei darf nicht verhindern, dass die anderen aktuell werden. */
export async function abgleichen({ still = false } = {}) {
  if (zustand.abgleichLaeuft) return;
  if (!microsoft.angemeldet()) { zustand.angemeldet = false; melden(); return; }

  zustand.abgleichLaeuft = true;
  zustand.letzterFehler = null;
  if (!still) melden();

  const fehler = [];
  try {
    for (const [name, store] of LISTEN) {
      try {
        const offen = (await repo.offeneAenderungen()).filter((o) => o.store === store);
        if (offen.length && name !== "stammdaten") {
          const eigene = await db.alle(store);
          const vereint = await cowork.speichern(name, eigene);
          await db.ersetzeAlle(store, vereint);
          for (const o of offen) await repo.aenderungErledigt(o.id);
        } else {
          const doc = await cowork.laden(name);
          if (doc) await db.ersetzeAlle(store, doc.saetze);
        }
      } catch (e) { fehler.push(`${name}: ${e.message}`); }
    }

    try {
      await db.ersetzeAlle(db.STORE_AUFGABEN, await planner.aufgaben({ nurOffene: false }));
    } catch (e) { fehler.push(`Planner: ${e.message}`); }

    zustand.letzterAbgleich = new Date().toISOString();
    await konfigSchreiben({ letzterAbgleich: zustand.letzterAbgleich });
  } finally {
    zustand.abgleichLaeuft = false;
    zustand.angemeldet = microsoft.angemeldet();
    zustand.letzterFehler = fehler.length ? fehler.join(" · ") : null;
    melden();
  }
}

/** Nach jeder Änderung: lokal ist sie schon gespeichert, hier wird gezeichnet
 *  und im Hintergrund übertragen. Die Oberfläche wartet nie auf das Netz. */
export function geaendert() {
  melden();
  abgleichen({ still: true }).catch(() => {});
}
