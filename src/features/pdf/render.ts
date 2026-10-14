import type { DocumentMeta, PdfContent } from "./documents";

export type { DocumentMeta, PdfContent } from "./documents";

/**
 * Produit un PDF. @react-pdf/renderer, ses polices embarquées et son moteur
 * de mise en page ne sont chargés qu'à la première demande (import
 * dynamique) : ils restent hors du bundle principal.
 */
export async function renderPdf(content: PdfContent, meta: DocumentMeta): Promise<Uint8Array> {
  const { renderPdfBytes } = await import("./documents");
  return renderPdfBytes(content, meta);
}

/** Nombre de pages d'un PDF produit par l'application (objets `/Type /Page`). */
export function countPdfPages(bytes: Uint8Array): number {
  let text = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    text += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return text.match(/\/Type\s*\/Page(?![A-Za-z])/g)?.length ?? 0;
}
