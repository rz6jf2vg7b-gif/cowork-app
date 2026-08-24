// Microsoft Planner — die Aufgaben selbst. Kein JSON dazwischen: Planner ist
// seit dem 01.08.2026 die einzige Liste, in der gearbeitet wird. Ein eigener
// Abzug in OneDrive wäre genau die zweite Liste, die damals abgeschafft wurde.
//
// Der lokale Zwischenspeicher in IndexedDB ist kein zweiter Stand, sondern nur
// das zuletzt Gesehene, damit die App im Funkloch etwas anzeigen kann.
import { graph } from "./microsoft.js";

const PLAN = "oBTjhqXmfUqKXtNOEhKCPpgADQ1l";   // "CoWork_OS — Aufgaben", Team kreativLABOR42

// Planner-Bucket → Bereich der Stammdaten. Die Buckets heißen wie die
// Lebensbereiche, aber nicht identisch — die Zuordnung muss explizit sein,
// sonst landet alles in "unbekannt".
const BUCKET_BEREICH = [
  [/kreativ/i, "kl"], [/mvv/i, "mvv"], [/sgg|t2/i, "sgg"],
  [/passive|sidehustle|income/i, "sidehustle"], [/joy|kind/i, "joy"],
  [/privat/i, "privat"], [/system|cowork/i, "sidehustle"],
];

let buckets = new Map();

async function bucketsLaden() {
  const d = await graph(`/planner/plans/${PLAN}/buckets`);
  buckets = new Map((d?.value || []).map((b) => [b.id, b.name]));
  return buckets;
}

const bereichAus = (name) =>
  (BUCKET_BEREICH.find(([m]) => m.test(name || "")) || [null, null])[1];

/** Planner-Aufgabe in die Form bringen, die der Rest der App kennt. */
function umformen(a) {
  const bucket = buckets.get(a.bucketId) || "";
  const titel = (a.title || "").trim();
  return {
    id: a.id,
    titel: titel.replace(/^⚙️\s*/, ""),
    // Das Prüffähnchen steht im Planner-Titel, nicht in einem eigenen Feld.
    // Bestätigen heißt deshalb: den Titel umbenennen — siehe bestaetigen().
    geprueft: !titel.startsWith("⚙️"),
    bucket,
    bereich: bereichAus(bucket),
    faellig: a.dueDateTime ? a.dueDateTime.slice(0, 10) : null,
    fortschritt: a.percentComplete || 0,
    erledigt: (a.percentComplete || 0) >= 100,
    etag: a["@odata.etag"],
    quelle: "planner",
  };
}

export async function aufgaben({ nurOffene = true } = {}) {
  await bucketsLaden();
  const d = await graph(`/planner/plans/${PLAN}/tasks`);
  let liste = (d?.value || []).map(umformen);
  if (nurOffene) liste = liste.filter((a) => !a.erledigt);
  liste.sort((a, b) => (a.faellig || "9999").localeCompare(b.faellig || "9999")
    || a.titel.localeCompare(b.titel));
  return liste;
}

/** Planner verlangt bei jeder Änderung das eTag der gelesenen Fassung.
 *  Ist es veraltet, antwortet Graph mit 412 — dann neu lesen statt erzwingen. */
async function aendern(aufgabe, felder) {
  return graph(`/planner/tasks/${aufgabe.id}`, {
    methode: "PATCH", koerper: felder,
    kopf: { "If-Match": aufgabe.etag, Prefer: "return=representation" },
  });
}

export const erledigen = (a) => aendern(a, { percentComplete: 100 });
export const oeffnen = (a) => aendern(a, { percentComplete: 0 });

/** Bestätigen entfernt das ⚙️ aus dem Titel — dort und nur dort sitzt es.
 *  Eine Änderung in tasks.md wäre wirkungslos: der Spiegel-Block wird bei
 *  jedem Lauf vollständig aus Planner neu geschrieben. */
export const bestaetigen = (a) => aendern(a, { title: a.titel });

export function fristSetzen(a, iso) {
  return aendern(a, { dueDateTime: iso ? `${iso}T12:00:00Z` : null });
}

export const planUrl = () => `https://tasks.office.com/`;
