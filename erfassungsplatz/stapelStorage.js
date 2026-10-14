import { sha256 } from '../src/serverApi.js';

const open = () => new Promise((resolve, reject) => {
  const request = globalThis.indexedDB.open('wahlassistent', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('stapel');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error('Lokaler Speicher ist nicht verfügbar.'));
});

export const loadStapel = async () => {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('stapel').objectStore('stapel').get('aktiv');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
};

export const saveStapel = async (stapel, expected) => {
  const db = await open();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('stapel', 'readwrite');
      const store = transaction.objectStore('stapel');
      const request = store.get('aktiv');
      let conflict = false;
      request.onsuccess = () => {
        if (JSON.stringify(request.result) !== JSON.stringify(expected)) {
          conflict = true;
          transaction.abort();
          return;
        }
        if (stapel) store.put(stapel, 'aktiv');
        else store.delete('aktiv');
      };
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(new Error(conflict ? 'Stapel wurde in einem anderen Tab geändert. Seite neu laden.' : 'Stapel mit Bildern konnte nicht gespeichert werden.'));
      transaction.onerror = () => reject(new Error('Lokaler Bildspeicher ist voll oder nicht verfügbar.'));
    });
  } finally { db.close(); }
};

/** Belege gehen einzeln vorab an den Server; der Stapel verweist nur noch per Hash auf sie. */
export const toUpload = async stapel => {
  const bilder = new Map();
  const zettel = await Promise.all(stapel.zettel.map(async row => {
    if (!(row.bild instanceof Blob)) throw new Error('Originalaufnahme fehlt.');
    const hash = await sha256(await row.bild.arrayBuffer());
    bilder.set(hash, row.bild);
    return { ...row, bild: { hash, type: row.bild.type } };
  }));
  return { stapel: { ...stapel, zettel }, bilder };
};
