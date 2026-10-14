<?php
declare(strict_types=1);

// Als php-api/config.local.php beim Hoster ablegen. Nicht einchecken.
return [
    'db' => [
        'host' => 'mysql.example.com',
        'port' => 3306,
        'name' => 'wahlassistent',
        'user' => 'db_user',
        'password' => 'db_passwort',
    ],
    // Am besten ausserhalb des Webroots; der Ordner muss fuer PHP beschreibbar sein.
    // 'bilder_path' => '/home/user/wahlassistent-bilder',
];
