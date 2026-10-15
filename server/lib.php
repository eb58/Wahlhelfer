<?php
declare(strict_types=1);

const JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_LINE_TERMINATORS | JSON_THROW_ON_ERROR;
const STATUS = ['gueltig', 'leer', 'mehrfach', 'zweifelsfall'];
const BILD_MAX = 20 * 1024 * 1024;
const JSON_MAX = 4 * 1024 * 1024;
const LOCK_NAME = "SHA2(CONCAT('wahlassistent:', DATABASE()), 256)";
const ROLLEN = ['admin', 'wahlvorstand'];
// Fest statt gleitend: ein Wahlabend soll ohne erneute Anmeldung durchgehen.
const SESSION_TTL_HOURS = 12;
const PASSWORD_MIN_LENGTH = 12;
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_MAX_PER_USER = 10;
const LOGIN_MAX_PER_IP = 20;
// Gegen diesen Hash wird bei unbekanntem Namen geprueft, damit die Antwortzeit keine Konten verraet.
const LOGIN_DUMMY_HASH = '$2y$10$Jtm1wvH5iTHqUqfigVQSR.zHemfPv.6xgHB8WCzlJGQN5AukOXw8W';

final class ApiError extends RuntimeException
{
    public function __construct(string $message, public int $statusCode = 400)
    {
        parent::__construct($message);
    }
}

/**
 * Fertige Antwort eines Handlers. Wird geworfen statt direkt gesendet, damit
 * der Einstiegspunkt sie ausgibt und Tests sie abfangen koennen.
 */
final class ApiResponse extends RuntimeException
{
    public function __construct(
        public mixed $payload = null,
        public int $statusCode = 200,
        public array $headers = [],
        public ?string $rawBody = null
    ) {
        parent::__construct('');
    }
}

/* --- Infrastruktur ------------------------------------------------------ */

/** Ohne Argument die Konfiguration, mit Argument setzen (fuer Tests). */
function config(?array $override = null): array
{
    static $config = null;
    if ($override !== null) return $config = $override;
    return $config ??= require __DIR__ . '/config.php';
}

/** Ohne Argument die gemeinsame Verbindung, mit Argument setzen (fuer Tests). */
function db(?PDO $override = null): PDO
{
    static $pdo = null;
    if ($override !== null) return $pdo = $override;
    if ($pdo !== null) return $pdo;
    $db = config()['db'];
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $db['host'], $db['port'], $db['name'], $db['charset']);
    return $pdo = new PDO($dsn, $db['user'], $db['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}

function execute(string $sql, array $values = []): PDOStatement
{
    $statement = db()->prepare($sql);
    $statement->execute($values);
    return $statement;
}

function query(string $sql, array $values = []): array
{
    return execute($sql, $values)->fetchAll();
}

/** Mit $lock serialisiert eine benannte DB-Sperre parallele Schreibvorgaenge auf dieselbe Wahl. */
function transaction(callable $action, bool $lock = false): mixed
{
    if ($lock && (int) query('SELECT GET_LOCK(' . LOCK_NAME . ', 10) AS locked')[0]['locked'] !== 1)
        throw new ApiError('Datenbank ist beschäftigt. Stapel erneut übertragen.', 503);
    try {
        db()->beginTransaction();
        $result = $action();
        db()->commit();
        return $result;
    } catch (Throwable $error) {
        if (db()->inTransaction()) db()->rollBack();
        throw $error;
    } finally {
        if ($lock) query('SELECT RELEASE_LOCK(' . LOCK_NAME . ')');
    }
}

function jsonResponse(mixed $payload, int $status = 200): void
{
    throw new ApiResponse($payload, $status, ['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store']);
}

function rawResponse(string $body, int $status, array $headers): void
{
    throw new ApiResponse(null, $status, $headers, $body);
}

function errorResponse(string $message, int $status): ApiResponse
{
    return new ApiResponse(['error' => $message], $status, ['Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store']);
}

function emitResponse(ApiResponse $response): void
{
    http_response_code($response->statusCode);
    foreach ($response->headers as $name => $value) header($name . ': ' . $value);
    echo $response->rawBody ?? json_encode($response->payload, JSON_FLAGS);
}

function requestPath(): string
{
    if (!empty($_SERVER['PATH_INFO'])) return '/' . ltrim((string) $_SERVER['PATH_INFO'], '/');
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $scriptName = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
    if ($scriptName && str_starts_with($path, $scriptName . '/')) return '/' . ltrim(substr($path, strlen($scriptName)), '/');
    $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
    if ($base && $base !== '/' && str_starts_with($path, $base . '/')) $path = substr($path, strlen($base));
    return '/' . ltrim($path, '/');
}

/** Ohne Argument der Rohkoerper als Stream, mit Argument setzen (fuer Tests, null setzt zurueck). */
function requestStream(?string $override = null)
{
    static $body = null;
    if (func_num_args() > 0) $body = $override;
    if ($body === null) return fopen('php://input', 'rb');
    $stream = fopen('php://memory', 'w+b');
    fwrite($stream, $body);
    rewind($stream);
    return $stream;
}

function contentType(): string
{
    return strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? ''))[0]));
}

function readJsonBody(): mixed
{
    if (contentType() !== 'application/json') throw new ApiError('JSON erwartet.', 415);
    $raw = (string) stream_get_contents(requestStream(), JSON_MAX + 1);
    if (strlen($raw) > JSON_MAX) throw new ApiError('Anfrage ist zu groß.', 413);
    try {
        return json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new ApiError('Ungültiges JSON.');
    }
}

function authorizationHeader(): string
{
    foreach (['HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION', 'REDIRECT_REDIRECT_HTTP_AUTHORIZATION'] as $key) {
        if (!empty($_SERVER[$key])) return (string) $_SERVER[$key];
    }
    return '';
}

/**
 * Etliche Hoster reichen den Authorization-Header nicht an PHP durch (FastCGI/CGI).
 * Der Client sendet das Sitzungstoken deshalb zusaetzlich als X-Auth-Token.
 */
function bearerToken(): string
{
    return preg_match('/^Bearer\s+(.+)$/i', authorizationHeader(), $matches)
        ? trim($matches[1])
        : trim((string) ($_SERVER['HTTP_X_AUTH_TOKEN'] ?? ''));
}

function requireSameOrigin(): void
{
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin === '') return;
    $parts = parse_url($origin) ?: [];
    $host = ($parts['host'] ?? '') . (isset($parts['port']) ? ':' . $parts['port'] : '');
    if (strcasecmp($host, (string) ($_SERVER['HTTP_HOST'] ?? '')) !== 0)
        throw new ApiError('Zugriff von einer anderen Website ist nicht erlaubt.', 403);
}

/* --- Anmeldung ---------------------------------------------------------- */

function tokenHash(string $token): string
{
    return hash('sha256', $token);
}

function publicUser(array $user): array
{
    return ['username' => $user['username'], 'role' => $user['role'], 'wahllokal' => $user['wahllokal'],
        'passwordChangeRequired' => (bool) $user['password_change_required']];
}

/** Der Benutzer zur Sitzung dieser Anfrage, oder null. Gesperrte Konten verlieren sofort den Zugang. */
function currentUser(): ?array
{
    $token = bearerToken();
    if ($token === '') return null;
    return query('SELECT u.id, u.username, u.role, u.wahllokal, u.password_change_required FROM app_session s
        JOIN app_user u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > NOW() AND u.active = 1', [tokenHash($token)])[0] ?? null;
}

function requireUser(): array
{
    return currentUser() ?? throw new ApiError('Anmeldung erforderlich.', 401);
}

function requireAdmin(array $user): void
{
    if ($user['role'] !== 'admin') throw new ApiError('Nur Admins dürfen das.', 403);
}

/** Admins duerfen jedes Wahllokal, ein Wahlvorstand nur sein eigenes. */
function wahllokalErlaubt(array $user, string $nummer): bool
{
    return $user['role'] === 'admin' || $user['wahllokal'] === $nummer;
}

function validatePassword(mixed $password): string
{
    if (!is_string($password) || mb_strlen($password) < PASSWORD_MIN_LENGTH) throw new ApiError('Das Passwort muss mindestens 12 Zeichen haben.');
    return $password;
}

function login(mixed $value): array
{
    $username = is_string($value['username'] ?? null) ? mb_substr(trim($value['username']), 0, 80) : '';
    $password = is_string($value['password'] ?? null) ? $value['password'] : '';
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    execute('DELETE FROM app_login_attempt WHERE attempted_at < NOW() - INTERVAL ' . LOGIN_WINDOW_MINUTES . ' MINUTE');
    $attempts = static fn(string $column, string $key): int => (int) query("SELECT COUNT(*) AS n FROM app_login_attempt WHERE $column = ?", [$key])[0]['n'];
    if ($attempts('username', $username) >= LOGIN_MAX_PER_USER || $attempts('ip', $ip) >= LOGIN_MAX_PER_IP)
        throw new ApiError('Zu viele Anmeldeversuche. Bitte später erneut probieren.', 429);
    $user = query('SELECT id, username, role, wahllokal, password_hash, password_change_required, active FROM app_user WHERE username = ?', [$username])[0] ?? null;
    $active = $user && (int) $user['active'] === 1;
    $passwordOk = password_verify($password, $active ? $user['password_hash'] : LOGIN_DUMMY_HASH);
    if (!$active || !$passwordOk) {
        execute('INSERT INTO app_login_attempt (username, ip) VALUES (?, ?)', [$username, $ip]);
        throw new ApiError('Anmeldung fehlgeschlagen.', 401);
    }
    execute('DELETE FROM app_login_attempt WHERE username = ?', [$username]);
    execute('DELETE FROM app_session WHERE expires_at <= NOW()');
    $token = bin2hex(random_bytes(32));
    execute('INSERT INTO app_session (token_hash, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL ' . SESSION_TTL_HOURS . ' HOUR)', [tokenHash($token), $user['id']]);
    return ['token' => $token, 'user' => publicUser($user)];
}

function logout(): void
{
    execute('DELETE FROM app_session WHERE token_hash = ?', [tokenHash(bearerToken())]);
}

/** Neues Passwort; beendet alle anderen Sitzungen des Kontos. */
function changePassword(array $user, mixed $value): array
{
    $current = is_string($value['currentPassword'] ?? null) ? $value['currentPassword'] : '';
    $new = validatePassword($value['newPassword'] ?? null);
    if (!password_verify($current, query('SELECT password_hash FROM app_user WHERE id = ?', [$user['id']])[0]['password_hash']))
        throw new ApiError('Das bisherige Passwort stimmt nicht.', 403);
    if ($new === $current) throw new ApiError('Das neue Passwort muss sich vom bisherigen unterscheiden.');
    execute('UPDATE app_user SET password_hash = ?, password_change_required = 0 WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), $user['id']]);
    execute('DELETE FROM app_session WHERE user_id = ? AND token_hash <> ?', [$user['id'], tokenHash(bearerToken())]);
    return publicUser(['password_change_required' => 0] + $user);
}

/** Legt ein Konto an oder setzt es zurueck (create-user.php). Das Passwort muss beim ersten Login geaendert werden. */
function saveUser(string $username, mixed $password, string $role, ?string $wahllokal): void
{
    $username = text($username, 'Benutzername');
    if (mb_strlen($username) > 80) throw new ApiError('Benutzername ist zu lang (maximal 80 Zeichen).');
    $password = validatePassword($password);
    if (!in_array($role, ROLLEN, true)) throw new ApiError('Rolle muss admin oder wahlvorstand sein.');
    if ($role === 'admin') $wahllokal = null;
    elseif ($wahllokal === null || !query('SELECT nummer FROM wahllokal WHERE nummer = ?', [$wahllokal]))
        throw new ApiError('Ein Wahlvorstand braucht ein registriertes Wahllokal.');
    execute('INSERT INTO app_user (username, password_hash, role, wahllokal, password_change_required, active) VALUES (?, ?, ?, ?, 1, 1)
        ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), wahllokal = VALUES(wahllokal), password_change_required = 1, active = 1',
        [$username, password_hash($password, PASSWORD_DEFAULT), $role, $wahllokal]);
    execute('DELETE s FROM app_session s JOIN app_user u ON u.id = s.user_id WHERE u.username = ?', [$username]);
}

/** Sperrt ein Konto; laufende Sitzungen enden sofort. */
function lockUser(string $username): void
{
    if (!query('SELECT id FROM app_user WHERE username = ?', [$username])) throw new ApiError("Konto $username gibt es nicht.", 404);
    execute('UPDATE app_user SET active = 0 WHERE username = ?', [$username]);
    execute('DELETE s FROM app_session s JOIN app_user u ON u.id = s.user_id WHERE u.username = ?', [$username]);
}

/* --- Wahl --------------------------------------------------------------- */

/** Nur fachliche Angaben, gleich aufgebaut wie getWahlDefinition() in src/erfassungsplatz/wahl.js. */
function getWahlDefinition(array $kalibrierung): array
{
    $stimmen = array_map(static function (array $stimme): array {
        $vorschlaege = array_map(static fn(array $feld): array => ['id' => $feld['id'], 'nummer' => $feld['nummer'], 'beschriftung' => $feld['beschriftung']], $stimme['felder']);
        usort($vorschlaege, static fn(array $a, array $b): int => $a['nummer'] <=> $b['nummer'] ?: strcmp($a['id'], $b['id']));
        return ['id' => $stimme['id'], 'name' => $stimme['name'], 'auswahl' => $stimme['auswahl'] ?? 1, 'wahlvorschlaege' => $vorschlaege];
    }, $kalibrierung['stimmen']);
    usort($stimmen, static fn(array $a, array $b): int => strcmp($a['id'], $b['id']));
    return ['name' => $kalibrierung['name'], 'stimmen' => $stimmen];
}

/** Die Kalibrierung liegt neben php-api im App-Ordner; configuration.js sagt welche, wie im Browser. */
function kalibrierungPath(): string
{
    $path = (string) (config()['kalibrierung'] ?? '');
    if ($path !== '') return $path;
    $configuration = @file_get_contents(dirname(__DIR__) . '/configuration.js');
    if ($configuration === false || !preg_match("/KALIBRIERUNG\s*=\s*'([^']+)'/", $configuration, $match))
        throw new ApiError('configuration.js mit KALIBRIERUNG fehlt im App-Ordner.', 500);
    return dirname(__DIR__) . '/' . preg_replace('#^\./#', '', $match[1]);
}

/** Ohne Argument die Wahl dieser Installation, mit Argument aus einer Kalibrierung setzen (fuer Tests). */
function wahl(?array $kalibrierung = null): array
{
    static $wahl = null;
    if ($kalibrierung !== null) return $wahl = getWahlDefinition($kalibrierung);
    if ($wahl !== null) return $wahl;
    $raw = @file_get_contents(kalibrierungPath());
    if ($raw === false) throw new ApiError('Kalibrierung nicht gefunden: ' . basename(kalibrierungPath()), 500);
    return $wahl = getWahlDefinition(json_decode($raw, true, 512, JSON_THROW_ON_ERROR));
}

/** Muss byteweise JSON.stringify entsprechen: der Browser vergleicht den Hash der Wahl. */
function jsonHash(mixed $value): string
{
    return hash('sha256', json_encode($value, JSON_FLAGS));
}

function wahlHash(): string
{
    return jsonHash(wahl());
}

/** Legt beim ersten Zugriff die Tabellen an und prueft, ob die Datenbank zu dieser Wahl gehoert. */
function ensureWahl(): void
{
    $vorschlaege = [];
    foreach (wahl()['stimmen'] as $stimme) {
        foreach ($stimme['wahlvorschlaege'] as $vorschlag) $vorschlaege[] = ['stimme' => $stimme['id']] + $vorschlag;
    }
    try {
        $saved = query('SELECT stimme, id, nummer, beschriftung FROM wahlvorschlag');
    } catch (PDOException $error) {
        if ($error->getCode() !== '42S02') throw $error;
        foreach (array_filter(array_map('trim', explode(';', (string) file_get_contents(__DIR__ . '/schema.sql')))) as $sql) db()->exec($sql);
        $saved = [];
    }
    if (!$saved) $saved = transaction(static function () use ($vorschlaege): array {
        $saved = query('SELECT stimme, id, nummer, beschriftung FROM wahlvorschlag');
        if ($saved) return $saved;
        foreach ($vorschlaege as $vorschlag) execute('INSERT INTO wahlvorschlag (stimme, id, nummer, beschriftung) VALUES (?, ?, ?, ?)',
            [$vorschlag['stimme'], $vorschlag['id'], $vorschlag['nummer'], $vorschlag['beschriftung']]);
        return $vorschlaege;
    }, true);
    $key = static fn(array $row): string => json_encode([$row['stimme'], $row['id'], (int) $row['nummer'], $row['beschriftung']], JSON_FLAGS);
    $expected = array_map($key, $vorschlaege);
    $actual = array_map($key, $saved);
    sort($expected);
    sort($actual);
    if ($expected !== $actual) throw new ApiError('Die Datenbank enthält andere Wahlvorschläge. Für jede neue Wahl eine eigene Datenbank verwenden.', 409);
}

/* --- Wahllokale und Stapel ---------------------------------------------- */

function text(mixed $value, string $name): string
{
    if (!is_string($value) || trim($value) === '' || mb_strlen($value) > 160) throw new ApiError("$name fehlt oder ist zu lang.");
    return trim($value);
}

function registerWahllokal(mixed $value): array
{
    $nummer = text($value['nummer'] ?? null, 'Wahllokalnummer');
    $name = text($value['name'] ?? null, 'Name');
    $erwartet = $value['erwartet'] ?? null;
    if (!is_int($erwartet) || $erwartet < 1 || $erwartet > 100000) throw new ApiError('Erwartete Zettelzahl muss zwischen 1 und 100000 liegen.');
    $row = ['nummer' => $nummer, 'name' => $name, 'erwartet' => $erwartet];
    try {
        execute('INSERT INTO wahllokal (nummer, name, erwartet) VALUES (?, ?, ?)', array_values($row));
    } catch (PDOException $error) {
        if (($error->errorInfo[1] ?? 0) === 1062) throw new ApiError('Diese Wahllokalnummer ist bereits registriert.', 409);
        throw $error;
    }
    return $row;
}

function isList(mixed $value): bool
{
    return is_array($value) && array_values($value) === $value;
}

/** Prueft einen Stapel gegen die Wahl, ohne Datenbank. Liefert nur die fachlichen Angaben. */
function normalizeStapel(mixed $value, array $wahl, string $wahlHash): array
{
    $id = text($value['id'] ?? null, 'Stapelkennung');
    $wahllokal = text($value['wahllokal'] ?? null, 'Wahllokal');
    if (($value['wahlHash'] ?? null) !== $wahlHash) throw new ApiError('Wahlvorschläge stimmen nicht mit dem Server überein.', 409);
    $soll = $value['soll'] ?? null;
    $rows = $value['zettel'] ?? null;
    if (!is_int($soll) || $soll < 1 || $soll > 100 || !isList($rows) || count($rows) !== $soll)
        throw new ApiError('Ein Stapel muss vollständig sein (1 bis 100 Zettel).');
    $zettel = array_map(static function (mixed $row) use ($wahl): array {
        $zettelId = text($row['id'] ?? null, 'Erfassungskennung');
        $kennung = ($row['kennung'] ?? null) === null ? null : text($row['kennung'], 'Stimmzettelkennung');
        $stimmen = $row['stimmen'] ?? null;
        if (!isList($stimmen) || count($stimmen) !== count($wahl['stimmen'])) throw new ApiError('Unvollständige Stimmenwertung.');
        return ['id' => $zettelId, 'kennung' => $kennung, 'stimmen' => array_map(static function (array $stimme) use ($stimmen): array {
            $found = array_values(array_filter($stimmen, static fn(mixed $item): bool => is_array($item) && ($item['id'] ?? null) === $stimme['id']))[0] ?? [];
            $status = $found['status'] ?? null;
            $vorschlaege = $found['wahlvorschlaege'] ?? null;
            if (!in_array($status, STATUS, true) || !isList($vorschlaege)) throw new ApiError('Unbekannte Stimmenwertung.');
            $ids = array_column($stimme['wahlvorschlaege'], 'id');
            foreach ($vorschlaege as $vorschlag) {
                if (!in_array($vorschlag, $ids, true)) throw new ApiError('Unbekannter oder doppelter Wahlvorschlag.');
            }
            if (count(array_unique($vorschlaege)) !== count($vorschlaege)) throw new ApiError('Unbekannter oder doppelter Wahlvorschlag.');
            $anzahl = count($vorschlaege);
            if (($status === 'gueltig' && $anzahl !== $stimme['auswahl']) || ($status === 'leer' && $anzahl >= $stimme['auswahl'])
                || ($status === 'mehrfach' && $anzahl <= $stimme['auswahl'])) throw new ApiError('Wertung und Markierungen widersprechen sich.');
            sort($vorschlaege, SORT_STRING);
            return ['id' => $stimme['id'], 'status' => $status, 'wahlvorschlaege' => $vorschlaege];
        }, $wahl['stimmen']), 'bild' => normalizeBild($row['bild'] ?? null)];
    }, $rows);
    $kennungen = array_filter(array_column($zettel, 'kennung'));
    if (count(array_unique(array_column($zettel, 'id'))) !== count($zettel) || count(array_unique($kennungen)) !== count($kennungen))
        throw new ApiError('Der Stapel enthält doppelte Zettel.', 409);
    return ['id' => $id, 'wahllokal' => $wahllokal, 'soll' => $soll, 'zettel' => $zettel];
}

function normalizeBild(mixed $bild): array
{
    if (!is_string($bild['hash'] ?? null) || !preg_match('/^[a-f0-9]{64}$/', $bild['hash']) || !is_string($bild['type'] ?? null))
        throw new ApiError('Originalaufnahme fehlt.');
    return ['hash' => $bild['hash'], 'type' => $bild['type']];
}

function receiveStapel(array $user, mixed $value): array
{
    $data = normalizeStapel($value, wahl(), wahlHash());
    if (!wahllokalErlaubt($user, $data['wahllokal'])) throw new ApiError("Dieses Konto darf nur für Wahllokal {$user['wahllokal']} erfassen.", 403);
    foreach ($data['zettel'] as $row) {
        if (storedBildType($row['bild']['hash']) !== $row['bild']['type'])
            throw new ApiError('Originalaufnahme fehlt auf dem Server. Stapel erneut übertragen.', 409);
    }
    // Wie bisher: Ergebnisse, Zuordnungen und Hash/Dateityp der Belege, keine technischen Zusatzangaben.
    $fingerprint = jsonHash($data);
    return transaction(static function () use ($data, $fingerprint, $user): array {
        if (!query('SELECT nummer FROM wahllokal WHERE nummer = ?', [$data['wahllokal']])) throw new ApiError('Wahllokal ist nicht registriert.', 404);
        $existing = query('SELECT pruefsumme, eingang FROM stapel WHERE id = ?', [$data['id']])[0] ?? null;
        if ($existing) {
            if ($existing['pruefsumme'] !== $fingerprint) throw new ApiError('Stapelkennung wurde bereits mit anderen Daten verwendet.', 409);
            return ['id' => $data['id'], 'eingang' => $existing['eingang'], 'bereitsGespeichert' => true];
        }
        foreach ($data['zettel'] as $row) {
            if (query('SELECT id FROM stimmzettel WHERE id = ? OR (kennung IS NOT NULL AND kennung = ?)', [$row['id'], $row['kennung']]))
                throw new ApiError('Ein Zettel wurde bereits in einem anderen Stapel erfasst. Stapel prüfen.', 409);
        }
        $eingang = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
        execute('INSERT INTO stapel (id, wahllokal, soll, eingang, pruefsumme, erfasst_von) VALUES (?, ?, ?, ?, ?, ?)',
            [$data['id'], $data['wahllokal'], $data['soll'], $eingang, $fingerprint, $user['id']]);
        foreach ($data['zettel'] as $row) {
            $ergebnis = [];
            foreach ($row['stimmen'] as $stimme) $ergebnis[$stimme['id']] = ['status' => $stimme['status'], 'wahlvorschlaege' => $stimme['wahlvorschlaege']];
            execute('INSERT INTO stimmzettel (id, stapel, kennung, ergebnis, bildhash, bildtyp) VALUES (?, ?, ?, ?, ?, ?)',
                [$row['id'], $data['id'], $row['kennung'], json_encode($ergebnis, JSON_FLAGS), $row['bild']['hash'], $row['bild']['type']]);
        }
        return ['id' => $data['id'], 'eingang' => $eingang, 'bereitsGespeichert' => false];
    }, true);
}

/* --- Ergebnisse --------------------------------------------------------- */

function leereSumme(array $wahl): array
{
    return ['zettel' => 0, 'prueffaelle' => 0, 'stimmen' => array_map(static fn(array $stimme): array => [
        'id' => $stimme['id'], 'name' => $stimme['name'], 'gueltig' => 0, 'leer' => 0, 'mehrfach' => 0, 'zweifelsfall' => 0,
        'wahlvorschlaege' => array_map(static fn(array $vorschlag): array => $vorschlag + ['anzahl' => 0], $stimme['wahlvorschlaege']),
    ], $wahl['stimmen'])];
}

function addBelege(array &$summe, array $belege): void
{
    $summe['zettel'] += count($belege);
    foreach ($belege as $beleg) {
        if (isPrueffall($beleg)) $summe['prueffaelle']++;
        foreach ($beleg['stimmen'] as $stimme) {
            foreach ($summe['stimmen'] as $s => $ziel) {
                if ($ziel['id'] !== $stimme['id']) continue;
                $summe['stimmen'][$s][$stimme['status']]++;
                if ($stimme['status'] !== 'gueltig') continue;
                foreach ($ziel['wahlvorschlaege'] as $v => $vorschlag) {
                    if (in_array($vorschlag['id'], $stimme['wahlvorschlaege'], true)) $summe['stimmen'][$s]['wahlvorschlaege'][$v]['anzahl']++;
                }
            }
        }
    }
}

/** Ein gespeicherter Zettel als Beleg: Kennung, Dateityp und Wertung je Stimme. */
function toBeleg(array $row): array
{
    $ergebnis = json_decode($row['ergebnis'], true, 64, JSON_THROW_ON_ERROR);
    return ['id' => $row['id'], 'bildtyp' => $row['bildtyp'],
        'stimmen' => array_map(static fn(string $id, array $wertung): array => ['id' => $id] + $wertung, array_keys($ergebnis), $ergebnis)];
}

function isPrueffall(array $beleg): bool
{
    return (bool) array_filter($beleg['stimmen'], static fn(array $stimme): bool => $stimme['status'] !== 'gueltig');
}

/**
 * Summen je Wahllokal und insgesamt, je Stapel nur die Zaehler. Einzelne Belege liefert
 * stapelDetail() - bei 150 Wahllokalen waeren das sonst bei jeder Aktualisierung Megabytes.
 */
function buildUebersicht(array $wahl, string $wahlHash, array $wahllokale, array $stapel, array $zettel): array
{
    $belege = [];
    foreach ($zettel as $row) $belege[$row['stapel']][] = toBeleg($row);
    $gesamt = leereSumme($wahl);
    $lokale = [];
    foreach ($wahllokale as $row) $lokale[$row['nummer']] = array_replace($row, ['erwartet' => (int) $row['erwartet']]) + leereSumme($wahl) + ['stapel' => []];
    foreach ($stapel as $row) {
        $data = $belege[$row['id']] ?? [];
        addBelege($lokale[$row['wahllokal']], $data);
        addBelege($gesamt, $data);
        $lokale[$row['wahllokal']]['stapel'][] = ['id' => $row['id'], 'eingang' => $row['eingang'], 'soll' => (int) $row['soll'],
            'erfasstVon' => $row['erfasst_von'] ?? null, 'zettel' => count($data), 'prueffaelle' => count(array_filter($data, 'isPrueffall'))];
    }
    return ['wahl' => $wahl['name'], 'wahlHash' => $wahlHash, 'gesamt' => $gesamt, 'wahllokale' => array_values($lokale)];
}

/** Ein Wahlvorstand sieht nur sein Wahllokal (Fortschritt am Erfassungsplatz); die Gesamtsumme umfasst dann nur dieses. */
function uebersicht(array $user): array
{
    $nur = $user['role'] === 'admin' ? [] : [$user['wahllokal']];
    [$wahllokale, $stapel, $zettel] = transaction(static fn(): array => [
        query('SELECT nummer, name, erwartet FROM wahllokal' . ($nur ? ' WHERE nummer = ?' : '') . ' ORDER BY nummer', $nur),
        query('SELECT s.id, s.wahllokal, s.eingang, s.soll, u.username AS erfasst_von FROM stapel s LEFT JOIN app_user u ON u.id = s.erfasst_von'
            . ($nur ? ' WHERE s.wahllokal = ?' : '') . ' ORDER BY s.eingang DESC, s.id', $nur),
        query('SELECT z.id, z.stapel, z.ergebnis, z.bildtyp FROM stimmzettel z JOIN stapel s ON s.id = z.stapel'
            . ($nur ? ' WHERE s.wahllokal = ?' : '') . ' ORDER BY z.stapel, z.id', $nur),
    ]);
    return buildUebersicht(wahl(), wahlHash(), $wahllokale, $stapel, $zettel);
}

/** Ein Stapel mit Summen und allen Belegen, fuer die Detailansicht im ControlCenter. */
function stapelDetail(string $id): array
{
    $row = query('SELECT s.id, s.wahllokal, s.eingang, s.soll, u.username AS erfasst_von FROM stapel s LEFT JOIN app_user u ON u.id = s.erfasst_von WHERE s.id = ?', [$id])[0] ?? null;
    if (!$row) throw new ApiError('Stapel nicht gefunden.', 404);
    $belege = array_map('toBeleg', query('SELECT id, ergebnis, bildtyp FROM stimmzettel WHERE stapel = ? ORDER BY id', [$id]));
    $summe = leereSumme(wahl());
    addBelege($summe, $belege);
    return ['id' => $row['id'], 'wahllokal' => $row['wahllokal'], 'eingang' => $row['eingang'], 'soll' => (int) $row['soll'],
        'erfasstVon' => $row['erfasst_von']] + $summe + ['belege' => $belege];
}

/** Alle Zettel mit leerer, mehrfacher oder unklarer Stimme, neueste Stapel zuerst. */
function prueffaelle(): array
{
    $rows = query('SELECT z.id, z.ergebnis, z.bildtyp, s.id AS stapel, s.wahllokal, s.eingang FROM stimmzettel z JOIN stapel s ON s.id = z.stapel ORDER BY s.eingang DESC, s.id, z.id');
    $result = [];
    foreach ($rows as $row) {
        $beleg = toBeleg($row);
        if (isPrueffall($beleg)) $result[] = $beleg + ['stapel' => $row['stapel'], 'wahllokal' => $row['wahllokal'], 'eingang' => $row['eingang']];
    }
    return $result;
}

/** Fortschritt je Wahllokal fuer den Erfassungsplatz: Zaehler ohne Stimmen und Belege. */
function listWahllokale(array $user): array
{
    return array_map(static fn(array $lokal): array => [
        'nummer' => $lokal['nummer'], 'name' => $lokal['name'], 'erwartet' => $lokal['erwartet'],
        'zettel' => $lokal['zettel'], 'prueffaelle' => $lokal['prueffaelle'], 'stapel' => count($lokal['stapel']),
        'letzterEingang' => $lokal['stapel'][0]['eingang'] ?? null,
    ], uebersicht($user)['wahllokale']);
}

/* --- Originalbelege ----------------------------------------------------- */

function detectBildType(string $head): ?string
{
    if (str_starts_with($head, "\x89PNG\r\n\x1a\n")) return 'image/png';
    if (str_starts_with($head, "\xff\xd8\xff")) return 'image/jpeg';
    if (substr($head, 0, 4) === 'RIFF' && substr($head, 8, 4) === 'WEBP') return 'image/webp';
    if (in_array(substr($head, 0, 6), ['GIF87a', 'GIF89a'], true)) return 'image/gif';
    if (str_starts_with($head, '%PDF-')) return 'application/pdf';
    return null;
}

/** Der SHA-256 der Datei ist ihr Name: gleiche Aufnahmen liegen nur einmal vor. */
function bildPath(string $hash): string
{
    if (!preg_match('/^[a-f0-9]{64}$/', $hash)) throw new ApiError('Ungültige Belegkennung.');
    return rtrim((string) config()['bilder_path'], '/\\') . '/' . $hash . '.bin';
}

function storedBildType(string $hash): ?string
{
    $head = @file_get_contents(bildPath($hash), false, null, 0, 16);
    return $head === false ? null : detectBildType($head);
}

/** Speichert einen Beleg aus dem Stream erst nach Pruefung von Hash und Dateityp. True, wenn er neu ist. */
function storeBild(string $hash, string $type, $stream): bool
{
    $path = bildPath($hash);
    if (is_file($path)) {
        if (hash_file('sha256', $path) !== $hash) throw new RuntimeException('Beleg-Prüfsumme stimmt nicht: ' . $path);
        return false;
    }
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0770, true) && !is_dir($dir)) throw new RuntimeException('Belegordner kann nicht angelegt werden: ' . $dir);
    if (!is_file($dir . '/.htaccess')) file_put_contents($dir . '/.htaccess', "Require all denied\n");
    $temporary = $dir . '/' . $hash . '.' . bin2hex(random_bytes(8)) . '.tmp';
    $target = fopen($temporary, 'xb');
    try {
        $size = stream_copy_to_stream($stream, $target, BILD_MAX + 1);
        fclose($target);
        if (!$size || $size > BILD_MAX) throw new ApiError('Originalaufnahme fehlt oder ist zu groß (maximal 20 MB).', 413);
        if (hash_file('sha256', $temporary) !== $hash) throw new ApiError('Prüfsumme der Originalaufnahme stimmt nicht.');
        $detected = detectBildType((string) file_get_contents($temporary, false, null, 0, 16));
        if ($detected === null) throw new ApiError('Beleg muss ein PNG-, JPEG-, WebP-, GIF-Bild oder PDF sein.');
        if ($detected !== $type) throw new ApiError('Dateityp der Originalaufnahme stimmt nicht.');
        if (!rename($temporary, $path) && !is_file($path)) throw new RuntimeException('Beleg konnte nicht gespeichert werden: ' . $path);
        return true;
    } finally {
        if (is_resource($target)) fclose($target);
        if (is_file($temporary)) unlink($temporary);
    }
}

function loadStimmzettelBild(string $id): array
{
    $row = query('SELECT bildhash, bildtyp FROM stimmzettel WHERE id = ?', [$id])[0] ?? null;
    if (!$row) throw new ApiError('Stimmzettel nicht gefunden.', 404);
    $data = @file_get_contents(bildPath($row['bildhash']));
    if ($data === false) throw new ApiError('Originalbeleg fehlt auf dem Server.', 404);
    if (hash('sha256', $data) !== $row['bildhash']) throw new RuntimeException('Beleg-Prüfsumme stimmt nicht: ' . $row['bildhash']);
    return ['data' => $data, 'type' => $row['bildtyp']];
}

/* --- Routen ------------------------------------------------------------- */

function handleRequest(string $method, string $path): void
{
    if ($path === '/health') {
        try {
            db()->query('SELECT 1');
        } catch (Throwable) {
            jsonResponse(['status' => 'db-unavailable'], 503);
        }
        // tokenReceived zeigt, ob der Hoster Authorization bzw. X-Auth-Token durchreicht.
        jsonResponse(['status' => 'ok', 'tokenReceived' => bearerToken() !== '']);
    }
    if (!str_starts_with($path, '/api/')) throw new ApiError('Schnittstelle nicht gefunden.', 404);
    if ($method !== 'GET') requireSameOrigin();
    ensureWahl();
    if ($path === '/api/session' && $method === 'POST') jsonResponse(login(readJsonBody()));
    $user = requireUser();
    if ($path === '/api/session' && $method === 'GET') jsonResponse(publicUser($user));
    if ($path === '/api/session' && $method === 'DELETE') {
        logout();
        jsonResponse(['ok' => true]);
    }
    if ($path === '/api/session/password' && $method === 'POST') jsonResponse(changePassword($user, readJsonBody()));
    if ($user['password_change_required']) throw new ApiError('Bitte zuerst das Passwort ändern.', 403);
    if ($path === '/api/wahllokale' && $method === 'GET') jsonResponse(['wahllokale' => listWahllokale($user), 'wahlHash' => wahlHash()]);
    if ($path === '/api/wahllokale' && $method === 'POST') {
        requireAdmin($user);
        jsonResponse(registerWahllokal(readJsonBody()), 201);
    }
    if ($path === '/api/stapel' && $method === 'POST') jsonResponse(receiveStapel($user, readJsonBody()));
    // Ergebnisse und Belege gehoeren ins ControlCenter: nur fuer Admins.
    if ($path === '/api/ergebnisse' && $method === 'GET') {
        requireAdmin($user);
        jsonResponse(uebersicht($user));
    }
    if (preg_match('#^/api/stapel/([^/]+)$#', $path, $match) && $method === 'GET') {
        requireAdmin($user);
        jsonResponse(stapelDetail(rawurldecode($match[1])));
    }
    if ($path === '/api/prueffaelle' && $method === 'GET') {
        requireAdmin($user);
        jsonResponse(['prueffaelle' => prueffaelle()]);
    }
    if (preg_match('#^/api/bilder/([a-f0-9]{64})$#', $path, $match) && $method === 'PUT') {
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > BILD_MAX) throw new ApiError('Originalaufnahme ist zu groß (maximal 20 MB).', 413);
        jsonResponse(['hash' => $match[1]], storeBild($match[1], contentType(), requestStream()) ? 201 : 200);
    }
    if (preg_match('#^/api/stimmzettel/([^/]+)/bild$#', $path, $match) && $method === 'GET') {
        requireAdmin($user);
        $bild = loadStimmzettelBild(rawurldecode($match[1]));
        rawResponse($bild['data'], 200, ['Content-Type' => $bild['type'], 'Cache-Control' => 'no-store', 'Content-Disposition' => 'inline']);
    }
    throw new ApiError('Schnittstelle nicht gefunden.', 404);
}
