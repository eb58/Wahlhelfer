-- Die API zerlegt diese Datei an Semikolons: keine Semikolons in Kommentaren oder Texten.

CREATE TABLE IF NOT EXISTS wahllokal (
  nummer VARCHAR(160) PRIMARY KEY, name VARCHAR(160) NOT NULL,
  erwartet INTEGER NULL DEFAULT NULL CHECK (erwartet BETWEEN 1 AND 100000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Admins sehen und verwalten alles, ein Wahlvorstand ist an genau ein Wahllokal gebunden.
CREATE TABLE IF NOT EXISTS app_user (
  id INTEGER AUTO_INCREMENT PRIMARY KEY, username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'wahlvorstand')),
  wahllokal VARCHAR(160) NULL,
  password_change_required TINYINT(1) NOT NULL DEFAULT 1, active TINYINT(1) NOT NULL DEFAULT 1,
  CHECK ((role = 'admin') = (wahllokal IS NULL)),
  FOREIGN KEY (wahllokal) REFERENCES wahllokal(nummer)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS app_session (
  token_hash CHAR(64) PRIMARY KEY, user_id INTEGER NOT NULL, expires_at DATETIME NOT NULL,
  INDEX (expires_at),
  FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS app_login_attempt (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(80) NOT NULL, ip VARCHAR(45) NOT NULL,
  attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (username), INDEX (ip), INDEX (attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS stapel (
  id VARCHAR(160) PRIMARY KEY, wahllokal VARCHAR(160) NOT NULL,
  soll INTEGER NOT NULL CHECK (soll BETWEEN 1 AND 100),
  eingang VARCHAR(24) NOT NULL, pruefsumme CHAR(64) NOT NULL,
  -- Wer den Stapel uebertragen hat, leer bei Stapeln aus der Zeit vor der Anmeldung.
  erfasst_von INTEGER NULL,
  FOREIGN KEY (wahllokal) REFERENCES wahllokal(nummer),
  FOREIGN KEY (erfasst_von) REFERENCES app_user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS wahlvorschlag (
  stimme VARCHAR(160) NOT NULL, id VARCHAR(160) NOT NULL,
  nummer INTEGER NOT NULL, beschriftung TEXT NOT NULL,
  PRIMARY KEY (stimme, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS stimmzettel (
  id VARCHAR(160) PRIMARY KEY, stapel VARCHAR(160) NOT NULL, kennung VARCHAR(160) UNIQUE,
  ergebnis JSON NOT NULL CHECK (JSON_TYPE(ergebnis) = 'OBJECT'),
  bildhash CHAR(64) NOT NULL, bildtyp VARCHAR(40) NOT NULL,
  FOREIGN KEY (stapel) REFERENCES stapel(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
