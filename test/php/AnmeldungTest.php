<?php
declare(strict_types=1);

/** Anmeldung, Sitzungen und was ein Wahlvorstand gegenueber einem Admin darf. */
final class AnmeldungTest extends DatabaseTestCase
{
    private function login(string $username, string $password): ApiResponse
    {
        $this->anmelden(null);
        return $this->request('POST', '/api/session', ['username' => $username, 'password' => $password]);
    }

    public function testAnmeldungLiefertSitzungUndKonto(): void
    {
        $response = $this->login('admin', TEST_PASSWORD);
        $this->assertSame(200, $response->statusCode);
        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $response->payload['token']);
        $this->assertSame(['username' => 'admin', 'role' => 'admin', 'wahllokal' => null, 'passwordChangeRequired' => false], $response->payload['user']);
        $this->anmelden($response->payload['token']);
        $this->assertSame('admin', $this->request('GET', '/api/session')->payload['username']);
        $this->assertSame([], $this->sql('SELECT token_hash FROM app_session WHERE token_hash = ?', [$response->payload['token']]), 'Token nur als Hash gespeichert');
    }

    public function testErstesAdminKontoNurOhneKonten(): void
    {
        $this->anmelden(null);
        $this->assertSame(['required' => false], $this->request('GET', '/api/setup')->payload);
        $response = $this->request('POST', '/api/setup', ['username' => 'eindringling', 'password' => 'irgendein-passwort']);
        $this->assertSame([409, 'Es gibt schon ein Konto. Bitte anmelden.'], [$response->statusCode, $response->payload['error']]);

        execute('DELETE FROM app_session');
        execute('DELETE FROM app_user');
        $this->assertSame(['required' => true], $this->request('GET', '/api/setup')->payload);
        $this->assertSame(400, $this->request('POST', '/api/setup', ['username' => 'wahlamt', 'password' => 'kurz'])->statusCode);
        $response = $this->request('POST', '/api/setup', ['username' => ' wahlamt ', 'password' => 'erstes-passwort-1']);
        $this->assertSame(201, $response->statusCode);
        $this->assertSame(['username' => 'wahlamt', 'role' => 'admin', 'wahllokal' => null, 'passwordChangeRequired' => false], $response->payload['user']);
        $this->anmelden($response->payload['token']);
        $this->assertSame(200, $this->request('GET', '/api/ergebnisse')->statusCode, 'gleich als Admin angemeldet');
        $this->assertSame(['required' => false], $this->request('GET', '/api/setup')->payload);
        $this->assertSame(409, $this->request('POST', '/api/setup', ['username' => 'zweiter', 'password' => 'zweites-passwort'])->statusCode);
        $this->assertSame(200, $this->login('wahlamt', 'erstes-passwort-1')->statusCode);
    }

    public function testFalschesPasswortUnbekannterNameUndGesperrtesKontoSehenGleichAus(): void
    {
        $this->wahllokal('518');
        $this->konto('wahlvorstand', '518', 'gesperrt');
        lockUser('gesperrt');
        foreach ([['admin', 'falsches-passwort'], ['gibtesnicht', TEST_PASSWORD], ['gesperrt', TEST_PASSWORD]] as [$name, $password]) {
            $response = $this->login($name, $password);
            $this->assertSame([401, ['error' => 'Anmeldung fehlgeschlagen.']], [$response->statusCode, $response->payload], $name);
        }
    }

    public function testFehlversucheWerdenGedrosselt(): void
    {
        for ($i = 0; $i < LOGIN_MAX_PER_USER; $i++) $this->assertSame(401, $this->login('admin', 'falsch')->statusCode);
        $this->assertSame(429, $this->login('admin', TEST_PASSWORD)->statusCode, 'auch mit richtigem Passwort');
        $_SERVER['REMOTE_ADDR'] = '192.0.2.2';
        $this->assertSame(429, $this->login('admin', TEST_PASSWORD)->statusCode, 'je Name, nicht nur je IP');
        execute('UPDATE app_login_attempt SET attempted_at = NOW() - INTERVAL 16 MINUTE');
        $this->assertSame(200, $this->login('admin', TEST_PASSWORD)->statusCode, 'nach Ablauf des Zeitfensters');
        $this->assertSame([], $this->sql("SELECT * FROM app_login_attempt WHERE username = 'admin'"));
    }

    public function testAbgemeldeteUndAbgelaufeneSitzungenGeltenNicht(): void
    {
        $this->assertSame(200, $this->request('DELETE', '/api/session')->statusCode);
        $this->assertSame(401, $this->request('GET', '/api/wahllokale')->statusCode);
        [, $token] = $this->konto('admin', null, 'abgelaufen');
        execute('UPDATE app_session SET expires_at = NOW() - INTERVAL 1 MINUTE WHERE token_hash = ?', [tokenHash($token)]);
        $this->anmelden($token);
        $response = $this->request('GET', '/api/session');
        $this->assertSame([401, 'Anmeldung erforderlich.'], [$response->statusCode, $response->payload['error']]);
    }

    public function testErstesPasswortMussGeaendertWerden(): void
    {
        $this->wahllokal('518');
        saveUser('vorstand518', 'startpasswort-123', 'wahlvorstand', '518');
        $token = $this->login('vorstand518', 'startpasswort-123')->payload['token'];
        $other = $this->login('vorstand518', 'startpasswort-123')->payload['token'];
        $this->anmelden($token);
        $this->assertTrue($this->request('GET', '/api/session')->payload['passwordChangeRequired']);
        $this->assertSame([403, 'Bitte zuerst das Passwort ändern.'], [($r = $this->request('GET', '/api/wahllokale'))->statusCode, $r->payload['error']]);
        $change = fn(string $current, string $new): ApiResponse => $this->request('POST', '/api/session/password', ['currentPassword' => $current, 'newPassword' => $new]);
        $this->assertSame(403, $change('falsch', 'neues-passwort-123')->statusCode);
        $this->assertSame(400, $change('startpasswort-123', 'zu-kurz')->statusCode);
        $this->assertSame(400, $change('startpasswort-123', 'startpasswort-123')->statusCode);
        $this->assertFalse($change('startpasswort-123', 'neues-passwort-123')->payload['passwordChangeRequired']);
        $this->assertSame(200, $this->request('GET', '/api/wahllokale')->statusCode);
        $this->anmelden($other);
        $this->assertSame(401, $this->request('GET', '/api/session')->statusCode, 'andere Sitzungen enden');
        $this->assertSame(200, $this->login('vorstand518', 'neues-passwort-123')->statusCode);
    }

    public function testKontenAnlegenPrueftRolleUndWahllokal(): void
    {
        $this->wahllokal('518');
        $this->assertApiError(400, '/mindestens 12/', static fn() => saveUser('x', 'kurz', 'admin', null));
        $this->assertApiError(400, '/Rolle/', static fn() => saveUser('x', 'langes-passwort', 'helfer', null));
        $this->assertApiError(400, '/registriertes Wahllokal/', static fn() => saveUser('x', 'langes-passwort', 'wahlvorstand', null));
        $this->assertApiError(400, '/registriertes Wahllokal/', static fn() => saveUser('x', 'langes-passwort', 'wahlvorstand', '999'));
        saveUser('chef', 'langes-passwort', 'admin', '518');
        $this->assertSame([['role' => 'admin', 'wahllokal' => null, 'password_change_required' => 1]],
            $this->sql("SELECT role, wahllokal, password_change_required FROM app_user WHERE username = 'chef'"));
        $this->assertApiError(404, '/gibt es nicht/', static fn() => lockUser('niemand'));
    }

    public function testGesperrtesKontoVerliertLaufendeSitzung(): void
    {
        [, $token] = $this->konto('admin', null, 'chef');
        lockUser('chef');
        $this->anmelden($token);
        $this->assertSame(401, $this->request('GET', '/api/session')->statusCode);
    }

    public function testWahlvorstandErfasstNurSeinWahllokalUndHatKeinControlCenter(): void
    {
        $lokal518 = $this->wahllokal('518', 'Schule');
        $lokal519 = $this->wahllokal('519', 'Rathaus');
        $fremd = $this->zettel();
        receiveStapel($this->admin, $this->stapel($lokal519, [$fremd]));
        [$vorstand, $token] = $this->konto('wahlvorstand', '518');
        $this->anmelden($token);

        $leer = ['zettel' => 0, 'prueffaelle' => 0, 'stapel' => 0, 'letzterEingang' => null];
        $this->assertSame([$lokal518 + $leer], $this->request('GET', '/api/wahllokale')->payload['wahllokale']);
        $this->assertSame(403, $this->request('POST', '/api/wahllokale', ['nummer' => '520', 'name' => 'Neu', 'erwartet' => 5])->statusCode);
        $other = $this->request('POST', '/api/stapel', $this->stapel($lokal519, [$this->zettel()]));
        $this->assertSame([403, 'Dieses Konto darf nur für Wahllokal 518 erfassen.'], [$other->statusCode, $other->payload['error']]);
        $own = $this->stapel($lokal518, [$this->zettel(), $this->zettel('leer')]);
        $this->assertSame(200, $this->request('POST', '/api/stapel', $own)->statusCode);
        $this->assertSame([['erfasst_von' => $vorstand['id']]], $this->sql('SELECT erfasst_von FROM stapel WHERE id = ?', [$own['id']]));

        // Fortschritt fuer den Erfassungsplatz: nur das eigene Wahllokal, ohne Stimmen.
        [$fortschritt] = $this->request('GET', '/api/wahllokale')->payload['wahllokale'];
        $this->assertSame(['518', 2, 1, 1], [$fortschritt['nummer'], $fortschritt['zettel'], $fortschritt['prueffaelle'], $fortschritt['stapel']]);
        $this->assertArrayNotHasKey('stimmen', $fortschritt);
        $this->assertSame(403, $this->request('GET', '/api/ergebnisse')->statusCode);
        $this->assertSame(403, $this->request('GET', '/api/prueffaelle')->statusCode);
        $this->assertSame(403, $this->request('GET', '/api/stapel/' . rawurlencode($own['id']))->statusCode);
        $this->assertSame(403, $this->request('GET', "/api/stimmzettel/{$fremd['id']}/bild")->statusCode);
        $this->assertSame(403, $this->request('GET', "/api/stimmzettel/{$own['zettel'][0]['id']}/bild")->statusCode);

        $this->anmelden($this->adminToken);
        $this->assertSame(3, $this->request('GET', '/api/ergebnisse')->payload['gesamt']['zettel']);
        $this->assertSame(200, $this->request('GET', "/api/stimmzettel/{$fremd['id']}/bild")->statusCode);
    }
}
