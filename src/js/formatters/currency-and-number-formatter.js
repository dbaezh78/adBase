/**
 * Funciones puras e independientes de formateo numérico, monetario, porcentual
 * y cuantización de barras de progreso mediante clases CSS (cero estilos en línea).
 */

const currencyFormatterInstance = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const integerFormatterInstance = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0
});

const decimalFormatterInstance = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatCurrencyAmount(amount) {
  const numericValue = Number(amount) || 0;
  return currencyFormatterInstance.format(numericValue);
}

export function formatDecimalNumber(value) {
  const numericValue = Number(value) || 0;
  return decimalFormatterInstance.format(numericValue);
}

export function formatIntegerCount(value) {
  const numericValue = Number(value) || 0;
  return integerFormatterInstance.format(numericValue);
}

export function formatPercentageValue(value, decimals = 1) {
  const numericValue = Number(value) || 0;
  return `${numericValue.toFixed(decimals)}%`;
}

/**
 * Convierte un porcentaje (0-100) en una clase CSS predefinida (.pct-0 a .pct-100)
 * para mantener la regla estricta de cero CSS en HTML.
 */
export function quantizePercentageToCssClass(percentage) {
  const clamped = Math.max(0, Math.min(100, Number(percentage) || 0));
  const stepOfFive = Math.round(clamped / 5) * 5;
  return `pct-${stepOfFive}`;
}
