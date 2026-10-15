/**
 * Der ganze Weg einmal durch: Admin legt das Wahllokal an, der Wahlvorstand erfasst am Smartphone
 * einen Stapel aus zwei echten Fotos (ein eindeutiger Zettel, ein Prueffall) und sendet ihn, das
 * ControlCenter zeigt ihn in allen Ansichten. Keine Seite darf dabei Fehler in die Konsole schreiben.
 */
import { test, expect, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { KONTEN, PASSWORT, STARTPASSWORT, WAHLLOKAL, createWahlvorstand } from './stack.js';

const foto = datei => fileURLToPath(new URL(`../../Testdaten/bundestagswahl-2017/fotos-serie1/${datei}`, import.meta.url));
const EINDEUTIG = foto('PXL_20260803_190650402.jpg'); // E1 + Z4
const PRUEFFALL = foto('PXL_20260803_190656590.jpg'); // nur E1, Zweitstimme leer

const sammleKonsolenfehler = page => {
  const fehler = [];
  page.on('console', message => { if (message.type() === 'error') fehler.push(message.text()); });
  page.on('pageerror', error => fehler.push(error.message));
  // Die Konsole nennt bei Ladefehlern keine Adresse - die Antwort schon.
  page.on('response', response => { if (response.status() >= 400) fehler.push(`${response.status()} ${response.url()}`); });
  return fehler;
};

/** Erste Anmeldung mit Startpasswort, danach der Pflicht-Passwortwechsel. */
const anmelden = async (page, username) => {
  await page.locator('#anmeldeForm [name=username]').fill(username);
  await page.locator('#anmeldeForm [name=password]').fill(STARTPASSWORT);
  await page.locator('#anmeldeForm button').click();
  await page.locator('#passwortForm [name=currentPassword]').fill(STARTPASSWORT);
  await page.locator('#passwortForm [name=newPassword]').fill(PASSWORT);
  await page.locator('#passwortForm button').click();
  await expect(page.locator('body[data-angemeldet]')).toBeAttached();
};

const zeilen = page => page.locator('.ag-center-cols-container .ag-row');

/** Wie ein Mensch erst aufnehmen, wenn der Knopf frei ist - solange der Stapel gespeichert wird, ist er gesperrt. */
const aufnehmen = async (page, datei) => {
  await expect(page.locator('#dateiKnopf')).toBeEnabled();
  await page.locator('#dateiEingabe').setInputFiles(datei);
};

test('Wahllokal anlegen, Stapel erfassen und im ControlCenter nachvollziehen', async ({ browser }) => {
  const admin = await (await browser.newContext()).newPage();
  const adminFehler = sammleKonsolenfehler(admin);
  const vorstand = await (await browser.newContext({ ...devices['Pixel 7'] })).newPage();
  const vorstandFehler = sammleKonsolenfehler(vorstand);

  await test.step('Admin registriert das Wahllokal', async () => {
    await admin.goto('controlcenter/');
    await anmelden(admin, KONTEN.admin);
    await admin.goto('controlcenter/#verwaltung');
    await admin.locator('form.formular [name=nummer]').fill(WAHLLOKAL);
    await admin.locator('form.formular [name=name]').fill('E2E-Wahllokal');
    await admin.locator('form.formular [name=erwartet]').fill('2');
    await admin.getByRole('button', { name: 'Wahllokal registrieren' }).click();
    await expect(admin.getByText(`Wahllokal ${WAHLLOKAL} registriert.`)).toBeVisible();
    createWahlvorstand();
  });

  await test.step('Wahlvorstand erfasst und sendet einen Stapel', async () => {
    await vorstand.goto(`erfassungsplatz/?wahllokal=${WAHLLOKAL}`);
    await anmelden(vorstand, KONTEN.wahlvorstand);
    await expect(vorstand.locator('#stapelStart')).toBeEnabled();
    await vorstand.locator('#stapelSoll').fill('2');
    await vorstand.locator('#stapelStart').click();

    await aufnehmen(vorstand, EINDEUTIG);
    await expect(vorstand.locator('#wertung')).toHaveAttribute('data-eindeutig', 'true');
    await expect(vorstand.locator('#wertung')).toContainText('Musterfrau, Julia');
    await expect(vorstand.locator('#wertung')).toContainText('PARTEI D');
    await vorstand.locator('#zettelBestaetigen').click();
    await expect(vorstand.locator('#stapelFortschritt')).toHaveText('1 / 2');

    await aufnehmen(vorstand, PRUEFFALL);
    await expect(vorstand.locator('#wertung')).toHaveAttribute('data-eindeutig', 'false');
    await vorstand.locator('#zettelBestaetigen').click();
    await expect(vorstand.locator('#stapelFortschritt')).toHaveText('2 / 2');

    await vorstand.locator('#eingangLeer').check();
    await vorstand.locator('#stapelSenden').click();
    await expect(vorstand.locator('#stapelStatus')).toContainText('vom Server gespeichert');
    await expect(vorstand.locator('#monitor')).toContainText('2 von 2 Stimmzetteln');
  });

  await test.step('Dashboard zeigt den Eingang', async () => {
    await admin.goto('controlcenter/#dashboard');
    await admin.reload();
    await expect(admin.locator('.metriken')).toContainText('von 2 erwartet');
    await expect(admin.locator('.metriken')).toContainText('1 / 1');
  });

  await test.step('Wahllokale und Detail mit Stapel und Beleg', async () => {
    await admin.goto('controlcenter/#wahllokale');
    const zeile = zeilen(admin).filter({ hasText: 'E2E-Wahllokal' });
    await expect(zeile).toContainText('Erfasst – Prüffälle offen');
    await zeile.click();
    await expect(admin).toHaveURL(new RegExp(`#wahllokal/${WAHLLOKAL}$`));
    await expect(admin.locator('.metriken')).toContainText('2 / 2');
    await zeilen(admin).first().click();
    await expect(zeilen(admin)).toHaveCount(3); // der Stapel und seine zwei Belege
    await admin.getByRole('button', { name: 'Beleg', exact: true }).first().click();
    const beleg = admin.locator('dialog.beleg-dialog img').first();
    await expect(beleg).toBeVisible();
    await expect.poll(() => beleg.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
    await admin.locator('dialog.beleg-dialog').first().getByRole('button', { name: 'Beleg schließen' }).click();
  });

  await test.step('Ergebnisse, Prüffälle und Eingänge', async () => {
    await admin.goto('controlcenter/#ergebnisse');
    // Nummer und Name sind links angeheftet, AG Grid rendert sie in einem eigenen Container.
    await expect(admin.getByRole('row', { name: `${WAHLLOKAL} E2E-Wahllokal` })).toBeVisible();
    const zahlen = zeilen(admin).first().getByRole('gridcell');
    await expect(zahlen.nth(0)).toHaveText('2'); // erfasst
    await expect(zahlen.nth(1)).toHaveText('2'); // Erststimme Musterfrau, Julia (E1 auf beiden Zetteln)
    await admin.goto('controlcenter/#prueffaelle');
    await expect(zeilen(admin)).toHaveCount(1);
    await admin.goto('controlcenter/#eingaenge');
    await expect(zeilen(admin)).toHaveCount(1);
  });

  expect(adminFehler, 'Konsolenfehler im ControlCenter').toEqual([]);
  expect(vorstandFehler, 'Konsolenfehler am Erfassungsplatz').toEqual([]);
});
