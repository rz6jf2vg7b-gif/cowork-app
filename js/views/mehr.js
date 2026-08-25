// Mehr — Abgleich, Anmeldung, Ausgang, abgeschlossene Vorgänge, Herkunft der
// Daten. Alles, was man selten braucht und dann sofort finden muss.
import { el, icon, hinweis } from "../core/dom.js";
import * as microsoft from "../sync/microsoft.js";
import * as store from "../core/store.js";
import * as repo from "../data/repo.js";
import * as router from "../core/router.js";
import * as cowork from "../sync/cowork.js";
import { zeile, merkmal } from "../ui/liste.js";
import { alleBereiche, alleProjekte } from "../data/stammdaten.js";
import { tag } from "../core/fmt.js";

export async function zeichneMehr(wurzel) {
  const z = store.zustand;
  const [ausgang, vorgaenge, projekte] = await Promise.all([
    repo.ausgang(), repo.vorgaenge(), repo.projekte(),
  ]);
  const fertig = vorgaenge.filter((v) => ["abgeschlossen", "erledigt"].includes(v.status));

  wurzel.appendChild(el("header", { class: "kopfzeile" }, [el("h1", { text: "Mehr" })]));

  // ---- Sprungziele -------------------------------------------------------
  // Vorgänge und Fristen haben auf dem Telefon keinen eigenen Reiter (dort
  // passen nur vier). Ohne diese Zeile wären sie mobil nur über einen Posten
  // erreichbar — und der Frist-Kalender gar nicht.
  wurzel.appendChild(el("div", { class: "chipzeile" }, [
    ["vorgaenge", `Vorgänge (${vorgaenge.filter((v) => !["abgeschlossen", "erledigt"].includes(v.status)).length})`],
    ["kalender", "Fristen"],
    ["post", `Ausgang (${ausgang.length})`],
  ].map(([ziel, text]) => el("button", {
    class: "chip", text,
    onclick: () => router.zeige(ziel, ziel === "post" ? { mit: { richtung: "aus" } } : {}),
  }))));

  // ---- Verbindung --------------------------------------------------------
  wurzel.appendChild(el("div", { class: "abschnitt-titel" }, [el("h2", { text: "Verbindung" })]));
  wurzel.appendChild(el("div", { class: "karte block" }, [
    el("div", { class: "block-kopf" }, [
      el("h2", { text: z.angemeldet ? (microsoft.konto() || "Angemeldet") : "Nicht verbunden" }),
    ]),
    el("p", { class: "block-neben", text: cowork.pfadAnzeige() }),
    el("p", { class: "block-hinweis", text:
      z.abgleichLaeuft ? "Gleicht gerade ab …"
      : z.letzterFehler ? `Zuletzt mit Fehler: ${z.letzterFehler}`
      : z.letzterAbgleich ? `Zuletzt abgeglichen ${new Date(z.letzterAbgleich).toLocaleString("de-DE")}`
      : "Noch nie abgeglichen." }),
    el("div", { class: "knopfzeile", style: { marginTop: "var(--a4)" } }, [
      el("button", {
        class: "knopf voll", text: z.angemeldet ? "Jetzt abgleichen" : "Mit Microsoft anmelden",
        onclick: () => (z.angemeldet ? store.abgleichen().then(() => hinweis("Abgeglichen.", "gut"))
                                     : microsoft.anmelden()),
      }),
      z.angemeldet ? el("button", {
        class: "knopf", text: "Abmelden",
        onclick: () => { microsoft.abmelden(); store.zustand.angemeldet = false; router.neuZeichnen(); },
      }) : null,
    ].filter(Boolean)),
  ]));

  // ---- Abgeschlossene Vorgänge ------------------------------------------
  wurzel.appendChild(el("div", { class: "abschnitt-titel" }, [
    el("h2", { text: "Abgeschlossene Vorgänge" }),
    el("span", { class: "marke", text: `${fertig.length}` }),
  ]));
  wurzel.appendChild(fertig.length
    ? el("div", { class: "karten" }, fertig.map((v) => zeile({
        datum: v.abgeschlossenAm, name: v.titel, neben: v.projekt,
        merkmale: [merkmal(v.id, "stark")],
        aufKlick: () => router.zeige("vorgaenge", { mit: { oeffne: v.id } }),
      })))
    : el("p", { class: "block-hinweis", text: "Noch keine." }));

  // ---- Datenstand --------------------------------------------------------
  wurzel.appendChild(el("div", { class: "abschnitt-titel" }, [el("h2", { text: "Datenstand" })]));
  const je = alleBereiche().map((b) => `${b.label} ${projekte.filter((p) => p.bereich === b.id).length}`);
  wurzel.appendChild(el("div", { class: "karte block" }, [
    el("p", { class: "block-text", text: `${projekte.length} Projekte · ${je.join(" · ")}` }),
    el("p", { class: "block-hinweis", text:
      "Der Projektstamm ist derselbe wie in der Stundenerfassung. Erzeugt von "
      + "CoWork_OS/00_resources/scripts/stammdaten.py aus untermStrich, der "
      + "MVV-Projektliste und den eigenen Bereichen." }),
  ]));
}
