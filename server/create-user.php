<?php
declare(strict_types=1);

// Konten anlegen, zuruecksetzen oder sperren. Nur auf der Kommandozeile, z. B. beim Hoster per SSH
// (bei Strato als "php -q -d register_argc_argv=1 create-user.php ...", siehe README):
//   php create-user.php <name> <passwort> admin
//   php create-user.php <name> <passwort> wahlvorstand <wahllokal>
//   php create-user.php <name> --sperren
// Das Passwort gilt nur fuer die erste Anmeldung; danach muss es geaendert werden.

require __DIR__ . '/lib.php';

if (!isCommandLine()) {
    printError('Nur auf der Kommandozeile erlaubt.');
    exit(1);
}

[, $username, $password, $role, $wahllokal] = array_pad($_SERVER['argv'] ?? [], 5, null);
try {
    ensureWahl();
    if ($username !== null && $password === '--sperren') {
        lockUser($username);
        echo "Konto $username ist gesperrt.\n";
        exit(0);
    }
    if ($username === null || $password === null || $role === null) {
        printError("Aufruf: php create-user.php <name> <passwort> admin|wahlvorstand [wahllokal]\n       php create-user.php <name> --sperren");
        exit(1);
    }
    saveUser($username, $password, $role, $wahllokal);
    echo "Konto $username ($role" . ($wahllokal !== null && $role === 'wahlvorstand' ? ", Wahllokal $wahllokal" : '') . ") angelegt bzw. zurückgesetzt. Passwort beim ersten Login ändern.\n";
} catch (ApiError $error) {
    printError($error->getMessage());
    exit(1);
}
