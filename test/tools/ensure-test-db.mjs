// Faehrt die Test-Datenbank hoch, damit die PHP-Integrationstests nicht unbemerkt
// uebersprungen werden. Fehlt Docker, laufen die reinen Logiktests trotzdem - mit Warnung.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const composeFile = fileURLToPath(new URL('../docker-compose.test.yml', import.meta.url));
const warn = reason => console.warn(['', '!'.repeat(72), '  ACHTUNG: Test-Datenbank nicht verfuegbar.', `  Grund: ${reason}`,
  '  Die Integrationstests der PHP-API werden UEBERSPRUNGEN.', '!'.repeat(72), ''].join('\n'));

const result = spawnSync('docker', ['compose', '-f', composeFile, 'up', '-d', '--wait'], { encoding: 'utf8' });
if (result.error?.code === 'ENOENT') warn('Docker ist nicht installiert bzw. nicht im PATH.');
else if (result.status !== 0) warn(`docker compose up ist fehlgeschlagen.\n  ${(result.stderr || '').trim().split('\n').join('\n  ')}`);
else console.log('Test-Datenbank bereit (wa-test-db, Port 3308).');
