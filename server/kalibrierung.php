<?php
declare(strict_types=1);

const KALIBRIERUNG_MAX_BILD = 20 * 1024 * 1024;
const KALIBRIERUNG_MAX_JSON = 2 * 1024 * 1024;

final class KalibrierungsFehler extends RuntimeException
{
    public function __construct(public readonly int $status, string $message)
    {
        parent::__construct($message);
    }
}

function kalibrierung_json_pruefen(string $rohjson): array
{
    $rohjson = preg_replace('/^\xEF\xBB\xBF/', '', $rohjson) ?? $rohjson;
    if (strlen($rohjson) > KALIBRIERUNG_MAX_JSON) {
        throw new KalibrierungsFehler(413, 'Kalibrierungs-JSON ist zu groß');
    }

    try {
        $typ = json_decode($rohjson, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $fehler) {
        throw new KalibrierungsFehler(400, 'Kalibrierungs-JSON ist ungültig: ' . $fehler->getMessage());
    }

    if (!is_array($typ)) {
        throw new KalibrierungsFehler(400, 'Kalibrierungs-JSON muss ein Objekt enthalten');
    }
    $felder = $typ['felder'] ?? null;
    $referenz = $typ['reference'] ?? null;
    if (
        !is_array($typ)
        || ($typ['version'] ?? null) !== 2
        || !is_string($typ['name'] ?? null)
        || $typ['name'] === ''
        || !is_array($felder)
        || $felder === []
        || !is_array($referenz)
        || !is_numeric($referenz['width'] ?? null)
        || !is_numeric($referenz['height'] ?? null)
        || (float) $referenz['width'] <= 0
        || (float) $referenz['height'] <= 0
    ) {
        throw new KalibrierungsFehler(400, 'Kalibrierungs-JSON enthält keine vollständige Kalibrierung');
    }

    foreach ($felder as $feld) {
        if (!is_array($feld) || !is_string($feld['id'] ?? null) || !is_string($feld['stimme'] ?? null)) {
            throw new KalibrierungsFehler(400, 'Kalibrierungs-JSON enthält ein ungültiges Feld');
        }
    }

    try {
        $normalisiert = json_encode($typ, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    } catch (JsonException $fehler) {
        throw new KalibrierungsFehler(400, 'Kalibrierungs-JSON konnte nicht gespeichert werden');
    }
    return [$typ, $normalisiert . PHP_EOL];
}

function bild_info_pruefen(array $bild): array
{
    if (($bild['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_file($bild['tmp_name'] ?? '')) {
        throw new KalibrierungsFehler(400, 'Musterbild fehlt');
    }
    $groesse = filesize($bild['tmp_name']);
    if ($groesse === false || $groesse === 0 || $groesse > KALIBRIERUNG_MAX_BILD) {
        throw new KalibrierungsFehler(413, 'Musterbild ist zu groß oder leer');
    }

    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($bild['tmp_name']);
    $endung = strtolower(pathinfo((string) ($bild['name'] ?? ''), PATHINFO_EXTENSION));
    $typen = ['image/png' => '.png', 'image/jpeg' => '.jpg', 'application/pdf' => '.pdf'];
    if (!isset($typen[$mime]) || !in_array($endung, ['png', 'jpg', 'jpeg', 'pdf'], true)) {
        throw new KalibrierungsFehler(415, 'Nur PNG-, JPEG- oder PDF-Musterbilder sind erlaubt');
    }

    $anfang = file_get_contents($bild['tmp_name'], false, null, 0, 8) ?: '';
    $gueltigesFormat = $mime === 'image/png' && substr($anfang, 0, 8) === "\x89PNG\r\n\x1A\n"
        || $mime === 'image/jpeg' && substr($anfang, 0, 2) === "\xFF\xD8"
        || $mime === 'application/pdf' && substr($anfang, 0, 4) === '%PDF';
    if (!$gueltigesFormat) {
        throw new KalibrierungsFehler(415, 'Musterbild hat ein ungültiges Dateiformat');
    }
    return ['mime' => $mime, 'endung' => $typen[$mime], 'groesse' => $groesse];
}

function kalibrierung_hochladen(string $datenverzeichnis, array $bild, string $rohjson): array
{
    [$typ, $normalisiertesJson] = kalibrierung_json_pruefen($rohjson);
    $bildInfo = bild_info_pruefen($bild);
    $id = bin2hex(random_bytes(16));
    $temp = $datenverzeichnis . DIRECTORY_SEPARATOR . '.tmp-' . $id;
    $ziel = $datenverzeichnis . DIRECTORY_SEPARATOR . $id;
    if (!mkdir($temp, 0700, true) && !is_dir($temp)) {
        throw new RuntimeException('Datenverzeichnis konnte nicht angelegt werden');
    }

    $musterDatei = 'muster' . $bildInfo['endung'];
    try {
        $musterPfad = $temp . DIRECTORY_SEPARATOR . $musterDatei;
        if (is_uploaded_file($bild['tmp_name'])) {
            $gespeichert = move_uploaded_file($bild['tmp_name'], $musterPfad);
        } else {
            $gespeichert = copy($bild['tmp_name'], $musterPfad);
        }
        if (!$gespeichert || file_put_contents($temp . DIRECTORY_SEPARATOR . 'kalibrierung.json', $normalisiertesJson, LOCK_EX) === false) {
            throw new RuntimeException('Upload konnte nicht gespeichert werden');
        }
        $metadaten = [
            'id' => $id,
            'name' => $typ['name'],
            'felder' => count($typ['felder']),
            'musterDatei' => $musterDatei,
            'musterOriginalname' => basename((string) ($bild['name'] ?? $musterDatei)),
            'musterTyp' => $bildInfo['mime'],
            'musterGroesse' => $bildInfo['groesse'],
            'hochgeladenAm' => gmdate('c'),
        ];
        $metadatenJson = json_encode($metadaten, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) . PHP_EOL;
        if (file_put_contents($temp . DIRECTORY_SEPARATOR . 'metadaten.json', $metadatenJson, LOCK_EX) === false || !rename($temp, $ziel)) {
            throw new RuntimeException('Upload konnte nicht abgeschlossen werden');
        }
    } catch (Throwable $fehler) {
        kalibrierung_ordner_loeschen($temp);
        throw $fehler;
    }
    return $metadaten;
}

function kalibrierung_ordner_loeschen(string $ordner): void
{
    if (!is_dir($ordner)) return;
    foreach (scandir($ordner) ?: [] as $datei) {
        if ($datei === '.' || $datei === '..') continue;
        $pfad = $ordner . DIRECTORY_SEPARATOR . $datei;
        is_dir($pfad) ? kalibrierung_ordner_loeschen($pfad) : unlink($pfad);
    }
    rmdir($ordner);
}

function kalibrierungen_liste(string $datenverzeichnis): array
{
    $liste = [];
    foreach (glob($datenverzeichnis . DIRECTORY_SEPARATOR . '*/metadaten.json') ?: [] as $datei) {
        $metadaten = json_decode(file_get_contents($datei), true);
        if (is_array($metadaten)) $liste[] = $metadaten;
    }
    usort($liste, fn(array $a, array $b): int => strcmp($b['hochgeladenAm'] ?? '', $a['hochgeladenAm'] ?? ''));
    return $liste;
}
