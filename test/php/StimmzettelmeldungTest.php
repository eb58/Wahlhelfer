<?php
declare(strict_types=1);

final class StimmzettelmeldungTest extends DatabaseTestCase
{
    public function testMigrationErlaubtOffeneMeldungenUndErhaeltVorhandene(): void
    {
        $this->wahllokal('001', 'Schule');
        execute('ALTER TABLE wahllokal MODIFY erwartet INTEGER NOT NULL');
        $sql = file_get_contents(__DIR__ . '/../../server/migration-stimmzettelmeldung.sql');
        db()->exec($sql);
        db()->exec($sql);
        $this->assertNull(registerWahllokal(['nummer' => '002', 'name' => 'Rathaus'])['erwartet']);
        $this->assertSame(20, (int) query("SELECT erwartet FROM wahllokal WHERE nummer = '001'")[0]['erwartet']);
    }

    public function testRegistrierungLaesstAnzahlOffenUndVorstandMeldetAnControlCenter(): void
    {
        $lokal = registerWahllokal(['nummer' => '12101', 'name' => 'Schule', 'erwartet' => 500]);
        $this->assertNull($lokal['erwartet']);
        $this->assertNull(uebersicht($this->admin)['wahllokale'][0]['erwartet']);
        [, $token] = $this->konto('wahlvorstand', '12101');
        $this->anmelden($token);
        $this->assertSame(200, $this->request('PUT', '/api/wahllokale/12101/stimmzettelzahl', ['erwartet' => 423])->statusCode);
        $this->assertSame(423, uebersicht($this->admin)['wahllokale'][0]['erwartet']);
        $this->assertSame(403, $this->request('PUT', '/api/wahllokale/12102/stimmzettelzahl', ['erwartet' => 423])->statusCode);
        foreach ([null, '423', 0, -1, 100001] as $value)
            $this->assertSame(400, $this->request('PUT', '/api/wahllokale/12101/stimmzettelzahl', ['erwartet' => $value])->statusCode);
    }

    public function testOhneMeldungKeinStapelUndNachBeginnKeineAenderung(): void
    {
        $lokal = registerWahllokal(['nummer' => '12101', 'name' => 'Schule']);
        $stapel = $this->stapel($lokal, [$this->zettel()]);
        $this->assertApiError(409, '/Stimmzettelzahl melden/', fn() => receiveStapel($this->admin, $stapel));
        meldeStimmzettelzahl($this->admin, '12101', 423);
        receiveStapel($this->admin, $stapel);
        $this->assertSame(423, meldeStimmzettelzahl($this->admin, '12101', 423)['erwartet']);
        $this->assertApiError(409, '/bereits begonnen/', fn() => meldeStimmzettelzahl($this->admin, '12101', 424));
        $this->assertSame(423, (int) query("SELECT erwartet FROM wahllokal WHERE nummer = '12101'")[0]['erwartet']);
    }
}
