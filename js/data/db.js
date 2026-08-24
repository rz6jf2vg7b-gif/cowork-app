// IndexedDB — nur Öffnen und die rohen Operationen. Fachlogik gehört nach
// repo.js, damit ein späterer Wechsel der Ablage genau diese Datei ersetzt.
//
// Warum überhaupt eine lokale Datenbank, wo die Wahrheit auf OneDrive liegt:
// ohne sie steht die App im Funkloch leer da. Auf der Baustelle ist genau das
// der Normalfall — und dort will Steffen nachsehen, was offen ist.

const NAME = "cowork";
const VERSION = 1;

export const STORE_POSTEN = "posten";        // Eingangsposten
export const STORE_VORGAENGE = "vorgaenge";  // Akten mit Chronologie
export const STORE_AUSGANG = "ausgang";
export const STORE_AUFGABEN = "aufgaben";    // Planner-Abzug, nur zwischengespeichert
export const STORE_PROJEKTE = "projekte";    // Stammdaten-Abzug
export const STORE_KONFIG = "konfig";
export const STORE_OFFEN = "offen";          // noch nicht übertragene Änderungen

const ALLE = [STORE_POSTEN, STORE_VORGAENGE, STORE_AUSGANG,
              STORE_AUFGABEN, STORE_PROJEKTE, STORE_KONFIG, STORE_OFFEN];

let dbPromise = null;

export function oeffnen() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((ok, fehler) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ALLE) {
        if (db.objectStoreNames.contains(s)) continue;
        const store = db.createObjectStore(s, { keyPath: s === STORE_KONFIG ? "key" : "id" });
        if (s === STORE_POSTEN) { store.createIndex("frist", "frist"); store.createIndex("status", "status"); }
        if (s === STORE_AUFGABEN) store.createIndex("faellig", "faellig");
      }
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fehler(req.error);
    req.onblocked = () => fehler(new Error("Datenbank durch ein anderes Fenster blockiert — andere Tabs schließen."));
  });
  return dbPromise;
}

function fuehreAus(store, modus, arbeit) {
  return oeffnen().then((db) => new Promise((ok, fehler) => {
    const tx = db.transaction(store, modus);
    const req = arbeit(tx.objectStore(store));
    tx.onerror = () => fehler(tx.error);
    if (req) { req.onsuccess = () => ok(req.result); req.onerror = () => fehler(req.error); }
    else tx.oncomplete = () => ok();
  }));
}

export const alle = (s) => fuehreAus(s, "readonly", (o) => o.getAll());
export const holen = (s, id) => fuehreAus(s, "readonly", (o) => o.get(id));
export const schreiben = (s, wert) => fuehreAus(s, "readwrite", (o) => o.put(wert));
export const entfernen = (s, id) => fuehreAus(s, "readwrite", (o) => o.delete(id));

export function ersetzeAlle(store, werte) {
  return oeffnen().then((db) => new Promise((ok, fehler) => {
    const tx = db.transaction(store, "readwrite");
    const o = tx.objectStore(store);
    o.clear();
    for (const w of werte) o.put(w);
    tx.oncomplete = () => ok(werte.length);
    tx.onerror = () => fehler(tx.error);
  }));
}
