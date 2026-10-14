<?php
declare(strict_types=1);

$env = static fn(string $name, string $fallback = ''): string => getenv($name) !== false && getenv($name) !== '' ? (string) getenv($name) : $fallback;

$config = [
    'db' => [
        'host' => $env('WAHL_DB_HOST', '127.0.0.1'),
        'port' => (int) $env('WAHL_DB_PORT', '3306'),
        'name' => $env('WAHL_DB_NAME', 'wahlassistent'),
        'user' => $env('WAHL_DB_USER', 'wahlassistent'),
        'password' => $env('WAHL_DB_PASSWORD'),
        'charset' => 'utf8mb4',
    ],
    // Originalbelege; die API legt dort selbst eine .htaccess an, die jeden Direktabruf sperrt.
    'bilder_path' => $env('WAHL_BILDER_PATH', __DIR__ . '/bilder'),
    // Leer = aus configuration.js im App-Ordner ablesen, wie im Browser.
    'kalibrierung' => $env('WAHL_KALIBRIERUNG'),
];

$localConfig = __DIR__ . '/config.local.php';
if (is_file($localConfig)) {
    $config = array_replace_recursive($config, require $localConfig);
}

return $config;
