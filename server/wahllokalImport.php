<?php
declare(strict_types=1);

/** Atomarer Import. Bestehende Meldungen bleiben unveraendert. */
function importWahllokale(array $rows): array
{
    if (!$rows || !array_is_list($rows)) throw new ApiError('Wahllokalliste fehlt.');
    $nummern = [];
    foreach ($rows as $row) {
        $nummer = text($row['nummer'] ?? null, 'Wahllokalnummer');
        text($row['name'] ?? null, 'Name');
        if (isset($nummern[$nummer])) throw new ApiError('Doppelte Wahllokalnummer im Import.');
        $nummern[$nummer] = true;
    }
    return transaction(static function () use ($rows): array {
        $angelegt = 0;
        $vorhanden = 0;
        foreach ($rows as $row) {
            $nummer = trim($row['nummer']);
            $existing = query('SELECT name FROM wahllokal WHERE nummer = ?', [$nummer]);
            if ($existing) {
                if ($existing[0]['name'] !== trim($row['name'])) throw new ApiError("Wahllokal $nummer hat bereits einen anderen Namen.");
                $vorhanden++;
                continue;
            }
            registerWahllokal(['nummer' => $nummer, 'name' => $row['name']]);
            $angelegt++;
        }
        return ['angelegt' => $angelegt, 'vorhanden' => $vorhanden];
    }, true);
}
