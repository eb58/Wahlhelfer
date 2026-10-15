-- Bestehende Tabellen: gemeldete Stimmzettelzahl ist bis zur Meldung unbekannt.
ALTER TABLE wahllokal MODIFY erwartet INTEGER NULL DEFAULT NULL;
