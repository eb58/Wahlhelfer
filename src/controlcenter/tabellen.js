/** AG Grid fuer das ControlCenter: Module, Farben wie controlcenter.css und deutsche Texte (wie Mitgliederverwaltung). */
import { AllCommunityModule, ModuleRegistry, createGrid, themeQuartz } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  accentColor: '#2f7a52',
  borderColor: '#dde5df',
  browserColorScheme: 'light',
  fontFamily: 'Inter, ui-sans-serif, system-ui, "Segoe UI", sans-serif',
  headerBackgroundColor: '#eef4ef',
  headerTextColor: '#1f4d35',
  oddRowBackgroundColor: '#f8faf8',
  rowHoverColor: '#eaf3ec',
  selectedRowBackgroundColor: '#dcebdf',
  wrapperBorderRadius: 14,
});

const localeText = {
  page: 'Seite', pageSizeSelectorLabel: 'Seitengröße:', ariaPageSizeSelectorLabel: 'Seitengröße', more: 'mehr',
  to: 'bis', of: 'von', firstPage: 'Erste Seite', previousPage: 'Vorherige Seite', nextPage: 'Nächste Seite',
  lastPage: 'Letzte Seite', pageLastRowUnknown: '?', next: 'Weiter', last: 'Letzte', first: 'Erste', previous: 'Zurück',
  loadingOoo: 'Lade …', noRowsToShow: 'Keine Einträge', selectAll: 'Alle auswählen', searchOoo: 'Suchen …',
  blanks: 'Leer', notBlank: 'Nicht leer', filterOoo: 'Filtern …', equals: 'Gleich', notEqual: 'Ungleich',
  contains: 'Enthält', notContains: 'Enthält nicht', startsWith: 'Beginnt mit', endsWith: 'Endet mit',
  lessThan: 'Kleiner als', lessThanOrEqual: 'Kleiner oder gleich', greaterThan: 'Größer als',
  greaterThanOrEqual: 'Größer oder gleich', inRange: 'Im Bereich', andCondition: 'UND', orCondition: 'ODER',
  applyFilter: 'Anwenden', resetFilter: 'Zurücksetzen', clearFilter: 'Leeren', cancelFilter: 'Abbrechen',
  ariaFilterInput: 'Filtereingabe', ariaFilterMenuOpen: 'Filtermenü öffnen',
};

/** Gemeinsame Vorgaben; `getRowId` haelt Sortierung, Filter und Scrollstand bei jeder Aktualisierung. */
export const createTabelle = (element, options) => createGrid(element, {
  theme, localeText,
  defaultColDef: { sortable: true, resizable: true, filter: true, minWidth: 90 },
  animateRows: false,
  ...options,
});
