<?php
declare(strict_types=1);

// Einmalig: aeltere Belege <sha256>.bin nach ihrem Bildtyp umbenennen (.jpg, .png, ...).
// Beim Hoster per SSH im Ordner php-api/: php -q belege-umbenennen.php
// Lokal: docker compose exec -T wahlassistent php /srv/wahlassistent/server/belege-umbenennen.php
require __DIR__ . '/lib.php';

if (!isCommandLine()) exit(1);
echo json_encode(renameBinBelege(), JSON_FLAGS) . "\n";
