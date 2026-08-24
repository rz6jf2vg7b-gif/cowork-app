// Datum, Fristen, Fälligkeit. Eine Stelle, damit "überfällig" überall dasselbe
// heißt — in der Liste, im Durchlauf und im Kalender.

export const HEUTE = () => new Date().toISOString().slice(0, 10);

export function tag(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return isNaN(d) ? iso : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function tagKurz(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return isNaN(d) ? iso : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export function wochentag(iso) {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d) ? "" : d.toLocaleDateString("de-DE", { weekday: "short" });
}

/** Tage von heute bis zum Datum. Negativ = liegt in der Vergangenheit. */
export function tageBis(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return null;
  const h = new Date(HEUTE() + "T00:00:00");
  return Math.round((d - h) / 86400000);
}

export const tageSeit = (iso) => { const t = tageBis(iso); return t === null ? null : -t; };

/** Dringlichkeitsstufe eines Datums. Steuert Schriftgewicht, nicht Farbe —
 *  die Oberfläche ist monochrom, Hierarchie entsteht über Gewicht und Fläche. */
export function stufe(iso) {
  const t = tageBis(iso);
  if (t === null) return "ohne";
  if (t < 0) return "ueberfaellig";
  if (t === 0) return "heute";
  if (t <= 3) return "bald";
  return "spaeter";
}

export function fristText(iso, zeit) {
  const t = tageBis(iso);
  if (t === null) return "";
  const wann = tag(iso) + (zeit ? ` ${zeit}` : "");
  if (t < 0) return `${wann} · ${-t} ${-t === 1 ? "Tag" : "Tage"} überfällig`;
  if (t === 0) return `${wann} · heute fällig`;
  if (t === 1) return `${wann} · morgen`;
  if (t <= 14) return `${wann} · in ${t} Tagen`;
  return wann;
}

/** "seit 46 Tagen" — für die Nachfassliste und das Altlast-Radar. */
export function seitText(iso) {
  const t = tageSeit(iso);
  if (t === null) return "";
  if (t === 0) return "seit heute";
  if (t === 1) return "seit gestern";
  return `seit ${t} Tagen`;
}

/** Markdown-Auszeichnung für die Anzeige entfernen. Das JSON hält bewusst
 *  Rohtext, damit der Markdown-Zwilling verlustfrei zurückgeschrieben werden
 *  kann — angezeigt wird davon nichts. */
export function klar(text) {
  if (!text) return "";
  return String(text)
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();
}

export const zahl = (n) => new Intl.NumberFormat("de-DE").format(n);
