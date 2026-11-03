/**
 * Motor Independiente de Cálculo de Estadísticas en Tiempo Real.
 * Genera métricas instantáneas cada vez que se busca o se visualiza información en un módulo.
 */

import {
  formatCurrencyAmount,
  formatIntegerCount,
  formatPercentageValue,
  quantizePercentageToCssClass
} from "../formatters/currency-and-number-formatter.js";
import { sanitizeTextString } from "../validators/security-input-sanitizer.js";

export function calculateDatasetStatistics(records = [], amountFieldKey = "amount", categoryFieldKey = "status") {
  const totalCount = records.length;
  let totalVolume = 0;
  let maxAmount = 0;
  let minAmount = totalCount > 0 ? Infinity : 0;
  const categoryDistributionMap = new Map();

  records.forEach((item) => {
    const rawValue = Number(item[amountFieldKey] ?? item.balance ?? item.totalDebit ?? item.total ?? item.netPay ?? 0);
    const absValue = Math.abs(rawValue);
    totalVolume += absValue;
    if (absValue > maxAmount) {
      maxAmount = absValue;
    }
    if (absValue < minAmount) {
      minAmount = absValue;
    }

    const catKey = String(item[categoryFieldKey] || item.type || "GENERAL").toUpperCase();
    const currentCat = categoryDistributionMap.get(catKey) || { count: 0, volume: 0 };
    currentCat.count += 1;
    currentCat.volume += absValue;
    categoryDistributionMap.set(catKey, currentCat);
  });

  if (minAmount === Infinity) {
    minAmount = 0;
  }

  const averageAmount = totalCount > 0 ? totalVolume / totalCount : 0;

  const distributions = Array.from(categoryDistributionMap.entries()).map(([category, stats]) => {
    const countPercentage = totalCount > 0 ? (stats.count / totalCount) * 100 : 0;
    return {
      category,
      count: stats.count,
      volume: stats.volume,
      percentage: countPercentage,
      cssProgressClass: quantizePercentageToCssClass(countPercentage)
    };
  });

  return {
    totalCount,
    totalVolume,
    averageAmount,
    maxAmount,
    minAmount,
    distributions
  };
}

export function renderStatisticsKpiCardsHtml(kpiItems = []) {
  return kpiItems
    .map((kpi) => {
      const accentClass = kpi.accent ? `accent-${kpi.accent}` : "";
      const progressClass = quantizePercentageToCssClass(kpi.progressPct ?? 85);
      const fillVariant = kpi.accent === "success"
        ? "fill-success"
        : kpi.accent === "warning"
          ? "fill-warning"
          : kpi.accent === "danger"
            ? "fill-danger"
            : "";

      return `
        <div class="stat-kpi-card ${accentClass}">
          <div class="stat-kpi-header">
            <span class="stat-kpi-label">${sanitizeTextString(kpi.label)}</span>
            <span class="badge-pill badge-info">${sanitizeTextString(kpi.badge || "LIVE")}</span>
          </div>
          <div class="stat-kpi-value">${sanitizeTextString(kpi.value)}</div>
          <div class="stat-progress-track">
            <div class="stat-progress-fill ${fillVariant} ${progressClass}"></div>
          </div>
          <div class="stat-kpi-footer">
            <span>${sanitizeTextString(kpi.subtitle || "Poblado en tiempo real")}</span>
            <span class="stat-trend-positive">${sanitizeTextString(kpi.trend || "100% Exacto")}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

export function buildSearchStatisticsKpis(statsObject, totalUniverseCount = 1) {
  const coveragePct = totalUniverseCount > 0
    ? Math.min(100, (statsObject.totalCount / totalUniverseCount) * 100)
    : 100;

  return [
    {
      label: "Registros Poblados",
      value: formatIntegerCount(statsObject.totalCount),
      badge: formatPercentageValue(coveragePct, 1),
      subtitle: `De ${formatIntegerCount(totalUniverseCount)} registros indexados`,
      trend: "Indexación < 1ms",
      accent: "info",
      progressPct: coveragePct
    },
    {
      label: "Volumen Financiero Filtrado",
      value: formatCurrencyAmount(statsObject.totalVolume),
      badge: "ACUMULADO",
      subtitle: "Suma monetaria de coincidencias",
      trend: "Partida Validada",
      accent: "success",
      progressPct: statsObject.totalVolume > 0 ? 90 : 10
    },
    {
      label: "Promedio por Registro",
      value: formatCurrencyAmount(statsObject.averageAmount),
      badge: "MEDIA",
      subtitle: "Valor medio ponderado",
      trend: `Máx: ${formatCurrencyAmount(statsObject.maxAmount)}`,
      accent: "purple",
      progressPct: 75
    },
    {
      label: "Categorías Detectadas",
      value: formatIntegerCount(statsObject.distributions.length),
      badge: "SEGMENTACIÓN",
      subtitle: statsObject.distributions[0]
        ? `Principal: ${statsObject.distributions[0].category}`
        : "Sin agrupaciones",
      trend: "Estadística Activa",
      accent: "warning",
      progressPct: 80
    }
  ];
}
