// Start der App: Ansichten registrieren, Navigation verdrahten, loslegen.
// Der mittlere Knopf ist nicht "Neu", sondern "Durchlauf" — die häufigste und
// wichtigste Handlung ist hier das Abschließen, nicht das Anlegen.
import { el, icon, hinweis } from "./core/dom.js";
import * as router from "./core/router.js";
import * as store from "./core/store.js";
import * as stammdaten from "./data/stammdaten.js";
import * as microsoft from "./sync/microsoft.js";
import * as auto from "./sync/auto.js";
import { durchlaufStarten } from "./ui/durchlauf.js";
import { zeichneHeute } from "./views/heute.js";
import { zeichnePost } from "./views/post.js";
import { zeichneVorgaenge } from "./views/vorgaenge.js";
import { zeichneAufgaben } from "./views/aufgaben.js";
import { zeichneKalender } from "./views/kalender.js";
import { zeichneMehr } from "./views/mehr.js";

const ANSICHTEN = [
  { id: "heute", label: "Heute", icon: "heute", zeichnen: zeichneHeute },
  { id: "post", label: "Post", icon: "eingang", zeichnen: zeichnePost },
  { id: "vorgaenge", label: "Vorgänge", icon: "vorgaenge", zeichnen: zeichneVorgaenge },
  { id: "aufgaben", label: "Aufgaben", icon: "aufgaben", zeichnen: zeichneAufgaben },
  { id: "kalender", label: "Fristen", icon: "kalender", zeichnen: zeichneKalender },
  { id: "mehr", label: "Mehr", icon: "mehr", zeichnen: zeichneMehr },
];

const wurzel = document.getElementById("ansicht");
const navLeiste = document.getElementById("navigation");

// Die Zeichenfunktionen sind asynchron, der Router ist es nicht. Wird während
// einer laufenden Zeichnung erneut gezeichnet, hängen beide Läufe an dieselbe
// Wurzel und die Ansicht steht doppelt da. Deshalb baut jeder Lauf in einen
// eigenen Behälter und hängt ihn erst ein, wenn er noch der jüngste ist.
let laufNr = 0;
for (const a of ANSICHTEN) {
  router.registrieren(a.id, (ziel, parameter) => {
    const meiner = ++laufNr;
    const bau = document.createDocumentFragment();
    Promise.resolve()
      .then(() => a.zeichnen(bau, parameter))
      .catch((e) => {
        console.error(e);
        bau.appendChild(el("p", { class: "block-hinweis", text: `Fehler: ${e.message}` }));
      })
      .then(() => { if (meiner === laufNr) ziel.replaceChildren(bau); });
  });
}

const navKnoepfe = new Map();
ANSICHTEN.forEach((a, i) => {
  if (i === 3) {
    navLeiste.appendChild(el("button", {
      class: "nav-erfassen", "aria-label": "Durchlauf starten",
      onclick: () => durchlaufStarten("alles"),
    }, [icon("durchlauf", 22), el("span", { class: "nur-breit", text: "Durchlauf" })]));
  }
  const knopf = el("button", {
    class: "nav-knopf", dataset: { ansicht: a.id },
    onclick: () => router.zeige(a.id),
  }, [icon(a.icon, 22), el("span", { text: a.label })]);
  navKnoepfe.set(a.id, knopf);
  navLeiste.appendChild(knopf);
});

router.verdrahten(wurzel, (name) => {
  for (const [id, knopf] of navKnoepfe) knopf.classList.toggle("aktiv", id === name);
  wurzel.scrollTop = 0;
});

store.abonnieren(() => { stammdaten.laden().then(() => router.neuZeichnen()); });

async function start() {
  const rueckkehr = await microsoft.rueckkehrPruefen();
  await stammdaten.laden();
  await store.starten();
  router.zeige(router.startAnsicht(), { verlauf: false });

  if (rueckkehr) {
    if (rueckkehr.ok) hinweis("Mit OneDrive verbunden.", "gut");
    else { hinweis(rueckkehr.meldung, "warnung"); router.zeige("mehr"); }
  }
  auto.starten();
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") router.neuZeichnen();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

start();
