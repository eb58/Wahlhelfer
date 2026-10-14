/** Relativ zur Seite: die App liegt beim Hoster in einem Unterordner, die PHP-API daneben in php-api/. */
const apiUrl = path => `php-api/index.php/api/${path}`;

// X-Auth-Token zusaetzlich, weil manche Hoster Authorization nicht an PHP durchreichen.
const zugang = () => {
  const token = sessionStorage.getItem('wahlassistent-token') ?? '';
  return token ? { Authorization: `Bearer ${token}`, 'X-Auth-Token': token } : {};
};

const send = async (path, options = {}) => {
  const response = await fetch(apiUrl(path), { ...options, headers: { ...zugang(), ...options.headers } });
  const result = await response.json().catch(() => { throw new Error('Server nicht erreichbar oder PHP-API nicht eingerichtet.'); });
  if (!response.ok) throw new Error(result.error ?? 'Serveranfrage fehlgeschlagen.');
  return result;
};

export const api = (path, data) => send(path, data === undefined ? {} : {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});

/** Belege einzeln und unveraendert hochladen; der Server prueft Hash und Dateityp. */
export const putBild = (hash, blob) => send(`bilder/${hash}`, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob });

export const sha256 = async data => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

export const setupZugang = () => {
  const input = document.querySelector('#serverToken');
  input.value = sessionStorage.getItem('wahlassistent-token') ?? '';
  document.querySelector('#zugangForm').addEventListener('submit', event => {
    event.preventDefault();
    sessionStorage.setItem('wahlassistent-token', input.value.trim());
    globalThis.location.reload();
  });
};

export const loadBild = async id => {
  const response = await fetch(apiUrl(`stimmzettel/${encodeURIComponent(id)}/bild`), { headers: zugang() });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error ?? 'Beleg nicht erreichbar.');
  return response.blob();
};
