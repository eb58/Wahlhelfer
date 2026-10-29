<?php
declare(strict_types=1);

// Spielt die Wahlbezirke der Gebietsdatei aus configuration.js als Wahllokale ein; wiederholbar.
// Lokal: docker compose exec -T wahlassistent php /srv/wahlassistent/server/import-wahllokale.php
require __DIR__ . '/lib.php';
require __DIR__ . '/wahllokalImport.php';

if (!isCommandLine()) exit(1);
try {
    if (count($_SERVER['argv'] ?? []) !== 1) throw new ApiError('Aufruf: php import-wahllokale.php (ohne Argumente)');
    $raw = @file_get_contents(gebietPath());
    if ($raw === false) throw new ApiError('Gebietsdatei nicht gefunden: ' . gebietPath());
    ensureWahl();
    $result = importWahllokale(getGebietWahllokale(json_decode($raw, true, 512, JSON_THROW_ON_ERROR)));
    echo json_encode($result, JSON_FLAGS) . "\n";
} catch (Throwable $error) {
    printError($error->getMessage());
    exit(1);
}
