// Ablage der drei Listen in OneDrive. Anmeldung siehe microsoft.js.
//
// Gelesen und geschrieben wird DIREKT in CoWork_OS/data/ — nicht in eine
// zweite Kopie unter Apps/. Der Ordner liegt ohnehin im OneDrive-Baum, den
// Steffens Mac synchronisiert; eine Zwischenkopie hätte nur einen weiteren
// Stand erzeugt, der auseinanderlaufen kann.
//
// Gleichzeitiges Schreiben: Die App ist nicht allein. Der Morgen-Briefing-Task
// und Claude schreiben dieselben Dateien. Deshalb wird jede Datei mit ihrem
// eTag gelesen und mit If-Match zurückgeschrieben; bei 412 wird neu gelesen,
// satzweise zusammengeführt und erneut versucht.
import { graph } from "./microsoft.js";

const ORDNER = "/me/drive/root:/CoWork_OS/data";
const DATEIEN = {
  eingang:    { datei: "eingang.json",    liste: "posten" },
  vorgaenge:  { datei: "vorgaenge.json",  liste: "vorgaenge" },
  ausgang:    { datei: "ausgang.json",    liste: "eintraege" },
  stammdaten: { datei: "stammdaten.json", liste: "projekte" },
  ablage:     { datei: "ablage.json",     liste: "zuordnungen" },
};

const etags = new Map();

export async function laden(name) {
  const { datei, liste } = DATEIEN[name];
  const kopf = await graph(`${ORDNER}/${datei}`);
  if (kopf?._nichtGefunden) return null;
  etags.set(name, kopf.eTag || kopf.cTag || null);
  const inhalt = await graph(`${ORDNER}/${datei}:/content`);
  if (inhalt?._nichtGefunden) return null;
  return { ...inhalt, _liste: liste, saetze: inhalt[liste] || [] };
}

async function schreibenRoh(name, doc) {
  const { datei } = DATEIEN[name];
  const etag = etags.get(name);
  const antwort = await graph(`${ORDNER}/${datei}:/content`, {
    methode: "PUT", koerper: doc,
    kopf: etag ? { "if-match": etag } : {},
  });
  etags.set(name, antwort?.eTag || antwort?.cTag || null);
  return antwort;
}

/** Der jüngere Satz gewinnt — satzweise, nicht dateiweise. Zwei Geräte, die
 *  verschiedene Posten anfassen, überschreiben sich damit nicht gegenseitig. */
export function zusammenfuehren(fremd, eigen) {
  const raus = new Map(fremd.map((s) => [s.id, s]));
  for (const s of eigen) {
    const da = raus.get(s.id);
    if (!da || (s.geaendert || "") > (da.geaendert || "")) raus.set(s.id, s);
  }
  return [...raus.values()];
}

export async function speichern(name, saetze) {
  const { liste } = DATEIEN[name];
  for (let versuch = 0; versuch < 3; versuch++) {
    const fremd = await laden(name);
    const vereint = fremd ? zusammenfuehren(fremd.saetze, saetze) : saetze;
    const doc = { ...(fremd || {}), [liste]: vereint, anzahl: vereint.length,
                  geaendertVon: "CoWork-App", geaendertAm: new Date().toISOString() };
    delete doc._liste; delete doc.saetze;
    try {
      await schreibenRoh(name, doc);
      return vereint;
    } catch (e) {
      // 412 = jemand anderes war schneller. Neu lesen und noch einmal mischen.
      if (!/412|precondition/i.test(e.message) || versuch === 2) throw e;
      etags.delete(name);
    }
  }
}

export const pfadAnzeige = () => "OneDrive → CoWork_OS → data";
