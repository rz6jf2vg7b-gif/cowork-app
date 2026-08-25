// Der Eingangskorb: was in OneDrive unter 00_INBOX/ liegt und noch niemandem
// gehört. Gescannte Post und Anhänge aus dem Morgen-Briefing.
//
// Bewusst OHNE die .eml-Dateien: die 93 exportierten Mails gehören fachlich in
// die Eingangs-Datenbank, nicht in die Ablage — dort entscheidest du nichts.
// Aufgenommen sind die 70 Anhänge, denn die haben bislang überhaupt keinen Weg
// hinaus: der Monitor legt sie ab, und nichts holt sie wieder heraus.
import { graph } from "./microsoft.js";

const WURZEL = "/me/drive/root:/00_INBOX";
const QUELLEN = [
  { pfad: "Scans", art: "scan", label: "Scan" },
  { pfad: "eMails", art: "anhang", label: "Anhang" },
];

// Was in der Ablage nichts zu suchen hat
const UEBERGEHEN = /^(\.|_VERMERK|_WARTET_AUF)/i;
const IST_MAIL = /\.eml$/i;

function umformen(d, quelle) {
  const endung = (d.name.split(".").pop() || "").toLowerCase();
  return {
    id: d.id,
    name: d.name,
    quelle: quelle.pfad,
    art: quelle.art,
    endung,
    groesse: d.size || 0,
    geaendert: (d.lastModifiedDateTime || "").slice(0, 10),
    typ: d.file?.mimeType || "",
    // Vorschaubild liefert Graph für PDF, Bilder und Office-Dateien mit
    vorschau: d.thumbnails?.[0]?.medium?.url || null,
    gross: d.thumbnails?.[0]?.large?.url || null,
    // Kurzlebige, vorab autorisierte Adresse — nicht speichern, nur öffnen
    oeffnen: d["@microsoft.graph.downloadUrl"] || null,
  };
}

export async function dateien() {
  const raus = [];
  for (const q of QUELLEN) {
    const d = await graph(`${WURZEL}/${q.pfad}:/children?$expand=thumbnails&$top=200`);
    if (d?._nichtGefunden) continue;
    for (const eintrag of d?.value || []) {
      if (!eintrag.file) continue;                       // Ordner überspringen
      if (UEBERGEHEN.test(eintrag.name)) continue;
      if (q.art === "anhang" && IST_MAIL.test(eintrag.name)) continue;
      raus.push(umformen(eintrag, q));
    }
  }
  // Neueste zuerst — frisch Gescanntes ist das, was du zuordnen willst
  raus.sort((a, b) => (b.geaendert || "").localeCompare(a.geaendert || ""));
  return raus;
}

/** Frische Öffnen-Adresse für eine Datei. Die aus der Liste läuft nach
 *  etwa einer Stunde ab — nach einer Weile in der App wäre sie tot. */
export async function adresse(id) {
  const d = await graph(`/me/drive/items/${id}?$select=@microsoft.graph.downloadUrl`);
  return d?.["@microsoft.graph.downloadUrl"] || null;
}

export const lesbar = (b) =>
  b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB`
  : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`;
