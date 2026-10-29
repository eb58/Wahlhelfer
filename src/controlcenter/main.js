/**
 * ControlCenter fuer das Wahlamt: Monitoring der Wahllokale und vorlaeufige Ergebnisse. Nur fuer Admins.
 * Navigation ueber den Hash (#dashboard, #wahllokal/518 ...), Daten alle 15 Sekunden neu.
 */
import { abmelden, api, describeUser, setupAnmeldung } from '../api/serverApi.js';
import { formatZahl, getWahlName, parseRoute } from './auswertung.js';
import { ansichten } from './ansichten.js';
import { showBeleg } from './beleg.js';

const $ = id => document.querySelector(`#${id}`);
const AKTUALISIERUNG_MS = 15000;
const SIDEBAR_KEY = 'wahlassistent-controlcenter-sidebar';
const state = { data: undefined, view: undefined, stapelCache: new Map(), statusFilter: '', stimmeId: undefined, wahlkreis: undefined };

const showFehler = error => {
  $('fehler').textContent = error.message;
  $('fehler').hidden = false;
};
const setTitel = titel => {
  $('titel').textContent = titel;
  document.title = `${titel} – ControlCenter`;
};
const setWahl = text => { $('wahl').textContent = text; };
const zeigeBeleg =beleg => showBeleg(beleg, state.data.gesamt.stimmen).catch(showFehler);

let loading = false;
const refresh = async () => {
  if (loading) return;
  loading = true;
  $('aktualisieren').disabled = true;
  try {
    state.data = await api('ergebnisse');
    $('fehler').hidden = true;
    setWahl(getWahlName(state.data.wahl));
    $('stand').textContent = `Stand ${new Date().toLocaleTimeString('de-DE')}`;
    $('prueffallZahl').textContent = formatZahl(state.data.gesamt.prueffaelle);
    $('prueffallZahl').hidden = !state.data.gesamt.prueffaelle;
    await state.view?.update(state.data);
  } catch (error) { showFehler(error); }
  finally {
    loading = false;
    $('aktualisieren').disabled = false;
  }
};

/* --- Seitenleiste: am PC einklappbar, auf dem Smartphone ausklappbar --- */

const setEingeklappt = eingeklappt => {
  $('sidebar').classList.toggle('sidebar--eingeklappt', eingeklappt);
  $('sidebarToggle').setAttribute('aria-label', eingeklappt ? 'Navigation ausklappen' : 'Navigation einklappen');
};
const setMenue = offen => {
  $('sidebar').classList.toggle('sidebar--offen', offen);
  $('sidebarBackdrop').hidden = !offen;
  $('menueKnopf').setAttribute('aria-expanded', String(offen));
};
try { setEingeklappt(globalThis.localStorage.getItem(SIDEBAR_KEY) === '1'); } catch { /* ohne Speicher ausgeklappt */ }
$('sidebarToggle').addEventListener('click', () => {
  const eingeklappt = !$('sidebar').classList.contains('sidebar--eingeklappt');
  setEingeklappt(eingeklappt);
  try { globalThis.localStorage.setItem(SIDEBAR_KEY, eingeklappt ? '1' : '0'); } catch { /* nur Komfort */ }
});
$('menueKnopf').addEventListener('click', () => setMenue(true));
$('sidebarBackdrop').addEventListener('click', () => setMenue(false));
$('sidebarAbmelden').addEventListener('click', abmelden);
$('aktualisieren').addEventListener('click', refresh);

/* --- Navigation -------------------------------------------------------- */

const navigate = () => {
  const route = parseRoute(globalThis.location.hash);
  state.view?.destroy?.();
  $('werkzeuge').replaceChildren();
  $('inhalt').replaceChildren();
  state.view = ansichten[route.ansicht]({ inhalt: $('inhalt'), werkzeuge: $('werkzeuge'), state, refresh, showFehler, setTitel, setWahl, zeigeBeleg }, route);
  setTitel(state.view.titel);
  $('werkzeuge').hidden = !$('werkzeuge').childElementCount;
  const aktiv = route.ansicht === 'wahllokal' ? 'wahllokale' : route.ansicht;
  document.querySelectorAll('[data-ansicht]').forEach(link => {
    if (link.dataset.ansicht === aktiv) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  setMenue(false);
  $('hauptbereich').scrollTop = 0;
  if (state.data) state.view.update(state.data);
};

/* --- Start ------------------------------------------------------------- */

const user = await setupAnmeldung({ nurAdmin: true });
if (user) {
  $('benutzer').textContent = describeUser(user);
  await refresh();
  navigate();
  globalThis.addEventListener('hashchange', navigate);
  // Nicht waehrend ein Beleg offen ist oder der Tab im Hintergrund liegt.
  globalThis.setInterval(() => {
    if (!document.hidden && !document.querySelector('dialog[open]')) refresh();
  }, AKTUALISIERUNG_MS);
}
