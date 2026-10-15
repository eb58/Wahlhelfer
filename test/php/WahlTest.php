<?php
declare(strict_types=1);

use PHPUnit\Framework\Assert;
use PHPUnit\Framework\TestCase;

/** Reine Logik ohne Datenbank. */
final class WahlTest extends TestCase
{
    protected function setUp(): void
    {
        config(['bilder_path' => sys_get_temp_dir()]);
        unset($_SERVER['HTTP_ORIGIN'], $_SERVER['HTTP_X_AUTH_TOKEN'], $_SERVER['HTTP_AUTHORIZATION']);
    }

    public function testWahlHashEntsprichtDemBrowser(): void
    {
        // Dieselben Werte prueft test/wahl.test.js fuer getWahlDefinition() aus src/erfassungsplatz/wahl.js.
        $this->assertSame('ec7521371a58afa0d5c2224474793391bec2643aea9ecbe3f350a93bbc57e4c5', jsonHash(getWahlDefinition(kalibrierung())));
        $this->assertSame('e5a1e30c74deded4ddabea95ae317d42ed8d047352d877a35a0e54a608f72c77', jsonHash(getWahlDefinition(kalibrierung('europawahl-sh-2024'))));
    }

    public function testWahlDefinitionEnthaeltNurFachlicheAngaben(): void
    {
        $definition = getWahlDefinition(kalibrierung());
        $this->assertSame(['name', 'stimmen'], array_keys($definition));
        $this->assertSame(['id', 'name', 'auswahl', 'wahlvorschlaege'], array_keys($definition['stimmen'][0]));
        $this->assertSame(['id', 'nummer', 'beschriftung'], array_keys($definition['stimmen'][0]['wahlvorschlaege'][0]));
        $changed = kalibrierung();
        $changed['stimmen'][0]['felder'][0]['x'] += 10;
        $changed['radius'] += 1;
        $this->assertSame(jsonHash($definition), jsonHash(getWahlDefinition($changed)));
    }

    public function testKalibrierungKommtAusConfigurationJs(): void
    {
        preg_match("/KALIBRIERUNG\s*=\s*'\.\/([^']+)'/", (string) file_get_contents(__DIR__ . '/../../configuration.js'), $match);
        $this->assertSame(realpath(__DIR__ . '/../../' . $match[1]), realpath(kalibrierungPath()));
    }

    public function testStapelWirdOhneDatenbankGeprueft(): void
    {
        $wahl = getWahlDefinition(kalibrierung());
        $bild = ['hash' => str_repeat('a', 64), 'type' => 'image/png'];
        $zettel = static fn(array $wahlvorschlaege = ['E1']): array => ['id' => uuid(), 'bild' => $bild, 'felder' => [['fuellgrad' => 0.3]], 'stimmen' => [
            ['id' => 'zweitstimme', 'status' => 'gueltig', 'wahlvorschlaege' => ['Z1']],
            ['id' => 'erststimme', 'status' => count($wahlvorschlaege) === 1 ? 'gueltig' : 'mehrfach', 'wahlvorschlaege' => $wahlvorschlaege],
        ]];
        $stapel = static fn(array $rows): array => ['id' => 's', 'wahllokal' => 'w', 'wahlHash' => 'h', 'soll' => count($rows), 'zettel' => $rows];
        $data = normalizeStapel($stapel([$zettel(['E2', 'E1'])]), $wahl, 'h');
        $this->assertSame(['id' => 'erststimme', 'status' => 'mehrfach', 'wahlvorschlaege' => ['E1', 'E2']], $data['zettel'][0]['stimmen'][0]);
        $this->assertSame(['id', 'kennung', 'stimmen', 'bild'], array_keys($data['zettel'][0]));

        $fails = static function (array $value, string $pattern) use ($wahl): void {
            $response = capture(static fn() => normalizeStapel($value, $wahl, 'h'));
            Assert::assertMatchesRegularExpression($pattern, $response->payload['error']);
        };
        $fails(['soll' => 2] + $stapel([$zettel()]), '/vollständig/');
        $fails(['wahlHash' => 'fremd'] + $stapel([$zettel()]), '/Wahlvorschläge/');
        $fails($stapel([$zettel(['Z1'])]), '/Wahlvorschlag/');
        $fails($stapel([$zettel(['E1', 'E1'])]), '/doppelter/');
        $fails($stapel([['bild' => null] + $zettel()]), '/Originalaufnahme/');
        $wrong = $zettel();
        $wrong['stimmen'][0]['status'] = 'leer';
        $fails($stapel([$wrong]), '/widersprechen/');
        $twice = $zettel();
        $fails($stapel([$twice, $twice]), '/doppelte/');
    }

    public function testUebersichtSummiertJeStapelWahllokalUndInsgesamt(): void
    {
        $wahl = getWahlDefinition(kalibrierung());
        $ergebnis = static fn(string $status): string => json_encode(['erststimme' => ['status' => $status, 'wahlvorschlaege' => $status === 'gueltig' ? ['E1'] : []],
            'zweitstimme' => ['status' => 'gueltig', 'wahlvorschlaege' => ['Z1']]]);
        $result = buildUebersicht($wahl, 'h', [
            ['nummer' => '001', 'name' => 'Schule', 'erwartet' => 20],
            ['nummer' => '002', 'name' => 'Rathaus', 'erwartet' => 10],
        ], [['id' => 's1', 'wahllokal' => '001', 'eingang' => '2026-10-14T08:00:00.000Z', 'soll' => 2]], [
            ['id' => 'z1', 'stapel' => 's1', 'ergebnis' => $ergebnis('gueltig'), 'bildtyp' => 'image/png'],
            ['id' => 'z2', 'stapel' => 's1', 'ergebnis' => $ergebnis('zweifelsfall'), 'bildtyp' => 'image/png'],
        ]);
        $this->assertSame(2, $result['gesamt']['zettel']);
        $this->assertSame(1, $result['gesamt']['prueffaelle']);
        $this->assertSame(1, $result['gesamt']['stimmen'][0]['wahlvorschlaege'][0]['anzahl']);
        $this->assertSame(1, $result['gesamt']['stimmen'][0]['zweifelsfall']);
        $this->assertSame(2, $result['gesamt']['stimmen'][1]['wahlvorschlaege'][0]['anzahl']);
        $this->assertSame(['id' => 's1', 'eingang' => '2026-10-14T08:00:00.000Z', 'soll' => 2, 'erfasstVon' => null, 'zettel' => 2, 'prueffaelle' => 1],
            $result['wahllokale'][0]['stapel'][0], 'Je Stapel nur Zaehler, keine Belege');
        $this->assertSame(['id' => 'z2', 'bildtyp' => 'image/png', 'stimmen' => [
            ['id' => 'erststimme', 'status' => 'zweifelsfall', 'wahlvorschlaege' => []],
            ['id' => 'zweitstimme', 'status' => 'gueltig', 'wahlvorschlaege' => ['Z1']],
        ]], toBeleg(['id' => 'z2', 'ergebnis' => $ergebnis('zweifelsfall'), 'bildtyp' => 'image/png']));
        $this->assertSame(0, $result['wahllokale'][1]['zettel']);
        $this->assertSame([], $result['wahllokale'][1]['stapel']);
    }

    public function testBelegartenWerdenAmDateiinhaltErkannt(): void
    {
        $this->assertSame('image/png', detectBildType(base64_decode(TEST_PNG)));
        $this->assertSame('image/jpeg', detectBildType("\xff\xd8\xff\xe0"));
        $this->assertSame('image/webp', detectBildType('RIFF1234WEBPVP8 '));
        $this->assertSame('application/pdf', detectBildType('%PDF-1.7'));
        $this->assertNull(detectBildType('<svg>'));
        $this->assertApiError(400, '/Belegkennung/', static fn() => bildPath('../config.local'));
    }

    public function testHerkunftWirdGeprueft(): void
    {
        $_SERVER['HTTP_HOST'] = 'localhost:5173';
        $_SERVER['HTTP_ORIGIN'] = 'http://localhost:5173';
        requireSameOrigin();
        $_SERVER['HTTP_ORIGIN'] = 'https://fremd.invalid';
        $this->assertApiError(403, '/anderen Website/', static fn() => requireSameOrigin());
    }

    private function assertApiError(int $status, string $pattern, callable $call): void
    {
        $response = capture($call);
        $this->assertSame($status, $response->statusCode);
        $this->assertMatchesRegularExpression($pattern, $response->payload['error']);
    }
}
