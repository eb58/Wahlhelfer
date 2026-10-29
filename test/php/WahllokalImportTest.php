<?php
declare(strict_types=1);

require_once __DIR__ . '/../../server/wahllokalImport.php';

final class WahllokalImportTest extends DatabaseTestCase
{
    public function testReinickendorfImportIstVollstaendigUndWiederholbar(): void
    {
        $gebiet = json_decode(file_get_contents(__DIR__ . '/../../Wahlen/bvv-reinickendorf-2026/gebiet.json'), true, 512, JSON_THROW_ON_ERROR);
        $rows = getGebietWahllokale($gebiet);
        $this->assertCount(311, $rows);
        $this->assertCount(177, array_filter($rows, static fn(array $row): bool => ctype_digit($row['nummer'])));
        $this->assertSame(['12101', '12102'], array_column(array_slice($rows, 0, 2), 'nummer'));
        $this->assertSame('121A', $rows[29]['nummer'], 'nach den Urnen- die Briefwahlbezirke des Wahlkreises');
        $this->assertSame(['angelegt' => 311, 'vorhanden' => 0], importWahllokale($rows));
        $this->assertSame(['angelegt' => 0, 'vorhanden' => 311], importWahllokale($rows));
        $this->assertSame(311, (int) query('SELECT COUNT(*) AS n FROM wahllokal WHERE erwartet IS NULL')[0]['n']);
        $this->assertSame('Kolumbus-Grundschule, Haus F, Mensa R. 01', query("SELECT name FROM wahllokal WHERE nummer = '12101'")[0]['name']);
    }

    public function testKonfliktRolltDenGesamtenImportZurueck(): void
    {
        registerWahllokal(['nummer' => '12102', 'name' => 'Bestehender Name']);
        meldeStimmzettelzahl($this->admin, '12102', 700);
        try {
            importWahllokale([['nummer' => '12101', 'name' => 'Neu'], ['nummer' => '12102', 'name' => 'Anderer Name']]);
            $this->fail('Namenskonflikt muss abbrechen.');
        } catch (ApiError $error) {
            $this->assertStringContainsString('anderen Namen', $error->getMessage());
        }
        $this->assertSame([], query("SELECT nummer FROM wahllokal WHERE nummer = '12101'"));
        $this->assertSame(700, (int) query("SELECT erwartet FROM wahllokal WHERE nummer = '12102'")[0]['erwartet']);
    }

    public function testDoppelteNummernWerdenAbgelehnt(): void
    {
        $this->expectException(ApiError::class);
        importWahllokale([['nummer' => '12101', 'name' => 'A'], ['nummer' => '12101', 'name' => 'B']]);
    }

    public function testImportErhaeltBestehendeMeldung(): void
    {
        $rows = [['nummer' => '12101', 'name' => 'A']];
        importWahllokale($rows);
        meldeStimmzettelzahl($this->admin, '12101', 423);
        importWahllokale($rows);
        $this->assertSame(423, (int) query("SELECT erwartet FROM wahllokal WHERE nummer = '12101'")[0]['erwartet']);
    }
}
