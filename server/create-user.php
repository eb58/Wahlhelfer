<?php
declare(strict_types=1);

// Konten anlegen, zuruecksetzen oder sperren. Nur auf der Kommandozeile, z. B. beim Hoster per SSH:
//   php create-user.php <name> <passwort> admin
//   php create-user.php <name> <passwort> wahlvorstand <wahllokal>
//   php create-user.php <name> --sperren
// Das Passwort gilt nur fuer die erste Anmeldung; danach muss es geaendert werden.

require __DIR__ . '/lib.php';

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Nur auf der Kommandozeile erlaubt.\n");
    exit(1);
}

[, $username, $password, $role, $wahllokal] = array_pad($argv, 5, null);
try {
    ensureWahl();
    if ($username !== null && $password === '--sperren') {
        lockUser($username);
        echo "Konto $username ist gesperrt.\n";
        exit(0);
    }
    if ($username === null || $password === null || $role === null) {
        fwrite(STDERR, "Aufruf: php create-user.php <name> <passwort> admin|wahlvorstand [wahllokal]\n       php create-user.php <name> --sperren\n");
        exit(1);
    }
    saveUser($username, $password, $role, $wahllokal);
    echo "Konto $username ($role" . ($wahllokal !== null && $role === 'wahlvorstand' ? ", Wahllokal $wahllokal" : '') . ") angelegt bzw. zurückgesetzt. Passwort beim ersten Login ändern.\n";
} catch (ApiError $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
