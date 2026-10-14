import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { get } from 'node:https';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = join(dirname(fileURLToPath(import.meta.url)), 'phpunit.phar');
if (existsSync(target)) process.exit(0);

const download = url => new Promise((resolve, reject) => {
  get(url, response => {
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      response.resume();
      return download(response.headers.location).then(resolve, reject);
    }
    if (response.statusCode !== 200) {
      response.resume();
      return reject(new Error(`Download fehlgeschlagen (${response.statusCode}): ${url}`));
    }
    mkdirSync(dirname(target), { recursive: true });
    const file = createWriteStream(target);
    response.pipe(file);
    file.on('finish', () => file.close(resolve));
    file.on('error', reject);
  }).on('error', reject);
});

console.log('Lade PHPUnit herunter (einmalig, nicht Teil des Repos)...');
await download('https://phar.phpunit.de/phpunit-11.phar');
console.log('PHPUnit bereit unter test/tools/phpunit.phar');
