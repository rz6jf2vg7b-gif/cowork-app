// Zuordnungsblatt: Vorschau ansehen, Ziel wählen, fertig.
//
// Die App verschiebt die Datei NICHT selbst. Grund ist die Ablagearchitektur:
// die 100 Projektordner auf OneDrive sind Arbeitskopien, die `projekt_rucksync.py`
// einmalig vom NAS befüllt hat — der Weg zurück existiert nicht. Eine hier
// abgelegte Datei läge in einer Kopie, die niemand mehr beachtet.
//
// Stattdessen wird die Entscheidung notiert. `ablage_ausfuehren.py` führt sie
// auf dem Mac aus, wo das NAS hängt. Das teilt die Arbeit entlang der echten
// Grenze: Urteil am Telefon, Dateioperation dort, wo die Quelle liegt.
import { el, icon, hinweis } from "../core/dom.js";
import { sheet, schliesse } from "./sheet.js";
import * as db from "../data/db.js";
import * as store from "../core/store.js";
import * as inbox from "../sync/inbox.js";
import { suche, alleBereiche, bereichLabel, projekt as projektMit } from "../data/stammdaten.js";

// Ziele außerhalb der Projekte. Sie liegen echt auf OneDrive, nicht auf dem NAS.
const BEREICHSZIELE = [
  { id: "pr-finanzen", bereich: "privat", label: "Privat · Finanzen", pfad: "02_AREAS/Privat/Finanzen" },
  { id: "pr-versicherung", bereich: "privat", label: "Privat · Versicherungen", pfad: "02_AREAS/Privat/Versicherungen" },
  { id: "pr-behoerden", bereich: "privat", label: "Privat · Behörden & Post", pfad: "02_AREAS/Privat/Steuern" },
  { id: "pr-haushalt", bereich: "privat", label: "Privat · Haushalt", pfad: "02_AREAS/Privat/Haushalt" },
  { id: "pr-familie", bereich: "joy", label: "Joy · Familie", pfad: "02_AREAS/Privat/Familie" },
  { id: "sgg", bereich: "sgg", label: "SGG T2,6 Mannheim", pfad: "02_AREAS/SGG_T2-6_Mannheim" },
  { id: "kl-buch", bereich: "kl", label: "kreativLABOR42 · Buchhaltung", pfad: "02_AREAS/kreativLABOR42/Buchhaltung" },
  { id: "mvv", bereich: "mvv", label: "MVV Netze", pfad: "02_AREAS/MVV_Netze" },
];

// Bewusst KEINE Fachwahl im Projekt.
//
// Gemessen am Bestand: die Struktur aus projektstruktur.md v2.4 existiert nur
// in der untermStrich-Vorlage. Von 174 Projekten auf dem NAS haben 75 überhaupt
// ein "01_SCH", und darunter liegen "01_Beteiligte / 02_Post / 03_Doku" statt
// "01_IN/IN" — die Ordner sind über Jahre gewachsen. Ein festes Fach wäre bei
// zwei Dritteln der Projekte falsch. Die App legt deshalb nur fest, WELCHES
// Projekt; die Datei landet in dessen "00_INBOX" und wird dort feinsortiert.

export function zuordnen(datei, beimSpeichern) {
  let modus = "projekt";
  let treffer = [];
  let gewaehlt = null;

  const koerper = el("div", { class: "zuordnen" });

  function zeichne() {
    koerper.replaceChildren(
      vorschau(datei),
      el("div", { class: "segment" }, [
        { id: "projekt", label: "Projekt" }, { id: "bereich", label: "Bereich" },
      ].map((m) => el("button", {
        class: `segment-knopf${m.id === modus ? " aktiv" : ""}`,
        onclick: () => { modus = m.id; gewaehlt = null; zeichne(); },
        text: m.label,
      }))),
      modus === "projekt" ? projektwahl() : bereichswahl(),
    );
  }

  function projektwahl() {
    const feld = el("input", {
      class: "suchfeld", type: "search", placeholder: "Kürzel, Nummer oder Name — z. B. QGW",
      inputmode: "search", autocomplete: "off",
      oninput: (ev) => {
        treffer = suche(ev.target.value, { limit: 8 });
        liste.replaceChildren(...trefferzeilen());
      },
    });
    const liste = el("div", { class: "karten" }, trefferzeilen());
    return el("div", {}, [
      el("div", { class: "suchzeile" }, [el("span", { class: "suchfeld-icon" }, [icon("suche", 17)]), feld]),
      liste,
      gewaehlt ? el("p", { class: "block-hinweis",
        text: `Landet in „${gewaehlt.name}" unter 00_INBOX — die Feinsortierung im Projekt bleibt dir überlassen.` }) : null,
    ].filter(Boolean));
  }

  function trefferzeilen() {
    const l = treffer.length ? treffer : suche("", { limit: 8 });
    return l.map((p) => el("button", {
      class: `treffer${gewaehlt?.id === p.id ? " aktiv" : ""}`,
      onclick: () => { gewaehlt = p; zeichne(); },
    }, [
      el("span", { class: "treffer-marke", text: p.kuerzel || p.nr || "—" }),
      el("span", { class: "treffer-text" }, [
        el("span", { class: "treffer-name", text: p.name }),
        el("span", { class: "zeile-neben", text: [p.nr, p.ort].filter(Boolean).join(" · ") }),
      ]),
    ]));
  }

  function bereichswahl() {
    return el("div", { class: "karten" }, BEREICHSZIELE.map((z) => el("button", {
      class: `treffer${gewaehlt?.id === z.id ? " aktiv" : ""}`,
      onclick: () => { gewaehlt = z; zeichne(); },
    }, [
      el("span", { class: "treffer-marke", text: (z.bereich || "").toUpperCase().slice(0, 4) }),
      el("span", { class: "treffer-text" }, [
        el("span", { class: "treffer-name", text: z.label }),
        el("span", { class: "zeile-neben", text: z.pfad }),
      ]),
    ])));
  }

  zeichne();

  sheet({
    titel: datei.name,
    inhalt: koerper,
    aktionen: [
      el("button", {
        class: "knopf voll", text: "Zuordnen",
        onclick: async () => {
          if (!gewaehlt) return hinweis("Erst ein Ziel wählen.", "warnung");
          await merken(datei, gewaehlt, modus === "projekt");
          schliesse();
          hinweis("Zugeordnet. Der Mac legt sie beim nächsten Lauf ab.", "gut");
          beimSpeichern?.();
        },
      }),
    ],
  });
}

function vorschau(datei) {
  const bild = datei.gross || datei.vorschau;
  return el("div", { class: "vorschau-blatt" }, [
    bild
      ? el("img", { class: "vorschau-bild", src: bild, alt: datei.name, loading: "lazy" })
      : el("div", { class: "vorschau-leer", text: datei.endung.toUpperCase() || "Datei" }),
    el("div", { class: "zeile-fuss" }, [
      el("span", { class: "zeile-neben", text: `${datei.quelle} · ${inbox.lesbar(datei.groesse)}` }),
      el("button", {
        class: "text-knopf", text: "Ganz öffnen",
        onclick: async () => {
          // Frische Adresse holen — die aus der Liste läuft nach etwa einer
          // Stunde ab und wäre nach längerem Blättern tot.
          const u = await inbox.adresse(datei.id).catch(() => datei.oeffnen);
          if (u) window.open(u, "_blank", "noopener");
          else hinweis("Datei ließ sich nicht öffnen.", "warnung");
        },
      }),
    ]),
  ]);
}

async function merken(datei, ziel, istProjekt) {
  const satz = {
    id: datei.id,
    name: datei.name,
    quelle: `00_INBOX/${datei.quelle}`,
    zielArt: istProjekt ? "projekt" : "bereich",
    zielId: ziel.id,
    zielLabel: istProjekt ? `${ziel.kuerzel || ziel.nr || ""} ${ziel.name}`.trim() : ziel.label,
    // Projektziele lösen wir erst auf dem Mac auf — dort liegt das NAS, und
    // nur dort steht fest, wie der Projektordner wirklich heißt.
    projektNr: istProjekt ? ziel.nr : null,
    projektName: istProjekt ? ziel.name : null,
    bereichsPfad: istProjekt ? null : ziel.pfad,
    zugeordnetAm: new Date().toISOString(),
    erledigt: false,
    geaendert: new Date().toISOString(),
    geloescht: null,
  };
  await db.schreiben(db.STORE_ABLAGE, satz);
  await db.schreiben(db.STORE_OFFEN, { id: `ablage:${satz.id}`, store: db.STORE_ABLAGE,
                                       satzId: satz.id, am: satz.geaendert });
  store.geaendert();
}
