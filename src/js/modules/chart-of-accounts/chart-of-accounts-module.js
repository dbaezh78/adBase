/**
 * MÓDULO INDEPENDIENTE 3: CATÁLOGO DE CUENTAS NIIF / IFRS (T-CODE: COA01)
 * Gestión jerárquica multinivel de cuentas contables, naturalezas, centros de costo,
 * creación de subcuentas e inspección de saldos en tiempo real.
 */

import {
  getCollectionRecords,
  insertOrUpdateCollectionRecord
} from "../../database/database-provider-adapter.js";
import { recordSecurityAuditEvent } from "../../security/audit-trail-logger.js";
import { renderStatisticsKpiCardsHtml } from "../../statistics/real-time-statistics-calculator.js";
import { formatCurrencyAmount } from "../../formatters/currency-and-number-formatter.js";
import { sanitizeTextString, highlightSearchMatchSafe } from "../../validators/security-input-sanitizer.js";
import { dispatchEnterpriseToast } from "../../core/ui-notification-dispatcher.js";

export const ChartOfAccountsModule = {
  id: "chart-of-accounts",
  tCode: "COA01",
  name: "Catálogo de Cuentas",
  category: "CONTABILIDAD CORE",
  templatePath: "./src/html/modules/chart-of-accounts-view.html",
  requiredPermission: "ACC_COA_VIEW",
  exportedFunctions: [
    "searchChartOfAccountsTree",
    "createAccountingAccount",
    "inspectAccountMovements",
    "computeAccountHierarchyStats"
  ],

  async renderModuleWorkspace(containerEl, { searchQuery = "" } = {}) {
    let localSearch = searchQuery;
    let activeTypeFilter = "TODOS";
    let selectedAccount = null;

    const renderContent = () => {
      const allAccounts = getCollectionRecords("chartOfAccounts").sort((a, b) =>
        String(a.code).localeCompare(String(b.code))
      );
      const allEntries = getCollectionRecords("journalEntries");
      const cleanSearch = String(localSearch || "").trim().toLowerCase();

      const filteredAccounts = allAccounts.filter((acc) => {
        const matchesType = activeTypeFilter === "TODOS" || acc.type === activeTypeFilter;
        const matchesQuery = !cleanSearch ||
          `${acc.code} ${acc.name} ${acc.type} ${acc.nature} ${acc.costCenter}`.toLowerCase().includes(cleanSearch);
        return matchesType && matchesQuery;
      });

      if (!selectedAccount || !filteredAccounts.some((a) => a.code === selectedAccount.code)) {
        selectedAccount = filteredAccounts[0] || allAccounts[0];
      }

      const imputableFiltered = filteredAccounts.filter((a) => a.imputable);
      const totalDebitNatureVolume = imputableFiltered
        .filter((a) => a.nature === "DEUDORA")
        .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
      const totalCreditNatureVolume = imputableFiltered
        .filter((a) => a.nature === "ACREEDORA")
        .reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

      const kpisHtml = renderStatisticsKpiCardsHtml([
        {
          label: "Cuentas Pobladas en Búsqueda",
          value: `${filteredAccounts.length} / ${allAccounts.length}`,
          badge: activeTypeFilter,
          subtitle: `${imputableFiltered.length} imputables operativas`,
          trend: "Jerarquía NIIF",
          accent: "info",
          progressPct: (filteredAccounts.length / Math.max(1, allAccounts.length)) * 100
        },
        {
          label: "Volumen Cuentas Deudoras",
          value: formatCurrencyAmount(totalDebitNatureVolume),
          badge: "DEUDORA",
          subtitle: "Activos, Costos y Gastos filtrados",
          trend: "Saldo Vivo",
          accent: "success",
          progressPct: 85
        },
        {
          label: "Volumen Cuentas Acreedoras",
          value: formatCurrencyAmount(totalCreditNatureVolume),
          badge: "ACREEDORA",
          subtitle: "Pasivos, Patrimonio e Ingresos",
          trend: "Equilibrio Validado",
          accent: "purple",
          progressPct: 85
        },
        {
          label: "Cuenta Inspeccionada",
          value: selectedAccount ? selectedAccount.code : "-",
          badge: selectedAccount?.nature || "N/A",
          subtitle: selectedAccount ? selectedAccount.name : "Seleccione una cuenta",
          trend: selectedAccount ? formatCurrencyAmount(selectedAccount.balance) : "$0.00",
          accent: "warning",
          progressPct: 100
        }
      ]);

      // Movimientos de la cuenta seleccionada
      const selectedMovements = [];
      if (selectedAccount) {
        allEntries.forEach((entry) => {
          (entry.lines || []).forEach((line) => {
            if (line.accountCode === selectedAccount.code || String(line.accountCode).startsWith(`${selectedAccount.code}.`)) {
              selectedMovements.push({
                entryNumber: entry.number,
                date: entry.date,
                concept: entry.concept,
                debit: line.debit,
                credit: line.credit
              });
            }
          });
        });
      }

      const typeFilters = ["TODOS", "ACTIVO", "PASIVO", "PATRIMONIO", "INGRESO", "COSTO", "GASTO"];

      containerEl.innerHTML = `
        <div class="stats-kpi-grid">${kpisHtml}</div>

        <div class="module-filter-bar">
          <div class="filter-input-group">
            <input
              type="search"
              id="coa-local-search-input"
              class="module-search-input"
              placeholder="Buscar cuenta por código (ej. 1.1.02), nombre, naturaleza o centro de costo..."
              value="${sanitizeTextString(localSearch)}"
            />
          </div>
          <div class="filter-pills-group">
            ${typeFilters.map((type) => `
              <button type="button" class="filter-pill-btn ${activeTypeFilter === type ? "is-active" : ""}" data-coa-type="${type}">
                ${type}
              </button>
            `).join("")}
          </div>
        </div>

        <div class="workspace-split-layout">
          <!-- Árbol del Catálogo de Cuentas -->
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Árbol Jerárquico del Catálogo de Cuentas (${filteredAccounts.length})</h3>
              <span class="badge-pill badge-info">Click para ver contenido y auxiliar</span>
            </div>
            <div class="table-scroll-container">
              <table class="accounting-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre de la Cuenta Contable</th>
                    <th>Tipo</th>
                    <th>Naturaleza</th>
                    <th>Nivel</th>
                    <th class="col-numeric">Saldo Actual</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredAccounts.map((acc) => {
                    const levelClass = `coa-level-${Math.min(4, acc.level || 1)}`;
                    return `
                      <tr class="coa-row-item ${selectedAccount?.code === acc.code ? "is-selected-row" : ""}" data-coa-code="${sanitizeTextString(acc.code)}">
                        <td class="font-mono"><strong>${highlightSearchMatchSafe(acc.code, localSearch)}</strong></td>
                        <td class="${levelClass}">${highlightSearchMatchSafe(acc.name, localSearch)}</td>
                        <td><span class="badge-pill badge-info">${sanitizeTextString(acc.type)}</span></td>
                        <td>
                          <span class="badge-pill ${acc.nature === "DEUDORA" ? "badge-success" : "badge-purple"}">
                            ${sanitizeTextString(acc.nature)}
                          </span>
                        </td>
                        <td class="font-mono">${acc.imputable ? "Imputable" : `Grupo N${acc.level}`}</td>
                        <td class="col-numeric ${acc.nature === "DEUDORA" ? "col-debit" : "col-credit"}">
                          ${formatCurrencyAmount(acc.balance)}
                        </td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Inspector de Contenido de la Cuenta + Creación de Cuenta -->
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Contenido de la Cuenta &amp; Auxiliar de Movimientos</h3>
              <span class="badge-pill badge-success">${selectedAccount?.code || "-"}</span>
            </div>
            <div class="enterprise-panel-body">
              ${selectedAccount ? `
                <div class="search-content-inspector">
                  <div class="inspector-header">
                    <strong>${sanitizeTextString(selectedAccount.code)} - ${sanitizeTextString(selectedAccount.name)}</strong>
                    <span class="badge-pill ${selectedAccount.imputable ? "badge-success" : "badge-warning"}">
                      ${selectedAccount.imputable ? "CUENTA IMPUTABLE" : "CUENTA AGRUPADORA"}
                    </span>
                  </div>
                  <div class="inspector-field-grid">
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Clasificación NIIF</span>
                      <span class="inspector-field-value">${sanitizeTextString(selectedAccount.type)}</span>
                    </div>
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Naturaleza Contable</span>
                      <span class="inspector-field-value">${sanitizeTextString(selectedAccount.nature)}</span>
                    </div>
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Centro de Costo</span>
                      <span class="inspector-field-value font-mono">${sanitizeTextString(selectedAccount.costCenter)}</span>
                    </div>
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Saldo Disponible</span>
                      <span class="inspector-field-value font-mono col-positive">${formatCurrencyAmount(selectedAccount.balance)}</span>
                    </div>
                  </div>
                  <div>
                    <span class="inspector-field-label">Partidas Registradas en esta Cuenta (${selectedMovements.length})</span>
                    <div class="table-scroll-container">
                      <table class="accounting-table">
                        <thead>
                          <tr>
                            <th>Asiento</th>
                            <th>Fecha</th>
                            <th class="col-numeric">Débito</th>
                            <th class="col-numeric">Crédito</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${selectedMovements.length === 0 ? `
                            <tr><td colspan="4">Sin movimientos directos en el periodo actual.</td></tr>
                          ` : selectedMovements.map((m) => `
                            <tr>
                              <td class="font-mono">${sanitizeTextString(m.entryNumber)}</td>
                              <td class="font-mono">${sanitizeTextString(m.date)}</td>
                              <td class="col-numeric col-debit">${formatCurrencyAmount(m.debit)}</td>
                              <td class="col-numeric col-credit">${formatCurrencyAmount(m.credit)}</td>
                            </tr>
                          `).join("")}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ` : ""}

              <hr class="module-header-banner" />

              <h4 class="enterprise-panel-title">Agregar Nueva Cuenta al Catálogo (Firebase Sync)</h4>
              <form id="form-create-coa-account" class="form-grid-layout">
                <div class="form-field-group">
                  <label class="form-field-label" for="coa-new-code">Código Jerárquico</label>
                  <input id="coa-new-code" class="form-input-control font-mono" type="text" placeholder="ej. 1.1.05" required />
                </div>
                <div class="form-field-group">
                  <label class="form-field-label" for="coa-new-name">Nombre de la Cuenta</label>
                  <input id="coa-new-name" class="form-input-control" type="text" placeholder="ej. Inversiones Temporales USD" required />
                </div>
                <div class="form-field-group">
                  <label class="form-field-label" for="coa-new-type">Tipo de Cuenta</label>
                  <select id="coa-new-type" class="form-select-control">
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="PASIVO">PASIVO</option>
                    <option value="PATRIMONIO">PATRIMONIO</option>
                    <option value="INGRESO">INGRESO</option>
                    <option value="COSTO">COSTO</option>
                    <option value="GASTO">GASTO</option>
                  </select>
                </div>
                <div class="form-field-group">
                  <label class="form-field-label" for="coa-new-balance">Saldo Inicial USD</label>
                  <input id="coa-new-balance" class="form-input-control font-mono" type="number" step="0.01" value="0.00" required />
                </div>
                <div class="form-field-group">
                  <button type="submit" class="btn-action btn-primary">
                    Guardar Cuenta en Catálogo
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      `;

      const searchInput = containerEl.querySelector("#coa-local-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          localSearch = e.target.value;
          renderContent();
          const refreshed = containerEl.querySelector("#coa-local-search-input");
          if (refreshed) {
            refreshed.focus();
            refreshed.setSelectionRange(localSearch.length, localSearch.length);
          }
        });
      }

      containerEl.querySelectorAll("[data-coa-type]").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeTypeFilter = btn.getAttribute("data-coa-type");
          renderContent();
        });
      });

      containerEl.querySelectorAll(".coa-row-item").forEach((row) => {
        row.addEventListener("click", () => {
          const code = row.getAttribute("data-coa-code");
          selectedAccount = filteredAccounts.find((a) => a.code === code) || selectedAccount;
          renderContent();
        });
      });

      const formEl = containerEl.querySelector("#form-create-coa-account");
      if (formEl) {
        formEl.addEventListener("submit", async (e) => {
          e.preventDefault();
          const code = containerEl.querySelector("#coa-new-code").value.trim();
          const name = containerEl.querySelector("#coa-new-name").value.trim();
          const type = containerEl.querySelector("#coa-new-type").value;
          const balance = Number(containerEl.querySelector("#coa-new-balance").value) || 0;

          const nature = ["ACTIVO", "COSTO", "GASTO"].includes(type) ? "DEUDORA" : "ACREEDORA";
          const segments = code.split(".");

          const newAccountRecord = {
            id: `COA-${code.replace(/\./g, "")}`,
            code,
            name,
            type,
            nature,
            level: Math.min(4, segments.length),
            imputable: segments.length >= 3,
            parentCode: segments.slice(0, -1).join(".") || null,
            costCenter: "CORP",
            balance,
            status: "ACTIVA"
          };

          await insertOrUpdateCollectionRecord("chartOfAccounts", newAccountRecord);
          selectedAccount = newAccountRecord;

          recordSecurityAuditEvent({
            moduleId: "chart-of-accounts",
            action: "COA_ACCOUNT_CREATED",
            detail: `Cuenta contable ${code} (${name}) creada y sincronizada con Firebase.`,
            severity: "SUCCESS"
          });

          dispatchEnterpriseToast({
            title: "Cuenta Creada Exitosamente",
            message: `${code} - ${name} agregada al Catálogo de Cuentas.`,
            variant: "success"
          });

          renderContent();
        });
      }
    };

    renderContent();
  }
};
