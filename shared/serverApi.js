import { appUrl } from './appUrl.js';

/** Die App liegt beim Hoster in einem Unterordner, die PHP-API daneben in php-api/. */
const apiUrl = path => appUrl(`php-api/index.php/api/${path}`);
const TOKEN_KEY = 'wahlassistent-sitzung';
const token = () => sessionStorage.getItem(TOKEN_KEY) ?? '';
const $ = id => document.querySelector(`#${id}`);

// X-Auth-Token zusaetzlich, weil manche Hoster Authorization nicht an PHP durchreichen.
const zugang = () => (token() ? { Authorization: `Bearer ${token()}`, 'X-Auth-Token': token() } : {});

/** Abgelaufene oder beendete Sitzung: Token verwerfen, die Seite zeigt dann wieder die Anmeldung. */
const expired = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  globalThis.location.reload();
};

const send = async (path, options = {}) => {
  const response = await fetch(apiUrl(path), { ...options, headers: { ...zugang(), ...options.headers } });
  const result = await response.json().catch(() => { throw new Error('Server nicht erreichbar oder PHP-API nicht eingerichtet.'); });
  if (response.status === 401 && token()) expired();
  if (!response.ok) throw new Error(result.error ?? 'Serveranfrage fehlgeschlagen.');
  return result;
};

export const api = (path, data) => send(path, data === undefined ? {} : {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});

/** Belege einzeln und unveraendert hochladen; der Server prueft Hash und Dateityp. */
export const putBild = (hash, blob) => send(`bilder/${hash}`, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });

export const sha256 = async data => {
  // crypto.subtle gibt es nur auf sicheren Seiten (HTTPS oder localhost).
  if (!globalThis.crypto?.subtle) throw new Error(`Diese Seite braucht HTTPS. ${globalThis.location?.origin ?? ''} gilt dem Browser nicht als sicher.`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

export const describeUser = user => `${user.username} · ${user.role === 'admin' ? 'Admin' : `Wahlvorstand ${user.wahllokal}`}`;

export const abmelden = async () => {
  await send('session', { method: 'DELETE' }).catch(() => {});
  expired();
};

/**
 * Anmeldung, Pflicht-Passwortwechsel und Abmelden (Abschnitt #anmeldung auf beiden Seiten).
 * Liefert den angemeldeten Benutzer oder undefined; erst danach laedt die Seite Daten.
 * `nurAdmin` (ControlCenter): andere Konten bleiben angemeldet, sehen aber nur die Abweisung.
 */
export const setupAnmeldung = async ({ nurAdmin = false } = {}) => {
  const show = id => ['anmeldeForm', 'passwortForm', 'angemeldet'].forEach(key => { $(key).hidden = key !== id; });
  const fail = error => {
    $('anmeldeStatus').textContent = error.message;
    $('anmeldeStatus').hidden = false;
  };
  const submit = (id, action) => $(id).addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    try {
      await action(Object.fromEntries(new FormData(event.target)));
      globalThis.location.reload();
    } catch (error) { fail(error); }
    finally { button.disabled = false; }
  });
  submit('anmeldeForm', async form => sessionStorage.setItem(TOKEN_KEY, (await api('session', form)).token));
  submit('passwortForm', form => api('session/password', form));
  $('abmelden').addEventListener('click', abmelden);

  if (!token()) return show('anmeldeForm');
  const user = await api('session').catch(error => { fail(error); });
  if (!user) return show('anmeldeForm');
  if (user.passwordChangeRequired) return show('passwortForm');
  $('angemeldetAls').textContent = describeUser(user);
  show('angemeldet');
  if (nurAdmin && user.role !== 'admin') return fail(new Error('Diese Seite ist nur für Admins.'));
  document.body.dataset.angemeldet = '';
  return user;
};

export const loadBild = async id => {
  const response = await fetch(apiUrl(`stimmzettel/${encodeURIComponent(id)}/bild`), { headers: zugang() });
  if (response.status === 401) expired();
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? 'Beleg nicht erreichbar.');
  return response.blob();
};
