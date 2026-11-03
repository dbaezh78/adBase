/**
 * MÓDULO INDEPENDIENTE 4: REGISTRO DE ASIENTOS CONTABLES (T-CODE: FB50)
 * Captura y contabilización de pólizas bajo partida doble estricta (Débito = Crédito),
 * validación de cuentas imputables y periodos abiertos.
 */

import {
  getCollectionRecords,
  insertOrUpdateCollectionRecord
} from "../../database/database-provider-adapter.js";
import { validateJournalEntryBalance } from "../../validators/accounting-double-entry-validator.js";
import { recordSecurityAuditEvent } from "../../security/audit-trail-logger.js";
import { getActiveUserSecuritySession } from "../../security/role-permission-evaluator.js";
import { renderStatisticsKpiCardsHtml } from "../../statistics/real-time-statistics-calculator.js";
import { formatCurrencyAmount } from "../../formatters/currency-and-number-formatter.js";
import { sanitizeTextString, highlightSearchMatchSafe } from "../../validators/security-input-sanitizer.js";
import { dispatchEnterpriseToast } from "../../core/ui-notification-dispatcher.js";

export const JournalEntriesModule = {
  id: "journal-entries",
  tCode: "FB50",
  name: "Registro de Asientos",
  category: "CONTABILIDAD CORE",
  templatePath: "./src/html/modules/journal-entries-view.html",
  requiredPermission: "ACC_JOURNAL_VIEW",
  exportedFunctions: [
    "postBalancedJournalEntry",
    "validateDoubleEntryLines",
    "reversePostedJournalEntry",
    "searchJournalEntriesLedger"
  ],

  async renderModuleWorkspace(containerEl, { searchQuery = "" } = {}) {
    let localSearch = searchQuery;
    let selectedEntry = null;

    let draftLines = [
      { accountCode: "1.1.02", costCenter: "TES-01", debit: 12500.00, credit: 0.00 },
      { accountCode: "4.1.01", costCenter: "COM-01", debit: 0.00, credit: 12500.00 }
    ];

    const renderContent = () => {
      const allEntries = getCollectionRecords("journalEntries");
      const allAccounts = getCollectionRecords("chartOfAccounts");
      const imputableAccounts = allAccounts.filter((a) => a.imputable);
      const fiscalPeriods = getCollectionRecords("fiscalPeriods");

      const cleanSearch = String(localSearch || "").trim().toLowerCase();
      const filteredEntries = allEntries.filter((entry) =>
        !cleanSearch ||
        `${entry.number} ${entry.date} ${entry.concept} ${entry.reference} ${entry.sourceModule} ${entry.createdBy} ${JSON.stringify(entry.lines)}`.toLowerCase().includes(cleanSearch)
      );

      if (!selectedEntry || !filteredEntries.some((e) => e.id === selectedEntry.id)) {
        selectedEntry = filteredEntries[0] || allEntries[0];
      }

      const sumDebit = filteredEntries.reduce((acc, e) => acc + (Number(e.totalDebit) || 0), 0);
      const sumCredit = filteredEntries.reduce((acc, e) => acc + (Number(e.totalCredit) || 0), 0);

      const draftDebitSum = draftLines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
      const draftCreditSum = draftLines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
      const isDraftBalanced = Math.abs(draftDebitSum - draftCreditSum) < 0.001 && draftDebitSum > 0;

      const kpisHtml = renderStatisticsKpiCardsHtml([
        {
          label: "Asientos Poblados",
          value: `${filteredEntries.length} / ${allEntries.length}`,
          badge: "LIBRO DIARIO",
          subtitle: "Pólizas verificadas por Seguridad",
          trend: "100% Partida Doble",
          accent: "info",
          progressPct: (filteredEntries.length / Math.max(1, allEntries.length)) * 100
        },
        {
          label: "Sumatoria Débitos Filtrados",
          value: formatCurrencyAmount(sumDebit),
          badge: "CARGOS",
          subtitle: "Total columna Debe",
          trend: "Cuadre Exacto",
          accent: "success",
          progressPct: 100
        },
        {
          label: "Sumatoria Créditos Filtrados",
          value: formatCurrencyAmount(sumCredit),
          badge: "ABONOS",
          subtitle: "Total columna Haber",
          trend: `Diferencia: ${formatCurrencyAmount(Math.abs(sumDebit - sumCredit))}`,
          accent: "purple",
          progressPct: 100
        },
        {
          label: "Asiento en Inspección",
          value: selectedEntry ? selectedEntry.number : "-",
          badge: selectedEntry?.sourceModule || "MANUAL",
          subtitle: selectedEntry ? selectedEntry.concept : "Sin selección",
          trend: selectedEntry ? formatCurrencyAmount(selectedEntry.totalDebit) : "$0.00",
          accent: "warning",
          progressPct: 95
        }
      ]);

      containerEl.innerHTML = `
        <div class="stats-kpi-grid">${kpisHtml}</div>

        <div class="module-filter-bar">
          <div class="filter-input-group">
            <input
              type="search"
              id="jrn-local-search-input"
              class="module-search-input"
              placeholder="Buscar asiento por número (AST-2026-...), concepto, referencia, cuenta contable o usuario..."
              value="${sanitizeTextString(localSearch)}"
            />
          </div>
          <div class="module-toolbar-actions">
            <span class="badge-pill badge-success">Motor de Partida Doble Activo</span>
          </div>
        </div>

        <div class="workspace-split-layout">
          <!-- Listado de Asientos + Contenido Detallado de Partidas -->
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Asientos Contables Registrados (${filteredEntries.length})</h3>
              <span class="badge-pill badge-info">Click para mostrar líneas del asiento</span>
            </div>
            <div class="table-scroll-container">
              <table class="accounting-table">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Fecha</th>
                    <th>Origen</th>
                    <th>Concepto / Glosa</th>
                    <th class="col-numeric">Total Débito</th>
                    <th class="col-numeric">Total Crédito</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredEntries.map((entry) => `
                    <tr class="jrn-row-item ${selectedEntry?.id === entry.id ? "is-selected-row" : ""}" data-entry-id="${sanitizeTextString(entry.id)}">
                      <td class="font-mono"><strong>${highlightSearchMatchSafe(entry.number, localSearch)}</strong></td>
                      <td class="font-mono">${sanitizeTextString(entry.date)}</td>
                      <td><span class="badge-pill badge-purple">${sanitizeTextString(entry.sourceModule)}</span></td>
                      <td>${highlightSearchMatchSafe(entry.concept, localSearch)}</td>
                      <td class="col-numeric col-debit">${formatCurrencyAmount(entry.totalDebit)}</td>
                      <td class="col-numeric col-credit">${formatCurrencyAmount(entry.totalCredit)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>

            ${selectedEntry ? `
              <div class="enterprise-panel-body">
                <div class="search-content-inspector">
                  <div class="inspector-header">
                    <strong>Detalle de Partidas del Asiento: ${sanitizeTextString(selectedEntry.number)}</strong>
                    <span class="badge-pill badge-success">Creado por: ${sanitizeTextString(selectedEntry.createdBy)}</span>
                  </div>
                  <p class="module-description">
                    <strong>Concepto:</strong> ${highlightSearchMatchSafe(selectedEntry.concept, localSearch)} |
                    <strong>Referencia:</strong> <span class="font-mono">${sanitizeTextString(selectedEntry.reference)}</span>
                  </p>
                  <div class="table-scroll-container">
                    <table class="accounting-table">
                      <thead>
                        <tr>
                          <th>Cuenta</th>
                          <th>Descripción de Cuenta</th>
                          <th>Centro Costo</th>
                          <th class="col-numeric">Débito (Debe)</th>
                          <th class="col-numeric">Crédito (Haber)</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${(selectedEntry.lines || []).map((line) => `
                          <tr>
                            <td class="font-mono"><strong>${sanitizeTextString(line.accountCode)}</strong></td>
                            <td>${sanitizeTextString(line.accountName)}</td>
                            <td class="font-mono">${sanitizeTextString(line.costCenter || "CORP")}</td>
                            <td class="col-numeric col-debit">${formatCurrencyAmount(line.debit)}</td>
                            <td class="col-numeric col-credit">${formatCurrencyAmount(line.credit)}</td>
                          </tr>
                        `).join("")}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colspan="3">TOTALES DEL ASIENTO CUADRADO</td>
                          <td class="col-numeric col-debit">${formatCurrencyAmount(selectedEntry.totalDebit)}</td>
                          <td class="col-numeric col-credit">${formatCurrencyAmount(selectedEntry.totalCredit)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            ` : ""}
          </div>

          <!-- Constructor de Nuevo Asiento Contable (Superior a SAP FB50) -->
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Nuevo Asiento de Partida Doble (T-Code: FB50)</h3>
              <button type="button" id="btn-add-journal-line" class="btn-action btn-secondary btn-xs">
                + Agregar Línea Contable
              </button>
            </div>
            <div class="enterprise-panel-body">
              <form id="form-post-journal-entry">
                <div class="form-grid-layout">
                  <div class="form-field-group">
                    <label class="form-field-label" for="jrn-input-date">Fecha Contable</label>
                    <input id="jrn-input-date" class="form-input-control font-mono" type="date" value="2026-11-03" required />
                  </div>
                  <div class="form-field-group">
                    <label class="form-field-label" for="jrn-input-ref">Documento / Referencia</label>
                    <input id="jrn-input-ref" class="form-input-control font-mono" type="text" value="DOC-CORP-501" required />
                  </div>
                  <div class="form-field-group">
                    <label class="form-field-label" for="jrn-input-concept">Concepto / Glosa del Asiento</label>
                    <input id="jrn-input-concept" class="form-input-control" type="text" placeholder="Descripción detallada de la operación..." value="Cobro de servicios empresariales y licencias" required />
                  </div>
                </div>

                <div class="journal-lines-builder">
                  ${draftLines.map((line, idx) => `
                    <div class="journal-line-row" data-line-idx="${idx}">
                      <select class="form-select-control line-account-select" data-idx="${idx}">
                        ${imputableAccounts.map((acc) => `
                          <option value="${sanitizeTextString(acc.code)}" ${acc.code === line.accountCode ? "selected" : ""}>
                            ${sanitizeTextString(acc.code)} - ${sanitizeTextString(acc.name)}
                          </option>
                        `).join("")}
                      </select>
                      <input type="text" class="form-input-control font-mono line-cc-input" data-idx="${idx}" value="${sanitizeTextString(line.costCenter)}" placeholder="C. Costo" />
                      <input type="number" step="0.01" min="0" class="form-input-control font-mono line-debit-input" data-idx="${idx}" value="${Number(line.debit).toFixed(2)}" placeholder="Débito" />
                      <input type="number" step="0.01" min="0" class="form-input-control font-mono line-credit-input" data-idx="${idx}" value="${Number(line.credit).toFixed(2)}" placeholder="Crédito" />
                      <button type="button" class="btn-action btn-danger btn-xs btn-remove-line" data-idx="${idx}">X</button>
                    </div>
                  `).join("")}
                </div>

                <div class="journal-balance-bar ${isDraftBalanced ? "is-balanced" : "is-unbalanced"}">
                  <div>
                    <strong>Estado de Partida Doble:</strong>
                    <span>${isDraftBalanced ? "CUADRADO (Débito = Crédito)" : "DESCUADRADO"}</span>
                  </div>
                  <div class="font-mono">
                    Debe: <strong>${formatCurrencyAmount(draftDebitSum)}</strong> |
                    Haber: <strong>${formatCurrencyAmount(draftCreditSum)}</strong>
                  </div>
                </div>

                <div class="module-toolbar-actions">
                  <button type="submit" class="btn-action btn-primary">
                    Contabilizar Asiento en Firebase y Libro Mayor
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      `;

      const searchInput = containerEl.querySelector("#jrn-local-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          localSearch = e.target.value;
          renderContent();
          const refreshed = containerEl.querySelector("#jrn-local-search-input");
          if (refreshed) {
            refreshed.focus();
            refreshed.setSelectionRange(localSearch.length, localSearch.length);
          }
        });
      }

      containerEl.querySelectorAll(".jrn-row-item").forEach((row) => {
        row.addEventListener("click", () => {
          const id = row.getAttribute("data-entry-id");
          selectedEntry = filteredEntries.find((e) => e.id === id) || selectedEntry;
          renderContent();
        });
      });

      containerEl.querySelectorAll(".line-account-select").forEach((sel) => {
        sel.addEventListener("change", (e) => {
          const idx = Number(sel.getAttribute("data-idx"));
          draftLines[idx].accountCode = e.target.value;
        });
      });

      containerEl.querySelectorAll(".line-cc-input").forEach((inp) => {
        inp.addEventListener("input", (e) => {
          const idx = Number(inp.getAttribute("data-idx"));
          draftLines[idx].costCenter = e.target.value;
        });
      });

      containerEl.querySelectorAll(".line-debit-input").forEach((inp) => {
        inp.addEventListener("change", (e) => {
          const idx = Number(inp.getAttribute("data-idx"));
          const val = Number(e.target.value) || 0;
          draftLines[idx].debit = val;
          if (val > 0) {
            draftLines[idx].credit = 0;
          }
          renderContent();
        });
      });

      containerEl.querySelectorAll(".line-credit-input").forEach((inp) => {
        inp.addEventListener("change", (e) => {
          const idx = Number(inp.getAttribute("data-idx"));
          const val = Number(e.target.value) || 0;
          draftLines[idx].credit = val;
          if (val > 0) {
            draftLines[idx].debit = 0;
          }
          renderContent();
        });
      });

      containerEl.querySelectorAll(".btn-remove-line").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (draftLines.length <= 2) {
            dispatchEnterpriseToast({
              title: "Mínimo 2 líneas requeridas",
              message: "La partida doble exige al menos un cargo y un abono.",
              variant: "warning"
            });
            return;
          }
          const idx = Number(btn.getAttribute("data-idx"));
          draftLines.splice(idx, 1);
          renderContent();
        });
      });

      const addLineBtn = containerEl.querySelector("#btn-add-journal-line");
      if (addLineBtn) {
        addLineBtn.addEventListener("click", () => {
          draftLines.push({
            accountCode: imputableAccounts[0]?.code || "1.1.01",
            costCenter: "CORP",
            debit: 0,
            credit: 0
          });
          renderContent();
        });
      }

      const formEl = containerEl.querySelector("#form-post-journal-entry");
      if (formEl) {
        formEl.addEventListener("submit", async (e) => {
          e.preventDefault();
          const dateVal = containerEl.querySelector("#jrn-input-date").value;
          const refVal = containerEl.querySelector("#jrn-input-ref").value.trim();
          const conceptVal = containerEl.querySelector("#jrn-input-concept").value.trim();

          const enrichedLines = draftLines.map((l) => {
            const accObj = allAccounts.find((a) => a.code === l.accountCode);
            return {
              accountCode: l.accountCode,
              accountName: accObj ? accObj.name : "Cuenta Contable",
              costCenter: l.costCenter || "CORP",
              debit: Number(l.debit) || 0,
              credit: Number(l.credit) || 0
            };
          });

          const validation = validateJournalEntryBalance(
            { date: dateVal, concept: conceptVal, lines: enrichedLines },
            allAccounts,
            fiscalPeriods
          );

          if (!validation.isValid) {
            dispatchEnterpriseToast({
              title: "Validación de Partida Doble Rechazada",
              message: validation.errors[0],
              variant: "danger"
            });
            return;
          }

          // Actualizar saldos de las cuentas afectadas
          for (const line of enrichedLines) {
            const acc = allAccounts.find((a) => a.code === line.accountCode);
            if (acc) {
              const delta = acc.nature === "DEUDORA"
                ? line.debit - line.credit
                : line.credit - line.debit;
              acc.balance = Math.round(((Number(acc.balance) || 0) + delta) * 100) / 100;
              await insertOrUpdateCollectionRecord("chartOfAccounts", acc);
            }
          }

          const nextSeq = allEntries.length + 1;
          const entryNumber = `AST-2026-${String(nextSeq).padStart(4, "0")}`;
          const session = getActiveUserSecuritySession();

          const newEntry = {
            id: entryNumber,
            number: entryNumber,
            date: dateVal,
            period: dateVal.slice(0, 7),
            type: "DIARIO_OPERATIVO",
            sourceModule: "CONTABILIDAD",
            reference: refVal,
            concept: conceptVal,
            status: "CONTABILIZADO",
            createdBy: session.username,
            totalDebit: validation.totalDebit,
            totalCredit: validation.totalCredit,
            lines: enrichedLines
          };

          await insertOrUpdateCollectionRecord("journalEntries", newEntry);
          selectedEntry = newEntry;

          recordSecurityAuditEvent({
            actor: session.username,
            moduleId: "journal-entries",
            action: "JOURNAL_ENTRY_POSTED",
            detail: `Asiento ${entryNumber} contabilizado por ${formatCurrencyAmount(validation.totalDebit)} (${conceptVal}).`,
            severity: "SUCCESS"
          });

          dispatchEnterpriseToast({
            title: "Asiento Contabilizado en Firebase",
            message: `${entryNumber} registrado y saldos actualizados al instante.`,
            variant: "success"
          });

          renderContent();
        });
      }
    };

    renderContent();
  }
};
