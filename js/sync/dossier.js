// Die Obsidian-Notiz zu einem Eingangsposten laden.
//
// Sie ist das eigentliche Dokument: Kernfrage, Faktenlage, Antwortentwurf,
// ToDo — vom Morgen-Briefing geschrieben. 18 von 23 Posten haben eine.
//
// Die .eml taugt dagegen NICHT als Anker: nur 2 von 23 Posten haben eine
// gleichnamige Mail, die Namen sind auseinandergelaufen. Und ein obsidian://
// Deeplink hilft auch nicht — der funktioniert bei Steffen nicht (geprüft
// 01.08.2026). Also wird der Text hier geholt und in der App gezeigt.
import { graph } from "./microsoft.js";

const ORDNER = "/me/drive/root:/03_RESOURCES/Obsidian/Steffen_Vault/Eingang";
const zwischenspeicher = new Map();

export async function lesen(notizname) {
  if (!notizname) return null;
  if (zwischenspeicher.has(notizname)) return zwischenspeicher.get(notizname);

  const name = encodeURIComponent(`${notizname}.md`);
  const d = await graph(`${ORDNER}/${name}:/content`, { roh: true });
  const text = typeof d === "string" ? d : null;
  zwischenspeicher.set(notizname, text);
  return text;
}

/** Frontmatter abschneiden und die groben Markdown-Zeichen entfernen.
 *  Kein vollständiger Renderer — es geht ums Lesen, nicht ums Setzen. */
export function alsText(md) {
  if (!md) return "";
  return md
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();
}
