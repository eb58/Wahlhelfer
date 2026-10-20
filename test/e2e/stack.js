/**
 * Auf- und Abbau des Wegwerf-Stacks fuer den E2E-Test. Das erste Admin-Konto legt der Test im
 * ControlCenter an, den Wahlvorstand per create-user.php.
 */
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const compose = ['compose', '-f', fileURLToPath(new URL('compose.yaml', import.meta.url))];
const docker = args => execFileSync('docker', [...compose, ...args], { cwd: root, stdio: 'inherit' });

export const STARTPASSWORT = 'Startpasswort-e2e';
export const PASSWORT = 'Neues-Passwort-e2e';
export const KONTEN = { admin: 'e2e-admin', wahlvorstand: 'e2e-vorstand' };
export const WAHLLOKAL = '518';

const createUser = (...args) => docker(['exec', '-T', 'wahlassistent', 'php', '/srv/wahlassistent/server/create-user.php', ...args]);

export const setup = () => {
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
  docker(['down', '-v']);
  docker(['up', '-d', '--build', '--wait']);
};

/** Ein Wahlvorstand braucht ein registriertes Wahllokal - wie beim Hoster erst danach anlegen. */
export const createWahlvorstand = () => createUser(KONTEN.wahlvorstand, STARTPASSWORT, 'wahlvorstand', WAHLLOKAL);

export const teardown = () => docker(['down', '-v']);
