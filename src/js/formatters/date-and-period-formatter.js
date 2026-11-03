/**
 * Funciones independientes para el formateo de fechas contables, marcas de tiempo
 * de auditoría y periodos fiscales (YYYY-MM).
 */

export function formatIsoDateString(dateInput) {
  if (!dateInput) {
    return new Date().toISOString().slice(0, 10);
  }
  if (typeof dateInput === "string" && dateInput.length >= 10) {
    return dateInput.slice(0, 10);
  }
  const parsed = new Date(dateInput);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString().slice(0, 10)
    : parsed.toISOString().slice(0, 10);
}

export function formatAuditTimestamp(dateInput = new Date()) {
  const parsed = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return parsed.toISOString().replace("T", " ").slice(0, 19);
}

export function extractFiscalPeriodFromDate(dateString) {
  const normalized = formatIsoDateString(dateString);
  return normalized.slice(0, 7);
}
