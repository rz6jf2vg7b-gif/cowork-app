// Wann von selbst abgeglichen wird: beim Start, beim Zurückkehren in die App
// und im Takt. Ohne das Zurückkehren wäre der Stand nach jedem Sperrbildschirm
// veraltet — und genau dann sieht Steffen zuerst hin.
import * as store from "../core/store.js";

const TAKT = 10 * 60 * 1000;
let uhr = null;

export function starten() {
  store.abgleichen().catch(() => {});
  clearInterval(uhr);
  uhr = setInterval(() => {
    if (document.visibilityState === "visible") store.abgleichen({ still: true }).catch(() => {});
  }, TAKT);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") store.abgleichen({ still: true }).catch(() => {});
  });
  window.addEventListener("online", () => store.abgleichen({ still: true }).catch(() => {}));
}
