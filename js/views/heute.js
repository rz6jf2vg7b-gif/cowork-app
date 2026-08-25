// Heute — die Lage in einem Blick, dann die Arbeit.
// Reihenfolge ist Absicht: überfällig zuerst, dann heute, dann was andere
// schulden. Was seit Wochen liegt, steht nicht unten in einer Liste, sondern
// als Kachel oben — sonst wird es wieder nicht angefasst.
import { el, icon, anhaengen } from "../core/dom.js";
import * as repo from "../data/repo.js";
import * as router from "../core/router.js";
import * as store from "../core/store.js";
import { zeile, merkmal, abschnitt, leer } from "../ui/liste.js";
import { durchlaufStarten } from "../ui/durchlauf.js";
import { postenBlatt } from "../ui/postenblatt.js";
import { aufgabenBlatt } from "../ui/aufgabenblatt.js";
import { tag, tageBis, klar, seitText } from "../core/fmt.js";
import { bereichKurz } from "../data/stammdaten.js";

export async function zeichneHeute(wurzel) {
  const [ueber, heute, unge, alt, warten] = await Promise.all([
    repo.ueberfaellig(), repo.heuteFaellig(), repo.ungeprueft(),
    repo.altlasten(30), repo.wartetAuf(),
  ]);

  wurzel.appendChild(el("header", { class: "kopfzeile" }, [
    el("h1", { text: "Heute" }),
    el("p", { class: "kopf-neben", text: tag(new Date().toISOString().slice(0, 10)) }),
  ]));

  // ---- Lage --------------------------------------------------------------
  const kachel = (wert, label, ziel) => el("button", {
    class: "lage-feld", onclick: ziel,
  }, [
    el("div", { class: `lage-wert${wert ? "" : " leise"}`, text: String(wert) }),
    el("div", { class: "lage-label", text: label }),
  ]);

  wurzel.appendChild(el("div", { class: "lage" }, [
    kachel(ueber.length, "Überfällig", () => router.zeige("kalender")),
    kachel(heute.length, "Heute fällig", () => router.zeige("aufgaben")),
    kachel(unge.length, "Ungeprüft ⚙️", () => durchlaufStarten("ungeprueft")),
    kachel(alt.length, "Altlast > 30 T", () => durchlaufStarten("altlast")),
  ]));

  // Zugeordnetes, das der Mac noch nicht abgelegt hat. Ohne diesen Hinweis
  // wüsste niemand, dass die Entscheidung getroffen, aber nicht ausgeführt ist.
  const wartend = await repo.ablageOffen();
  if (wartend.length) {
    wurzel.appendChild(el("button", {
      class: "karte block", onclick: () => router.zeige("post", { mit: { richtung: "scans" } }),
    }, [
      el("div", { class: "block-kopf" }, [
        el("h2", { text: `${wartend.length} ${wartend.length === 1 ? "Datei" : "Dateien"} zugeordnet` }),
      ]),
      el("p", { class: "block-neben",
        text: "Wartet auf den nächsten Ablage-Lauf am Mac." }),
    ]));
  }

  // ---- Durchlauf ---------------------------------------------------------
  if (unge.length || alt.length || ueber.length) {
    wurzel.appendChild(el("button", {
      class: "knopf voll", onclick: () => durchlaufStarten("alles"),
    }, [icon("durchlauf", 18), el("span", { text: "Durchlauf starten" })]));
  }

  // ---- Überfällig --------------------------------------------------------
  anhaengen(wurzel, abschnitt("Überfällig", `${ueber.length}`, ueber.map(fristZeile)));
  anhaengen(wurzel, abschnitt("Heute fällig", null, heute.map(fristZeile)));

  // ---- Wartet auf andere -------------------------------------------------
  if (warten.length) {
    anhaengen(wurzel, abschnitt("Bei anderen", `${warten.length} Beteiligte`,
      warten.slice(0, 6).map((g) => zeile({
        datum: null,
        name: g.wer,
        neben: `${g.eintraege.length} ${g.eintraege.length === 1 ? "Sache" : "Sachen"}`,
        seit: seitText(g.eintraege[0]?.seit),
        merkmale: [g.aeltester >= 30 ? merkmal(`${g.aeltester} Tage`, "stark") : null],
        aufKlick: () => router.zeige("post", { mit: { wartetAuf: g.wer } }),
      }))));
  }

  if (!ueber.length && !heute.length && !unge.length && !alt.length) {
    wurzel.appendChild(leer("Nichts überfällig",
      "Keine Frist gerissen, nichts Ungeprüftes, keine Altlast. Der Eingang zeigt, was sonst offen ist."));
  }

  wurzel.appendChild(standzeile());
}

function fristZeile(f) {
  return zeile({
    datum: f.datum,
    name: klar(f.titel),
    neben: klar(f.neben),
    ungeprueft: f.satz?.geprueft === false,
    merkmale: [
      merkmal(bereichKurz(f.bereich)),
      f.vorgang ? merkmal(f.vorgang, "stark") : null,
      merkmal(f.art === "aufgabe" ? "Aufgabe" : "Eingang"),
    ],
    // Nicht in die Aufgabenliste springen: das riss den Zusammenhang ab und
    // setzte einen an den Listenanfang. Das Blatt zeigt die Sache selbst.
    aufKlick: () => (f.art === "aufgabe" ? aufgabenBlatt(f.satz) : postenBlatt(f.satz)),
  });
}

export function standzeile() {
  const z = store.zustand;
  const text = z.abgleichLaeuft ? "gleicht ab …"
    : z.letzterFehler ? z.letzterFehler
    : !z.angemeldet ? "nicht mit OneDrive verbunden — unter Mehr anmelden"
    : z.letzterAbgleich ? `zuletzt abgeglichen ${new Date(z.letzterAbgleich)
        .toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
    : "noch nicht abgeglichen";
  return el("p", { class: "block-hinweis", style: { marginTop: "var(--a8)" }, text });
}
