<?php
declare(strict_types=1);

// Lokal: docker compose exec -T wahlassistent php /srv/wahlassistent/server/import-wahllokale.php daten/reinickendorf-2026.json
require __DIR__ . '/lib.php';
require __DIR__ . '/wahllokalImport.php';

if (PHP_SAPI !== 'cli') exit(1);
try {
    [, $path] = array_pad($argv, 2, null);
    if ($path === null || count($argv) !== 2)
        throw new ApiError('Aufruf: php import-wahllokale.php <JSON-Datei relativ zu server/>');
    $data = json_decode((string) file_get_contents(__DIR__ . '/' . $path), true, 512, JSON_THROW_ON_ERROR);
    ensureWahl();
    $result = importWahllokale($data['wahllokale'] ?? []);
    echo json_encode($result, JSON_FLAGS) . "\n";
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
