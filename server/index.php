<?php
declare(strict_types=1);

require_once __DIR__ . '/kalibrierung.php';

$datenverzeichnis = getenv('WAHLASSISTENT_DATEN') ?: __DIR__ . '/../server-data';
$pfad = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

$json = static function (int $status, mixed $inhalt): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($inhalt, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
};

try {
    if (!is_dir($datenverzeichnis) && !mkdir($datenverzeichnis, 0700, true) && !is_dir($datenverzeichnis)) {
        throw new RuntimeException('Datenverzeichnis konnte nicht angelegt werden');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $pfad === '/api/kalibrierungen') {
        $bild = $_FILES['muster'] ?? $_FILES['bild'] ?? null;
        $kalibrierungsDatei = $_FILES['kalibrierung'] ?? $_FILES['kalibrierungsinfo'] ?? $_FILES['json'] ?? null;
        $rohjson = $kalibrierungsDatei
            ? (file_get_contents($kalibrierungsDatei['tmp_name']) ?: '')
            : (string) ($_POST['kalibrierung'] ?? '');
        if (!is_array($bild)) throw new KalibrierungsFehler(400, 'Multipart-Feld „muster“ fehlt');
        $json(201, kalibrierung_hochladen($datenverzeichnis, $bild, $rohjson));
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $pfad === '/api/kalibrierungen') {
        $json(200, kalibrierungen_liste($datenverzeichnis));
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && preg_match('#^/api/kalibrierungen/([a-f0-9]{32})(?:/(muster|kalibrierung))?$#i', $pfad, $treffer)) {
        $id = strtolower($treffer[1]);
        $unterpfad = $treffer[2] ?? null;
        $ordner = $datenverzeichnis . DIRECTORY_SEPARATOR . $id;
        $metadatenPfad = $ordner . DIRECTORY_SEPARATOR . 'metadaten.json';
        if (!is_file($metadatenPfad)) throw new KalibrierungsFehler(404, 'Kalibrierung nicht gefunden');
        $metadaten = json_decode(file_get_contents($metadatenPfad), true, 512, JSON_THROW_ON_ERROR);
        if ($unterpfad === null) $json(200, $metadaten);
        if ($unterpfad === 'kalibrierung') {
            header('Content-Type: application/json; charset=utf-8');
            readfile($ordner . DIRECTORY_SEPARATOR . 'kalibrierung.json');
            exit;
        }
        header('Content-Type: ' . $metadaten['musterTyp']);
        header('Content-Length: ' . filesize($ordner . DIRECTORY_SEPARATOR . $metadaten['musterDatei']));
        header('X-Content-Type-Options: nosniff');
        readfile($ordner . DIRECTORY_SEPARATOR . $metadaten['musterDatei']);
        exit;
    }

    $json(404, ['fehler' => 'Route nicht gefunden']);
} catch (KalibrierungsFehler $fehler) {
    $json($fehler->status, ['fehler' => $fehler->getMessage()]);
} catch (Throwable $fehler) {
    error_log($fehler->getMessage());
    $json(500, ['fehler' => 'Interner Serverfehler']);
}
