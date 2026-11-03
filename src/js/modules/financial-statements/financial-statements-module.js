/**
 * MÓDULO INDEPENDIENTE 8: ESTADOS FINANCIEROS NIIF (T-CODE: FIN01)
 * Estado de Situación Financiera (Balance General), Estado de Resultados (P&L),
 * Análisis Vertical e Indicadores Financieros Ejecutivos.
 */

import { getCollectionRecords } from "../../database/database-provider-adapter.js";
import { computeFinancialStatementsAndRatios } from "../../statistics/financial-ratios-calculator.js";
import { renderStatisticsKpiCardsHtml } from "../../statistics/real-time-statistics-calculator.js";
import {
  formatCurrencyAmount,
  formatDecimalNumber,
  formatPercentageValue
} from "../../formatters/currency-and-number-formatter.js";
import { sanitizeTextString, highlightSearchMatchSafe } from "../../validators/security-input-sanitizer.js";

export const FinancialStatementsModule = {
  id: "financial-statements",
  tCode: "FIN01",
  name: "Estados Financieros",
  category: "TESORERÍA Y CIERRE",
  templatePath: "./src/html/modules/financial-statements-view.html",
  requiredPermission: "ACC_FIN_STATEMENTS_VIEW",
  exportedFunctions: [
    "generateBalanceSheetStatement",
    "generateIncomeStatementPnL",
    "calculateExecutiveFinancialRatios"
  ],

  async renderModuleWorkspace(containerEl, { searchQuery = "" } = {}) {
    let localSearch = searchQuery;

    const renderContent = () => {
      const allAccounts = getCollectionRecords("chartOfAccounts");
      const fin = computeFinancialStatementsAndRatios(allAccounts);
      const cleanSearch = String(localSearch || "").trim().toLowerCase();

      const filterBySearch = (list) =>
        list.filter((acc) => !cleanSearch || `${acc.code} ${acc.name} ${acc.type}`.toLowerCase().includes(cleanSearch));

      const kpisHtml = renderStatisticsKpiCardsHtml([
        {
          label: "Total Activos (NIIF)",
          value: formatCurrencyAmount(fin.totals.totalAssets),
          badge: "SITUACIÓN FINANCIERA",
          subtitle: `Corriente: ${formatCurrencyAmount(fin.totals.totalCurrentAssets)}`,
          trend: fin.totals.accountingEquationBalanced ? "Ecuación Cuadrada" : "Revisar Ajuste",
          accent: "info",
          progressPct: 100
        },
        {
          label: "Pasivo + Patrimonio Total",
          value: formatCurrencyAmount(fin.totals.totalLiabilities + fin.totals.totalEquityWithNetIncome),
          badge: "FINANCIAMIENTO",
          subtitle: `Pasivos: ${formatCurrencyAmount(fin.totals.totalLiabilities)}`,
          trend: `Endeudamiento: ${formatPercentageValue(fin.ratios.debtToAssetRatioPct, 1)}`,
          accent: "purple",
          progressPct: 100
        },
        {
          label: "Utilidad Neta del Ejercicio",
          value: formatCurrencyAmount(fin.totals.netIncome),
          badge: `MARGEN ${formatPercentageValue(fin.ratios.netProfitMarginPct, 1)}`,
          subtitle: `Ingresos: ${formatCurrencyAmount(fin.totals.totalRevenues)}`,
          trend: `ROE: ${formatPercentageValue(fin.ratios.returnOnEquityPct, 1)}`,
          accent: fin.totals.netIncome >= 0 ? "success" : "danger",
          progressPct: Math.min(100, Math.max(15, fin.ratios.netProfitMarginPct))
        },
        {
          label: "Liquidez Corriente / Ácida",
          value: `${formatDecimalNumber(fin.ratios.currentRatio)}x`,
          badge: `ÁCIDA ${formatDecimalNumber(fin.ratios.acidTestRatio)}x`,
          subtitle: `Cap. Trabajo: ${formatCurrencyAmount(fin.ratios.workingCapital)}`,
          trend: "Solvencia Sólida",
          accent: "warning",
          progressPct: 90
        }
      ]);

      const renderStatementTable = (items, denominatorTotal) => `
        <table class="accounting-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Rubro Contable</th>
              <th class="col-numeric">Importe USD</th>
              <th class="col-numeric">Análisis Vertical</th>
            </tr>
          </thead>
          <tbody>
            ${filterBySearch(items).map((acc) => {
              const verticalPct = denominatorTotal > 0 ? ((Number(acc.balance) || 0) / denominatorTotal) * 100 : 0;
              return `
                <tr>
                  <td class="font-mono"><strong>${highlightSearchMatchSafe(acc.code, localSearch)}</strong></td>
                  <td>${highlightSearchMatchSafe(acc.name, localSearch)}</td>
                  <td class="col-numeric col-debit">${formatCurrencyAmount(acc.balance)}</td>
                  <td class="col-numeric font-mono">${formatPercentageValue(verticalPct, 1)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      `;

      containerEl.innerHTML = `
        <div class="stats-kpi-grid">${kpisHtml}</div>

        <div class="module-filter-bar">
          <div class="filter-input-group">
            <input
              type="search"
              id="fin-local-search-input"
              class="module-search-input"
              placeholder="Buscar rubro en Balance General o Estado de Resultados por código o nombre de cuenta..."
              value="${sanitizeTextString(localSearch)}"
            />
          </div>
          <div class="module-toolbar-actions">
            <span class="badge-pill badge-success">Ecuación Contable: Activo = Pasivo + Patrimonio</span>
          </div>
        </div>

        <div class="workspace-equal-split">
          <!-- Balance General (Estado de Situación Financiera) -->
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Estado de Situación Financiera (Balance General NIIF)</h3>
              <span class="badge-pill badge-info">USD</span>
            </div>
            <div class="enterprise-panel-body">
              <div class="financial-statement-section">
                <div class="financial-statement-header">
                  <span>1. ACTIVOS TOTALES</span>
                  <span class="font-mono col-positive">${formatCurrencyAmount(fin.totals.totalAssets)}</span>
                </div>
                ${renderStatementTable(fin.assets, fin.totals.totalAssets)}
              </div>

              <div class="financial-statement-section">
                <div class="financial-statement-header">
                  <span>2. PASIVOS TOTALES</span>
                  <span class="font-mono col-credit">${formatCurrencyAmount(fin.totals.totalLiabilities)}</span>
                </div>
                ${renderStatementTable(fin.liabilities, fin.totals.totalAssets)}
              </div>

              <div class="financial-statement-section">
                <div class="financial-statement-header">
                  <span>3. PATRIMONIO NETO (+ UTILIDAD DEL EJERCICIO)</span>
                  <span class="font-mono col-positive">${formatCurrencyAmount(fin.totals.totalEquityWithNetIncome)}</span>
                </div>
                ${renderStatementTable(fin.equityAccounts, fin.totals.totalAssets)}
                <div class="journal-balance-bar is-balanced">
                  <strong>Resultado del Ejercicio Incorporado al Patrimonio:</strong>
                  <span class="font-mono"><strong>${formatCurrencyAmount(fin.totals.netIncome)}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Estado de Resultados Integral (P&L) + Ratios -->
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Estado de Resultados Integral (P&amp;L) &amp; Ratios</h3>
              <span class="badge-pill badge-success">RENTABILIDAD</span>
            </div>
            <div class="enterprise-panel-body">
              <div class="financial-statement-section">
                <div class="financial-statement-header">
                  <span>4. INGRESOS OPERACIONALES</span>
                  <span class="font-mono col-positive">${formatCurrencyAmount(fin.totals.totalRevenues)}</span>
                </div>
                ${renderStatementTable(fin.revenueAccounts, fin.totals.totalRevenues)}
              </div>

              <div class="financial-statement-section">
                <div class="financial-statement-header">
                  <span>5. COSTOS Y GASTOS OPERATIVOS</span>
                  <span class="font-mono col-negative">${formatCurrencyAmount(fin.totals.totalCosts + fin.totals.totalOperatingExpenses)}</span>
                </div>
                ${renderStatementTable([...fin.costAccounts, ...fin.expenseAccounts], fin.totals.totalRevenues)}
              </div>

              <div class="pos-ticket-summary">
                <div class="pos-summary-line">
                  <span>Utilidad Bruta Comercial</span>
                  <strong class="font-mono">${formatCurrencyAmount(fin.totals.grossProfit)}</strong>
                </div>
                <div class="pos-summary-line">
                  <span>Total Gastos de Administración, Nómina y TI</span>
                  <strong class="font-mono">-${formatCurrencyAmount(fin.totals.totalOperatingExpenses)}</strong>
                </div>
                <div class="pos-summary-total">
                  <span>UTILIDAD NETA DEL EJERCICIO</span>
                  <span class="font-mono col-positive">${formatCurrencyAmount(fin.totals.netIncome)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      const searchInput = containerEl.querySelector("#fin-local-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          localSearch = e.target.value;
          renderContent();
          const refreshed = containerEl.querySelector("#fin-local-search-input");
          if (refreshed) {
            refreshed.focus();
            refreshed.setSelectionRange(localSearch.length, localSearch.length);
          }
        });
      }
    };

    renderContent();
  }
};
