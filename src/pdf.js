/**
 * Musterstimmzettel als PDF: eine Seite in ImageData rendern.
 *
 * Nur fuer den Browser - im Node-Pfad fehlt eine Canvas-Implementierung. Aufnahmen
 * ausgefuellter Zettel sind ohnehin Bilder; PDF betrifft allein die Registrierung.
 *
 * Worker und WASM-Decoder kommen aus vendor/pdfjs, nicht aus dem Netz. Vite kopiert
 * die benoetigten Dateien beim Start und beim Build aus node_modules.
 */

/** PDF-Punkte sind 1/72 Zoll; 150 dpi ist ein guter Kompromiss aus Schaerfe und Rechenzeit. */
export const RENDER_DPI = 150;

const VENDOR = './vendor/pdfjs/';
const WASM = `${VENDOR}wasm/`;

const pdfjsModule = async () => {
  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `${VENDOR}pdf.worker.min.mjs`;
    return pdfjs;
  } catch (error) {
    throw new Error('PDF-Modul konnte nicht geladen werden.', { cause: error });
  }
};

export const istPdf = file => file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name ?? '');

/**
 * Rendert eine Seite und liefert ImageData wie `toImageData()`.
 * @param {Blob|File} file
 * @param {{seite?:number, dpi?:number}} optionen 1-basierte Seitennummer
 * @returns {Promise<{imageData:ImageData, seiten:number}>}
 */
export const pdfSeiteAlsBild = async (file, { seite = 1, dpi = RENDER_DPI } = {}) => {
  const pdfjs = await pdfjsModule();
  // Ohne wasmUrl scheitert das Decodieren eingebetteter Scans (JBIG2/JPX).
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), wasmUrl: WASM });
  const pdf = await task.promise;

  try {
    const page = await pdf.getPage(Math.min(seite, pdf.numPages));
    const viewport = page.getViewport({ scale: dpi / 72 });
    const canvas = Object.assign(document.createElement('canvas'), {
      width: Math.ceil(viewport.width),
      height: Math.ceil(viewport.height),
    });
    const context = canvas.getContext('2d', { willReadFrequently: true });
    // Papierweiss als Untergrund: PDF-Seiten sind transparent, sonst kaeme alles als Schwarz an.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;
    return { imageData: context.getImageData(0, 0, canvas.width, canvas.height), seiten: pdf.numPages };
  } finally {
    await task.destroy();
  }
};
