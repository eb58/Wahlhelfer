<?php
declare(strict_types=1);

/** Die Schnittstelle gegen eine echte MariaDB, Anfrage fuer Anfrage wie vom Browser. */
final class ApiTest extends DatabaseTestCase
{
    public function testLeereDatenbankWirdBeimErstenZugriffEingerichtet(): void
    {
        execute('SET FOREIGN_KEY_CHECKS = 0');
        foreach ($this->sql('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()') as $row) execute("DROP TABLE `{$row['TABLE_NAME']}`");
        execute('SET FOREIGN_KEY_CHECKS = 1');
        // Ohne Konto gibt es keine Sitzung - die Tabellen legt die API trotzdem vorher an.
        $this->assertSame(401, $this->request('GET', '/api/wahllokale')->statusCode);
        $tables = array_column($this->sql('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'), 'TABLE_NAME');
        sort($tables);
        $this->assertSame(['app_login_attempt', 'app_session', 'app_user', 'stapel', 'stimmzettel', 'wahllokal', 'wahlvorschlag'], $tables);
        $this->assertSame(8, $this->sql('SELECT nummer FROM wahlvorschlag WHERE id = ?', ['E6'])[0]['nummer']);
        $this->assertSame([['COLUMN_NAME' => 'nummer']], $this->sql("SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'wahllokal' AND CONSTRAINT_NAME = 'PRIMARY'"));
    }

    public function testStapelVerweisenAufDieWahllokalnummer(): void
    {
        $lokal = $this->wahllokal('518', 'Testwahllokal');
        $this->assertSame(['nummer' => '518', 'name' => 'Testwahllokal', 'erwartet' => 20], $lokal);
        $data = $this->stapel($lokal, [$this->zettel()]);
        receiveStapel($this->admin, $data);
        $this->assertSame('518', $this->sql('SELECT wahllokal FROM stapel WHERE id = ?', [$data['id']])[0]['wahllokal']);
        $this->assertSame(1, uebersicht($this->admin)['wahllokale'][0]['zettel']);
    }

    public function testZugangHerkunftUndUnbekannteRouten(): void
    {
        unset($_SERVER['HTTP_AUTHORIZATION']);
        $this->assertSame(401, $this->request('GET', '/api/ergebnisse')->statusCode);
        $_SERVER['HTTP_X_AUTH_TOKEN'] = $this->adminToken;
        $this->assertSame(200, $this->request('GET', '/api/ergebnisse')->statusCode);
        $_SERVER['HTTP_ORIGIN'] = 'https://fremd.invalid';
        $this->assertSame(403, $this->request('POST', '/api/wahllokale', ['nummer' => '1', 'name' => 'x', 'erwartet' => 1])->statusCode);
        unset($_SERVER['HTTP_ORIGIN']);
        $this->assertSame(415, $this->request('POST', '/api/wahllokale', 'nummer=1', 'application/x-www-form-urlencoded')->statusCode);
        $this->assertSame(404, $this->request('GET', '/api/gibtesnicht')->statusCode);
        $this->assertSame(['status' => 'ok', 'tokenReceived' => true], $this->request('GET', '/health')->payload);
    }

    public function testSummenJeStapelWahllokalUndInsgesamt(): void
    {
        $lokal = $this->wahllokal();
        $this->wahllokal('002', 'Rathaus');
        $response = $this->request('POST', '/api/stapel', $this->stapel($lokal, [$this->zettel(), $this->zettel('leer'), $this->zettel('zweifelsfall')]));
        $this->assertSame(200, $response->statusCode);
        $this->assertFalse($response->payload['bereitsGespeichert']);
        $result = $this->request('GET', '/api/ergebnisse')->payload;
        $this->assertSame(3, $result['gesamt']['zettel']);
        $this->assertSame(2, $result['gesamt']['prueffaelle']);
        $this->assertSame(1, $result['gesamt']['stimmen'][0]['wahlvorschlaege'][0]['anzahl']);
        $this->assertSame(1, $result['gesamt']['stimmen'][0]['leer']);
        $this->assertCount(1, $result['wahllokale'][0]['stapel']);
        $this->assertSame(0, $result['wahllokale'][1]['zettel']);
    }

    public function testStapelUndPrueffaelleWerdenEinzelnGeladen(): void
    {
        $stapel = $this->stapel($this->wahllokal(), [$this->zettel(), $this->zettel('leer'), $this->zettel('zweifelsfall')]);
        $this->request('POST', '/api/stapel', $stapel);
        $uebersicht = $this->request('GET', '/api/ergebnisse')->payload['wahllokale'][0]['stapel'][0];
        $this->assertSame([3, 2, 'admin'], [$uebersicht['zettel'], $uebersicht['prueffaelle'], $uebersicht['erfasstVon']]);
        $this->assertArrayNotHasKey('belege', $uebersicht);

        $detail = $this->request('GET', '/api/stapel/' . rawurlencode($stapel['id']))->payload;
        $this->assertSame([$stapel['id'], '001', 3, 2], [$detail['id'], $detail['wahllokal'], $detail['zettel'], $detail['prueffaelle']]);
        $this->assertCount(3, $detail['belege']);
        $this->assertSame(404, $this->request('GET', '/api/stapel/unbekannt')->statusCode);

        $prueffaelle = $this->request('GET', '/api/prueffaelle')->payload['prueffaelle'];
        $this->assertCount(2, $prueffaelle);
        $this->assertSame(['001', $stapel['id']], [$prueffaelle[0]['wahllokal'], $prueffaelle[0]['stapel']]);
    }

    public function testWiederholungZaehltEinmalUndGeaenderteWiederholungWirdAbgelehnt(): void
    {
        $data = $this->stapel($this->wahllokal(), [$this->zettel()]);
        $this->request('POST', '/api/stapel', $data);
        $repeat = $this->request('POST', '/api/stapel', ['felder' => [['fuellgrad' => 0.25]]] + $data);
        $this->assertTrue($repeat->payload['bereitsGespeichert']);
        $data['zettel'][0]['stimmen'][0]['wahlvorschlaege'] = [kalibrierung()['stimmen'][0]['felder'][1]['id']];
        $this->assertSame(409, $this->request('POST', '/api/stapel', $data)->statusCode);
        $this->assertSame(1, uebersicht($this->admin)['gesamt']['stimmen'][0]['wahlvorschlaege'][0]['anzahl']);
        $this->assertCount(1, $this->sql('SELECT * FROM stimmzettel'));
    }

    public function testUnvollstaendigeStapelUndUnbekannteWahllokaleWerdenZurueckgewiesen(): void
    {
        $data = $this->stapel($this->wahllokal(), [$this->zettel()]);
        $this->assertApiError(400, '/vollständig/', fn() => receiveStapel($this->admin, ['soll' => 20] + $data));
        $this->assertApiError(404, '/registriert/', fn() => receiveStapel($this->admin, ['wahllokal' => 'fremd'] + $data));
        $this->assertApiError(409, '/Wahlvorschläge/', fn() => receiveStapel($this->admin, ['wahlHash' => 'fremd'] + $data));
        $this->assertSame(0, uebersicht($this->admin)['gesamt']['zettel']);
    }

    public function testDoppelteAufnahmenUndKennungenRollenDenGanzenStapelZurueck(): void
    {
        $lokal = $this->wahllokal();
        $first = ['kennung' => 'qr-test-1'] + $this->zettel();
        receiveStapel($this->admin, $this->stapel($lokal, [$first]));
        $this->assertApiError(409, '/anderen Stapel/', fn() => receiveStapel($this->admin, $this->stapel($lokal, [$this->zettel(), $first])));
        $this->assertApiError(409, '/anderen Stapel/', fn() => receiveStapel($this->admin, $this->stapel($lokal, [$this->zettel(), ['kennung' => 'qr-test-1'] + $this->zettel()])));
        $this->assertSame(1, uebersicht($this->admin)['gesamt']['zettel']);
        $this->assertCount(1, $this->sql('SELECT * FROM stapel'));
    }

    public function testFremdeWahlvorschlaegeInDerDatenbankWerdenAbgelehnt(): void
    {
        receiveStapel($this->admin, $this->stapel($this->wahllokal(), [$this->zettel()]));
        $changed = kalibrierung();
        $changed['stimmen'][0]['felder'][0]['x'] += 10;
        wahl($changed);
        ensureWahl();
        $this->assertSame(1, uebersicht($this->admin)['gesamt']['zettel']);
        $changed['stimmen'][0]['felder'][0]['beschriftung'] = 'Anderer Kandidat';
        wahl($changed);
        $this->assertApiError(409, '/andere Wahlvorschläge/', static fn() => ensureWahl());
    }

    public function testWahllokalnummernSindEindeutigUndNamenBleibenUtf8(): void
    {
        $saved = $this->wahllokal('002', 'Bürgerhaus – Grüße');
        $this->assertApiError(409, '/bereits registriert/', fn() => $this->wahllokal('002', 'Doppeltes Wahllokal'));
        $this->assertSame([$saved + ['zettel' => 0, 'prueffaelle' => 0, 'stapel' => 0, 'letzterEingang' => null]], listWahllokale($this->admin));
        $this->assertApiError(400, '/Stimmzettelzahl/', fn() => meldeStimmzettelzahl($this->admin, '002', '20'));
    }

    public function testErgebnisWirdAlsFachlichesJsonOhneTechnischeAngabenGespeichert(): void
    {
        $row = ['felder' => [['id' => 'E1', 'fuellgrad' => 0.12, 'x' => 15]]] + $this->zettel('zweifelsfall');
        receiveStapel($this->admin, $this->stapel($this->wahllokal(), [$row]));
        $saved = json_decode($this->sql('SELECT ergebnis FROM stimmzettel WHERE id = ?', [$row['id']])[0]['ergebnis'], true);
        $this->assertEquals([
            'erststimme' => ['status' => 'zweifelsfall', 'wahlvorschlaege' => []],
            'zweitstimme' => ['status' => 'zweifelsfall', 'wahlvorschlaege' => []],
        ], $saved);
        $columns = array_column($this->sql('SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()'), 'COLUMN_NAME');
        $this->assertSame([], array_intersect($columns, ['x', 'y', 'radius', 'fuellgrad', 'kalibrierung', 'felder']));
    }

    public function testWahlMitNurEinerStimme(): void
    {
        $typ = kalibrierung('bvv-reinickendorf-2026');
        wahl($typ);
        receiveStapel($this->admin, $this->stapel($this->wahllokal(), [$this->zettel('gueltig', $typ)]));
        $result = uebersicht($this->admin)['gesamt'];
        $this->assertCount(1, $result['stimmen']);
        $this->assertSame('stimme', $result['stimmen'][0]['id']);
        $this->assertSame(1, $result['stimmen'][0]['wahlvorschlaege'][0]['anzahl']);
        $this->assertCount(count($typ['stimmen'][0]['felder']), $this->sql('SELECT * FROM wahlvorschlag'));
    }

    public function testZweiAusZweiIstGueltigEinsAusZweiLeer(): void
    {
        $typ = kalibrierung();
        $typ['stimmen'] = [['id' => 'stimme', 'auswahl' => 2] + $typ['stimmen'][0]];
        wahl($typ);
        $lokal = $this->wahllokal();
        $partial = $this->zettel('gueltig', $typ);
        $this->assertApiError(400, '/widersprechen/', fn() => receiveStapel($this->admin, $this->stapel($lokal, [$partial])));
        $partial['stimmen'][0]['status'] = 'leer';
        $full = $this->zettel('gueltig', $typ);
        $full['stimmen'][0]['wahlvorschlaege'][] = $typ['stimmen'][0]['felder'][1]['id'];
        receiveStapel($this->admin, $this->stapel($lokal, [$partial, $full]));
        $result = uebersicht($this->admin)['gesamt']['stimmen'][0];
        $this->assertSame([1, 1, 1, 1], [$result['gueltig'], $result['leer'], $result['wahlvorschlaege'][0]['anzahl'], $result['wahlvorschlaege'][1]['anzahl']]);
    }

    public function testAeltereBinBelegeBleibenLesbarUndWerdenUmbenannt(): void
    {
        $png = base64_decode(TEST_PNG);
        $hash = hash('sha256', $png);
        $pdf = '%PDF-1.7 aelterer Beleg';
        mkdir($this->bilderPath);
        file_put_contents("$this->bilderPath/$hash.bin", $png);
        file_put_contents($this->bilderPath . '/' . hash('sha256', $pdf) . '.bin', $pdf);
        $this->assertSame('image/png', storedBildType($hash), 'vor dem Umbenennen ueber .bin gefunden');
        $this->assertSame(200, $this->request('PUT', "/api/bilder/$hash", $png, 'image/png')->statusCode, 'nicht doppelt gespeichert');

        $this->assertSame(['umbenannt' => 1, 'unbekannt' => [hash('sha256', $pdf) . '.bin']], renameBinBelege());
        $this->assertFileExists("$this->bilderPath/$hash.png");
        $this->assertFileDoesNotExist("$this->bilderPath/$hash.bin");
        $this->assertSame("$this->bilderPath/$hash.png", findBild($hash));
        $this->assertSame(['umbenannt' => 0, 'unbekannt' => [hash('sha256', $pdf) . '.bin']], renameBinBelege(), 'ein zweiter Lauf aendert nichts');
    }

    public function testBelegeWerdenGeprueftGespeichertUndNurMitZugangAusgeliefert(): void
    {
        $png = base64_decode(TEST_PNG);
        $hash = hash('sha256', $png);
        $this->assertSame(400, $this->request('PUT', '/api/bilder/' . hash('sha256', 'anders'), $png, 'image/png')->statusCode);
        $this->assertSame(400, $this->request('PUT', "/api/bilder/$hash", $png, 'image/jpeg')->statusCode);
        $this->assertSame(400, $this->request('PUT', '/api/bilder/' . hash('sha256', '<svg/>'), '<svg/>', 'image/svg+xml')->statusCode);
        $this->assertSame(201, $this->request('PUT', "/api/bilder/$hash", $png, 'image/png')->statusCode);
        $this->assertSame(200, $this->request('PUT', "/api/bilder/$hash", $png, 'image/png')->statusCode);
        $this->assertSame("Require all denied\n", file_get_contents($this->bilderPath . '/.htaccess'));
        $this->assertSame([], glob($this->bilderPath . '/*.tmp'));
        $this->assertFileExists("$this->bilderPath/$hash.png", 'Endung nach erkanntem Bildtyp');

        $lokal = $this->wahllokal();
        $missing = ['bild' => ['hash' => str_repeat('b', 64), 'type' => 'image/png']] + $this->zettel();
        $this->assertApiError(409, '/fehlt auf dem Server/', fn() => receiveStapel($this->admin, $this->stapel($lokal, [$missing])));
        $row = $this->zettel();
        receiveStapel($this->admin, $this->stapel($lokal, [$row]));
        $response = $this->request('GET', "/api/stimmzettel/{$row['id']}/bild");
        $this->assertSame([200, $png, 'image/png'], [$response->statusCode, $response->rawBody, $response->headers['Content-Type']]);
        unset($_SERVER['HTTP_AUTHORIZATION']);
        $this->assertSame(401, $this->request('GET', "/api/stimmzettel/{$row['id']}/bild")->statusCode);
    }
}
