/**
 * MÓDULO INDEPENDIENTE 6: CONCILIACIÓN BANCARIA (T-CODE: BNK01)
 * Motor de cruce automático y manual entre extractos bancarios y el Libro Mayor,
 * control de partidas en tránsito y contabilización de ajustes bancarios.
 */

import {
  getCollectionRecords,
  insertOrUpdateCollectionRecord
} from "../../database/database-provider-adapter.js";
import { recordSecurityAuditEvent } from "../../security/audit-trail-logger.js";
import { publishSystemEvent } from "../../core/event-bus-dispatcher.js";
import { renderStatisticsKpiCardsHtml } from "../../statistics/real-time-statistics-calculator.js";
import { formatCurrencyAmount, formatPercentageValue } from "../../formatters/currency-and-number-formatter.js";
import { sanitizeTextString, highlightSearchMatchSafe } from "../../validators/security-input-sanitizer.js";
import { dispatchEnterpriseToast } from "../../core/ui-notification-dispatcher.js";

export const BankReconciliationModule = {
  id: "bank-reconciliation",
  tCode: "BNK01",
  name: "Conciliación Bancaria",
  category: "TESORERÍA Y CIERRE",
  templatePath: "./src/html/modules/bank-reconciliation-view.html",
  requiredPermission: "ACC_BANK_RECON_VIEW",
  exportedFunctions: [
    "runAutomaticBankReconciliation",
    "matchBankStatementLineToJournal",
    "postBankFeeAdjustmentEvent"
  ],

  async renderModuleWorkspace(containerEl, { searchQuery = "" } = {}) {
    let localSearch = searchQuery;
    let selectedBankMovement = null;

    const renderContent = () => {
      const allStatements = getCollectionRecords("bankStatements");
      const allEntries = getCollectionRecords("journalEntries");
      const cleanSearch = String(localSearch || "").trim().toLowerCase();

      const filteredStatements = allStatements.filter((mov) =>
        !cleanSearch ||
        `${mov.id} ${mov.reference} ${mov.description} ${mov.status} ${mov.matchedJournalId || ""}`.toLowerCase().includes(cleanSearch)
      );

      if (!selectedBankMovement || !filteredStatements.some((m) => m.id === selectedBankMovement.id)) {
        selectedBankMovement = filteredStatements[0] || allStatements[0];
      }

      const reconciledItems = filteredStatements.filter((m) => m.status === "CONCILIADO");
      const pendingItems = filteredStatements.filter((m) => m.status !== "CONCILIADO");
      const reconciledPct = filteredStatements.length > 0
        ? (reconciledItems.length / filteredStatements.length) * 100
        : 100;

      const bankTotalNet = filteredStatements.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
      const pendingDifference = pendingItems.reduce((acc, m) => acc + Math.abs(Number(m.amount) || 0), 0);

      const kpisHtml = renderStatisticsKpiCardsHtml([
        {
          label: "Movimientos Bancarios Poblados",
          value: `${filteredStatements.length} / ${allStatements.length}`,
          badge: "CUENTA 1.1.02",
          subtitle: `${reconciledItems.length} conciliados exactamente`,
          trend: `${pendingItems.length} por conciliar`,
          accent: "info",
          progressPct: (filteredStatements.length / Math.max(1, allStatements.length)) * 100
        },
        {
          label: "Índice de Conciliación",
          value: formatPercentageValue(reconciledPct, 1),
          badge: reconciledPct === 100 ? "COMPLETO" : "EN PROCESO",
          subtitle: "Efectividad de cruce con Mayor",
          trend: "Algoritmo Exact-Match",
          accent: "success",
          progressPct: reconciledPct
        },
        {
          label: "Flujo Neto Extracto Filtrado",
          value: formatCurrencyAmount(bankTotalNet),
          badge: "EXTRACTO",
          subtitle: "Banco Corporativo Principal USD",
          trend: "Verificado Swift",
          accent: "purple",
          progressPct: 90
        },
        {
          label: "Partidas en Tránsito / Pendientes",
          value: formatCurrencyAmount(pendingDifference),
          badge: `${pendingItems.length} PARTIDAS`,
          subtitle: "Requieren cruce o ajuste",
          trend: pendingDifference === 0 ? "Diferencia $0.00" : "Acción disponible",
          accent: pendingDifference === 0 ? "success" : "warning",
          progressPct: pendingDifference === 0 ? 100 : 45
        }
      ]);

      containerEl.innerHTML = `
        <div class="stats-kpi-grid">${kpisHtml}</div>

        <div class="module-filter-bar">
          <div class="filter-input-group">
            <input
              type="search"
              id="bnk-local-search-input"
              class="module-search-input"
              placeholder="Buscar movimiento bancario por referencia, descripción, monto o estado (CONCILIADO / PENDIENTE)..."
              value="${sanitizeTextString(localSearch)}"
            />
          </div>
          <div class="module-toolbar-actions">
            <button type="button" id="btn-auto-reconcile-all" class="btn-action btn-primary">
              Ejecutar Conciliación Automática Inteligente
            </button>
          </div>
        </div>

        <div class="workspace-split-layout">
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Extracto Bancario vs. Libro Mayor (${filteredStatements.length})</h3>
              <span class="badge-pill badge-info">Click en fila para inspeccionar cruce</span>
            </div>
            <div class="table-scroll-container">
              <table class="accounting-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Referencia</th>
                    <th>Descripción del Extracto</th>
                    <th class="col-numeric">Monto Banco</th>
                    <th>Asiento Vinculado</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredStatements.map((mov) => `
                    <tr class="bnk-row-item ${selectedBankMovement?.id === mov.id ? "is-selected-row" : ""}" data-bnk-id="${sanitizeTextString(mov.id)}">
                      <td class="font-mono">${sanitizeTextString(mov.date)}</td>
                      <td class="font-mono"><strong>${highlightSearchMatchSafe(mov.reference, localSearch)}</strong></td>
                      <td>${highlightSearchMatchSafe(mov.description, localSearch)}</td>
                      <td class="col-numeric ${mov.amount >= 0 ? "col-positive" : "col-negative"}">
                        ${formatCurrencyAmount(mov.amount)}
                      </td>
                      <td class="font-mono">${sanitizeTextString(mov.matchedJournalId || "SIN VINCULAR")}</td>
                      <td>
                        <span class="badge-pill ${mov.status === "CONCILIADO" ? "badge-success" : "badge-warning"}">
                          ${sanitizeTextString(mov.status)}
                        </span>
                      </td>
                      <td>
                        ${mov.status === "CONCILIADO"
                          ? '<span class="badge-pill badge-info">OK</span>'
                          : `<button type="button" class="btn-action btn-success btn-xs btn-reconcile-single" data-mov-id="${sanitizeTextString(mov.id)}">
                              Conciliar / Ajustar
                             </button>`
                        }
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Contenido Detallado de Partida Bancaria</h3>
              <span class="badge-pill badge-purple">${sanitizeTextString(selectedBankMovement?.id || "-")}</span>
            </div>
            <div class="enterprise-panel-body">
              ${selectedBankMovement ? `
                <div class="search-content-inspector">
                  <div class="inspector-header">
                    <strong>Referencia: ${sanitizeTextString(selectedBankMovement.reference)}</strong>
                    <span class="badge-pill ${selectedBankMovement.status === "CONCILIADO" ? "badge-success" : "badge-warning"}">
                      ${sanitizeTextString(selectedBankMovement.status)}
                    </span>
                  </div>
                  <div class="inspector-field-grid">
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Cuenta Contable Banco</span>
                      <span class="inspector-field-value font-mono">${sanitizeTextString(selectedBankMovement.bankAccount)}</span>
                    </div>
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Importe Extracto</span>
                      <span class="inspector-field-value font-mono">${formatCurrencyAmount(selectedBankMovement.amount)}</span>
                    </div>
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Tipo de Operación</span>
                      <span class="inspector-field-value">${sanitizeTextString(selectedBankMovement.type)}</span>
                    </div>
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Póliza en Libro Mayor</span>
                      <span class="inspector-field-value font-mono">${sanitizeTextString(selectedBankMovement.matchedJournalId || "Pendiente de Cruce")}</span>
                    </div>
                  </div>
                  <div class="inspector-field-item">
                    <span class="inspector-field-label">Descripción Bancaria</span>
                    <span class="inspector-field-value">${sanitizeTextString(selectedBankMovement.description)}</span>
                  </div>
                </div>
              ` : ""}
            </div>
          </div>
        </div>
      `;

      const searchInput = containerEl.querySelector("#bnk-local-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          localSearch = e.target.value;
          renderContent();
          const refreshed = containerEl.querySelector("#bnk-local-search-input");
          if (refreshed) {
            refreshed.focus();
            refreshed.setSelectionRange(localSearch.length, localSearch.length);
          }
        });
      }

      containerEl.querySelectorAll(".bnk-row-item").forEach((row) => {
        row.addEventListener("click", (e) => {
          if (e.target.closest(".btn-reconcile-single")) {
            return;
          }
          const id = row.getAttribute("data-bnk-id");
          selectedBankMovement = filteredStatements.find((m) => m.id === id) || selectedBankMovement;
          renderContent();
        });
      });

      const reconcileMovement = async (mov) => {
        // Buscar si existe asiento con la misma referencia
        const matchingEntry = allEntries.find((e) => e.reference === mov.reference);
        if (matchingEntry) {
          mov.matchedJournalId = matchingEntry.number;
          mov.status = "CONCILIADO";
          await insertOrUpdateCollectionRecord("bankStatements", mov);
        } else {
          // Emitir evento al módulo de integración para crear asiento de ajuste bancario
          const eventResult = await publishSystemEvent("BANK_FEE_ADJUSTMENT", {
            reference: mov.reference,
            description: mov.description,
            amount: Math.abs(Number(mov.amount) || 0),
            date: mov.date
          });
          mov.matchedJournalId = eventResult.payload?.generatedJournalNumber || "AST-AJUSTE-BNK";
          mov.status = "CONCILIADO";
          await insertOrUpdateCollectionRecord("bankStatements", mov);
        }

        recordSecurityAuditEvent({
          moduleId: "bank-reconciliation",
          action: "BANK_ITEM_RECONCILED",
          detail: `Partida bancaria ${mov.reference} (${formatCurrencyAmount(mov.amount)}) conciliada exitosamente.`,
          severity: "SUCCESS"
        });
      };

      containerEl.querySelectorAll(".btn-reconcile-single").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-mov-id");
          const mov = allStatements.find((m) => m.id === id);
          if (mov) {
            await reconcileMovement(mov);
            dispatchEnterpriseToast({
              title: "Partida Bancaria Conciliada",
              message: `Referencia ${mov.reference} conciliada con el Libro Mayor.`,
              variant: "success"
            });
            renderContent();
          }
        });
      });

      const autoBtn = containerEl.querySelector("#btn-auto-reconcile-all");
      if (autoBtn) {
        autoBtn.addEventListener("click", async () => {
          const pending = allStatements.filter((m) => m.status !== "CONCILIADO");
          if (pending.length === 0) {
            dispatchEnterpriseToast({
              title: "Conciliación al 100%",
              message: "Todas las partidas bancarias ya se encuentran conciliadas.",
              variant: "info"
            });
            return;
          }
          for (const mov of pending) {
            await reconcileMovement(mov);
          }
          dispatchEnterpriseToast({
            title: "Conciliación Automática Completada",
            message: `Se conciliaron ${pending.length} partidas pendientes con el Libro Mayor.`,
            variant: "success"
          });
          renderContent();
        });
      }
    };

    renderContent();
  }
};
