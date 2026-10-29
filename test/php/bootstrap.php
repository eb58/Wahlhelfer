<?php
declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require __DIR__ . '/../../server/lib.php';

const TEST_PASSWORD = 'testpasswort-12';
const TEST_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAZkAAAAASUVORK5CYII=';

/** Erfassungs- und Stapelkennungen erzeugt der Browser (crypto.randomUUID). */
function uuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr(ord($bytes[6]) & 0x0f | 0x40);
    $bytes[8] = chr(ord($bytes[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

function kalibrierung(string $name = 'bundestagswahl-2017'): array
{
    return json_decode((string) file_get_contents(__DIR__ . "/../../Wahlen/$name/kalibrierung.json"), true, 512, JSON_THROW_ON_ERROR);
}

/** Faengt die geworfene Antwort bzw. den Fehler ab - beides gehoert zum Ergebnis einer Anfrage. */
function capture(callable $call): ApiResponse
{
    try {
        $call();
    } catch (ApiResponse $response) {
        return $response;
    } catch (ApiError $error) {
        return errorResponse($error->getMessage(), $error->statusCode);
    }
    throw new LogicException('Keine Antwort erzeugt.');
}

/** Wegwerf-Datenbank aus test/docker-compose.test.yml; ohne sie ueberspringen sich die Tests. */
abstract class DatabaseTestCase extends TestCase
{
    private static ?PDO $pdo = null;
    private static ?string $failure = null;
    protected string $bilderPath;
    /** Angemeldetes Admin-Konto, so wie currentUser() es liefert. */
    protected array $admin;
    protected string $adminToken;

    private static function pdo(): ?PDO
    {
        if (self::$pdo || self::$failure !== null) return self::$pdo;
        $env = static fn(string $name, string $fallback): string => getenv($name) ?: $fallback;
        try {
            self::$pdo = new PDO(sprintf('mysql:host=%s;port=%s;dbname=wahlassistent_test;charset=utf8mb4', $env('WAHL_TEST_DB_HOST', '127.0.0.1'), $env('WAHL_TEST_DB_PORT', '3308')),
                'root', $env('WAHL_TEST_DB_PASSWORD', 'test'), [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                    PDO::ATTR_TIMEOUT => 3,
                ]);
        } catch (Throwable $error) {
            self::$failure = $error->getMessage();
        }
        return self::$pdo;
    }

    protected function setUp(): void
    {
        $pdo = self::pdo();
        if (!$pdo) $this->markTestSkipped('Test-Datenbank nicht erreichbar (npm run test:php:db:up). ' . self::$failure);
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        foreach ($pdo->query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()')->fetchAll() as $row) {
            $pdo->exec('DROP TABLE `' . $row['TABLE_NAME'] . '`');
        }
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        // Nur die Tabellen; die Wahlvorschlaege traegt ensureWahl() fuer die Wahl des jeweiligen Tests ein.
        foreach (array_filter(array_map('trim', explode(';', (string) file_get_contents(__DIR__ . '/../../server/schema.sql')))) as $sql) $pdo->exec($sql);
        $this->bilderPath = sys_get_temp_dir() . '/wahlbilder-' . bin2hex(random_bytes(6));
        db($pdo);
        config(['bilder_path' => $this->bilderPath]);
        wahl(kalibrierung());
        unset($_SERVER['HTTP_ORIGIN'], $_SERVER['HTTP_X_AUTH_TOKEN'], $_SERVER['CONTENT_LENGTH'], $_SERVER['CONTENT_TYPE'], $_SERVER['HTTP_AUTHORIZATION']);
        $_SERVER = ['REQUEST_METHOD' => 'GET', 'HTTP_HOST' => 'localhost', 'REMOTE_ADDR' => '192.0.2.1'] + $_SERVER;
        requestStream(null);
        [$this->admin, $this->adminToken] = $this->konto('admin');
        $this->anmelden($this->adminToken);
    }

    /** Legt ein Konto samt Sitzung an (ohne Passwortwechsel-Pflicht) und liefert Benutzer und Token. */
    protected function konto(string $role, ?string $wahllokal = null, string $username = ''): array
    {
        $username = $username ?: $role . ($wahllokal ?? '');
        execute('INSERT INTO app_user (username, password_hash, role, wahllokal, password_change_required) VALUES (?, ?, ?, ?, 0)',
            [$username, password_hash(TEST_PASSWORD, PASSWORD_BCRYPT, ['cost' => 4]), $role, $wahllokal]);
        $id = (int) db()->lastInsertId();
        $token = bin2hex(random_bytes(16));
        execute('INSERT INTO app_session (token_hash, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL 1 HOUR)', [tokenHash($token), $id]);
        return [['id' => $id, 'username' => $username, 'role' => $role, 'wahllokal' => $wahllokal, 'password_change_required' => 0], $token];
    }

    protected function anmelden(?string $token): void
    {
        if ($token === null) unset($_SERVER['HTTP_AUTHORIZATION']);
        else $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
    }

    protected function tearDown(): void
    {
        requestStream(null);
        foreach (glob($this->bilderPath . '/{,.}*', GLOB_BRACE) ?: [] as $file) if (is_file($file)) unlink($file);
        if (is_dir($this->bilderPath)) rmdir($this->bilderPath);
    }

    protected function request(string $method, string $path, mixed $body = null, string $type = 'application/json'): ApiResponse
    {
        $_SERVER['REQUEST_METHOD'] = $method;
        $_SERVER['CONTENT_TYPE'] = $type;
        requestStream($body === null ? '' : (is_string($body) ? $body : json_encode($body, JSON_FLAGS)));
        return capture(static fn() => handleRequest($method, $path));
    }

    protected function sql(string $sql, array $values = []): array
    {
        return query($sql, $values);
    }

    /** Laedt den Beleg wie der Browser vor dem Stapel hoch und liefert den Verweis fuer den Zettel. */
    protected function bild(string $data = ''): array
    {
        $data = $data ?: base64_decode(TEST_PNG);
        $hash = hash('sha256', $data);
        $response = $this->request('PUT', "/api/bilder/$hash", $data, 'image/png');
        $this->assertContains($response->statusCode, [200, 201], json_encode($response->payload, JSON_FLAGS));
        return ['hash' => $hash, 'type' => 'image/png'];
    }

    protected function wahllokal(string $nummer = '001', string $name = 'Schule'): array
    {
        ensureWahl();
        registerWahllokal(['nummer' => $nummer, 'name' => $name]);
        return meldeStimmzettelzahl($this->admin, $nummer, 20);
    }

    protected function zettel(string $status = 'gueltig', ?array $typ = null): array
    {
        return ['id' => uuid(), 'bild' => $this->bild(), 'stimmen' => array_map(static fn(array $stimme): array => [
            'id' => $stimme['id'], 'status' => $status, 'wahlvorschlaege' => $status === 'gueltig' ? [$stimme['felder'][0]['id']] : [],
        ], ($typ ?? kalibrierung())['stimmen'])];
    }

    protected function stapel(array $lokal, array $zettel): array
    {
        return ['id' => uuid(), 'wahllokal' => $lokal['nummer'], 'wahlHash' => wahlHash(), 'soll' => count($zettel), 'zettel' => $zettel];
    }

    protected function assertApiError(int $status, string $pattern, callable $call): void
    {
        $response = capture($call);
        $this->assertSame($status, $response->statusCode, json_encode($response->payload, JSON_FLAGS));
        $this->assertMatchesRegularExpression($pattern, $response->payload['error']);
    }
}
