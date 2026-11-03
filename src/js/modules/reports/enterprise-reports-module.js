/**
 * MÓDULO INDEPENDIENTE 12: MUESTRA DE REPORTES Y ESTADÍSTICAS EJECUTIVAS (T-CODE: REP01)
 * Centro consolidado de Inteligencia de Negocios (BI), distribución estadística por módulo
 * y exportación de datos estructurados.
 */

import { getCollectionRecords } from "../../database/database-provider-adapter.js";
import { buildUnifiedSearchIndex } from "../../search/universal-search-engine.js";
import {
  calculateDatasetStatistics,
  renderStatisticsKpiCardsHtml
} from "../../statistics/real-time-statistics-calculator.js";
import {
  formatCurrencyAmount,
  formatPercentageValue
} from "../../formatters/currency-and-number-formatter.js";
import { sanitizeTextString, highlightSearchMatchSafe } from "../../validators/security-input-sanitizer.js";
import { dispatchEnterpriseToast } from "../../core/ui-notification-dispatcher.js";

export const EnterpriseReportsModule = {
  id: "reports",
  tCode: "REP01",
  name: "Muestra de Reportes",
  category: "INTEGRACIÓN Y BI",
  templatePath: "./src/html/modules/enterprise-reports-view.html",
  requiredPermission: "SYS_REPORTS_VIEW",
  exportedFunctions: [
    "generateConsolidatedExecutiveReport",
    "computeCrossModuleDistributionStats",
    "exportAccountingDatasetJson"
  ],

  async renderModuleWorkspace(containerEl, { searchQuery = "" } = {}) {
    let localSearch = searchQuery;

    const renderContent = () => {
      const fullIndex = buildUnifiedSearchIndex();
      const cleanSearch = String(localSearch || "").trim().toLowerCase();

      const filteredRecords = fullIndex.filter((item) =>
        !cleanSearch ||
        `${item.code} ${item.title} ${item.subtitle} ${item.moduleName} ${item.status}`.toLowerCase().includes(cleanSearch)
      );

      const stats = calculateDatasetStatistics(filteredRecords, "amount", "moduleName");

      const kpisHtml = renderStatisticsKpiCardsHtml([
        {
          label: "Registros Consolidados en Reporte",
          value: `${stats.totalCount} / ${fullIndex.length}`,
          badge: "MULTIMÓDULO",
          subtitle: "Poblados de los 12 módulos",
          trend: "Tiempo Real",
          accent: "info",
          progressPct: (stats.totalCount / Math.max(1, fullIndex.length)) * 100
        },
        {
          label: "Volumen Monetario del Reporte",
          value: formatCurrencyAmount(stats.totalVolume),
          badge: "CONSOLIDADO",
          subtitle: `Promedio: ${formatCurrencyAmount(stats.averageAmount)}`,
          trend: "NIIF / IFRS",
          accent: "success",
          progressPct: 95
        },
        {
          label: "Partida Mayor Detectada",
          value: formatCurrencyAmount(stats.maxAmount),
          badge: "PICO MÁXIMO",
          subtitle: "Transacción o saldo superior",
          trend: "Auditado",
          accent: "purple",
          progressPct: 85
        },
        {
          label: "Módulos con Actividad en Filtro",
          value: `${stats.distributions.length} Módulos`,
          badge: "COBERTURA",
          subtitle: "Segmentación automática",
          trend: "100% Modular",
          accent: "warning",
          progressPct: 100
        }
      ]);

      containerEl.innerHTML = `
        <div class="stats-kpi-grid">${kpisHtml}</div>

        <div class="module-filter-bar">
          <div class="filter-input-group">
            <input
              type="search"
              id="rep-local-search-input"
              class="module-search-input"
              placeholder="Filtrar reporte ejecutivo por cualquier módulo, cuenta, empleado, cliente POS, usuario AD o estado..."
              value="${sanitizeTextString(localSearch)}"
            />
          </div>
          <div class="module-toolbar-actions">
            <button type="button" id="btn-export-report-json" class="btn-action btn-primary">
              Exportar Respaldo Estructurado JSON
            </button>
          </div>
        </div>

        <div class="workspace-split-layout">
          <!-- Matriz Consolidada de Reportes -->
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Muestra Consolidada de Reportes Operativos y Contables (${filteredRecords.length})</h3>
              <span class="badge-pill badge-info">Vista Unificada</span>
            </div>
            <div class="table-scroll-container">
              <table class="accounting-table">
                <thead>
                  <tr>
                    <th>Módulo Origen</th>
                    <th>Código / ID</th>
                    <th>Descripción Principal</th>
                    <th>Detalle / Metadatos</th>
                    <th>Estado</th>
                    <th class="col-numeric">Importe / Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredRecords.map((item) => `
                    <tr>
                      <td><span class="badge-pill badge-purple">${highlightSearchMatchSafe(item.moduleName, localSearch)}</span></td>
                      <td class="font-mono"><strong>${highlightSearchMatchSafe(item.code, localSearch)}</strong></td>
                      <td>${highlightSearchMatchSafe(item.title, localSearch)}</td>
                      <td>${highlightSearchMatchSafe(item.subtitle, localSearch)}</td>
                      <td><span class="badge-pill badge-success">${sanitizeTextString(item.status)}</span></td>
                      <td class="col-numeric col-debit">${formatCurrencyAmount(item.amount)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Estadísticas de Distribución por Módulo -->
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Estadísticas de Participación por Módulo Independiente</h3>
              <span class="badge-pill badge-success">DISTRIBUCIÓN EN VIVO</span>
            </div>
            <div class="enterprise-panel-body">
              <div class="analytics-breakdown-card">
                ${stats.distributions.map((dist) => `
                  <div class="analytics-row-item">
                    <div class="analytics-row-labels">
                      <strong>${sanitizeTextString(dist.category)} (${dist.count} registros)</strong>
                      <span class="font-mono">${formatCurrencyAmount(dist.volume)} (${formatPercentageValue(dist.percentage, 1)})</span>
                    </div>
                    <div class="stat-progress-track">
                      <div class="stat-progress-fill fill-success ${dist.cssProgressClass}"></div>
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </div>
      `;

      const searchInput = containerEl.querySelector("#rep-local-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          localSearch = e.target.value;
          renderContent();
          const refreshed = containerEl.querySelector("#rep-local-search-input");
          if (refreshed) {
            refreshed.focus();
            refreshed.setSelectionRange(localSearch.length, localSearch.length);
          }
        });
      }

      const exportBtn = containerEl.querySelector("#btn-export-report-json");
      if (exportBtn) {
        exportBtn.addEventListener("click", () => {
          const payload = {
            exportedAt: new Date().toISOString(),
            system: "EasyDataAccounting Enterprise",
            firebaseProject: "easy-data-accounting",
            chartOfAccounts: getCollectionRecords("chartOfAccounts"),
            journalEntries: getCollectionRecords("journalEntries"),
            bankStatements: getCollectionRecords("bankStatements"),
            posSalesHistory: getCollectionRecords("posSalesHistory"),
            payrollEmployees: getCollectionRecords("payrollEmployees")
          };

          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = `EasyDataAccounting-Reporte-${new Date().toISOString().slice(0, 10)}.json`;
          anchor.click();
          URL.revokeObjectURL(url);

          dispatchEnterpriseToast({
            title: "Reporte Estructurado Exportado",
            message: "El archivo JSON con el respaldo contable fue descargado.",
            variant: "success"
          });
        });
      }
    };

    renderContent();
  }
};
