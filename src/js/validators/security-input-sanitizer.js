/**
 * Funciones de sanitización de entradas, prevención de inyección XSS/NoSQL
 * y resaltado seguro de coincidencias de búsqueda.
 */

export function sanitizeTextString(rawInput) {
  if (rawInput === null || rawInput === undefined) {
    return "";
  }
  return String(rawInput)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function highlightSearchMatchSafe(rawText, searchTerm) {
  const safeText = sanitizeTextString(rawText);
  const cleanSearch = String(searchTerm || "").trim();
  if (!cleanSearch) {
    return safeText;
  }
  const escapedSearch = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedSearch})`, "gi");
  return safeText.replace(regex, '<mark class="search-highlight">$1</mark>');
}
