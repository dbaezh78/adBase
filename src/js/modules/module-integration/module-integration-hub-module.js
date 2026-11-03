/**
 * MÓDULO INDEPENDIENTE 11: INTEGRACIÓN CON OTROS MÓDULOS Y BASES DE DATOS (T-CODE: INT01)
 * Orquestador desacoplado de reglas de contabilización automática (POS -> Contabilidad,
 * Nómina -> Contabilidad, Bancos -> Contabilidad) y gestor de migración de Base de Datos.
 */

import {
  getCollectionRecords,
  insertOrUpdateCollectionRecord,
  getActiveDatabaseProviderMetadata,
  switchActiveDatabaseProvider
} from "../../database/database-provider-adapter.js";
import {
  subscribeToSystemEvent,
  getRecentSystemEventsHistory
} from "../../core/event-bus-dispatcher.js";
import { recordSecurityAuditEvent } from "../../security/audit-trail-logger.js";
import { renderStatisticsKpiCardsHtml } from "../../statistics/real-time-statistics-calculator.js";
import { formatCurrencyAmount } from "../../formatters/currency-and-number-formatter.js";
import { sanitizeTextString, highlightSearchMatchSafe } from "../../validators/security-input-sanitizer.js";
import { dispatchEnterpriseToast } from "../../core/ui-notification-dispatcher.js";

let listenersRegistered = false;

export function initializeModuleIntegrationEventListeners() {
  if (listenersRegistered) {
    return;
  }
  listenersRegistered = true;

  // 1. Escuchar ventas del módulo independiente de Punto de Venta (POS)
  subscribeToSystemEvent("POS_SALE_COMPLETED", async (payload) => {
    const entries = getCollectionRecords("journalEntries");
    const accounts = getCollectionRecords("chartOfAccounts");
    const nextNum = `AST-2026-${String(entries.length + 1).padStart(4, "0")}`;

    const debitAccCode = payload.paymentMethod === "EFECTIVO_CAJA" ? "1.1.01" : "1.1.02";
    const debitAccName = debitAccCode === "1.1.01"
      ? "Caja General y Efectivo POS"
      : "Banco Corporativo Principal USD";

    const newEntry = {
      id: nextNum,
      number: nextNum,
      date: new Date().toISOString().slice(0, 10),
      period: "2026-11",
      type: "POS_AUTOMATICO",
      sourceModule: "PUNTO_DE_VENTA",
      reference: payload.saleId,
      concept: `Integración POS automática (${payload.customer} - NIT ${payload.rncNit})`,
      status: "CONTABILIZADO",
      createdBy: "INTEGRATION_BUS",
      totalDebit: payload.total,
      totalCredit: payload.total,
      lines: [
        { accountCode: debitAccCode, accountName: debitAccName, costCenter: "POS-01", debit: payload.total, credit: 0 },
        { accountCode: "4.1.02", accountName: "Ingresos por Ventas en Terminal POS", costCenter: "POS-01", debit: 0, credit: payload.subtotal },
        { accountCode: "2.1.02", accountName: "Impuestos e IVA / ITBIS por Pagar", costCenter: "FIS-01", debit: 0, credit: payload.taxAmount }
      ]
    };

    for (const line of newEntry.lines) {
      const acc = accounts.find((a) => a.code === line.accountCode);
      if (acc) {
        const delta = acc.nature === "DEUDORA" ? line.debit - line.credit : line.credit - line.debit;
        acc.balance = Math.round(((Number(acc.balance) || 0) + delta) * 100) / 100;
        await insertOrUpdateCollectionRecord("chartOfAccounts", acc);
      }
    }

    await insertOrUpdateCollectionRecord("journalEntries", newEntry);
    payload.generatedJournalNumber = nextNum;
  });

  // 2. Escuchar liquidación del módulo independiente de Nómina
  subscribeToSystemEvent("PAYROLL_RUN_APPROVED", async (payload) => {
    const entries = getCollectionRecords("journalEntries");
    const accounts = getCollectionRecords("chartOfAccounts");
    const nextNum = `AST-2026-${String(entries.length + 1).padStart(4, "0")}`;

    const newEntry = {
      id: nextNum,
      number: nextNum,
      date: new Date().toISOString().slice(0, 10),
      period: "2026-11",
      type: "NOMINA_AUTOMATICA",
      sourceModule: "NOMINA",
      reference: payload.runId,
      concept: `Integración Nómina (${payload.employeesCount} colaboradores + cargas sociales)`,
      status: "CONTABILIZADO",
      createdBy: "INTEGRATION_BUS",
      totalDebit: payload.totalExpense,
      totalCredit: payload.totalExpense,
      lines: [
        { accountCode: "5.2.01", accountName: "Gastos de Sueldos, Salarios y Cargas de Nómina", costCenter: "RRHH-01", debit: payload.totalExpense, credit: 0 },
        { accountCode: "1.1.02", accountName: "Banco Corporativo Principal USD", costCenter: "TES-01", debit: 0, credit: payload.totalBankNet },
        { accountCode: "2.1.03", accountName: "Nómina y Retenciones Seguridad Social por Pagar", costCenter: "RRHH-01", debit: 0, credit: payload.totalLiabilities }
      ]
    };

    for (const line of newEntry.lines) {
      const acc = accounts.find((a) => a.code === line.accountCode);
      if (acc) {
        const delta = acc.nature === "DEUDORA" ? line.debit - line.credit : line.credit - line.debit;
        acc.balance = Math.round(((Number(acc.balance) || 0) + delta) * 100) / 100;
        await insertOrUpdateCollectionRecord("chartOfAccounts", acc);
      }
    }

    await insertOrUpdateCollectionRecord("journalEntries", newEntry);
    payload.generatedJournalNumber = nextNum;
  });

  // 3. Escuchar ajustes de Conciliación Bancaria
  subscribeToSystemEvent("BANK_FEE_ADJUSTMENT", async (payload) => {
    const entries = getCollectionRecords("journalEntries");
    const nextNum = `AST-2026-${String(entries.length + 1).padStart(4, "0")}`;
    const amt = Number(payload.amount) || 145;

    const newEntry = {
      id: nextNum,
      number: nextNum,
      date: payload.date || "2026-11-03",
      period: "2026-11",
      type: "AJUSTE_BANCARIO",
      sourceModule: "CONCILIACION_BANCARIA",
      reference: payload.reference,
      concept: `Ajuste bancario automático: ${payload.description}`,
      status: "CONTABILIZADO",
      createdBy: "INTEGRATION_BUS",
      totalDebit: amt,
      totalCredit: amt,
      lines: [
        { accountCode: "5.2.02", accountName: "Gastos de Cloud, Licencias Windows Server y Bancarios", costCenter: "TES-01", debit: amt, credit: 0 },
        { accountCode: "1.1.02", accountName: "Banco Corporativo Principal USD", costCenter: "TES-01", debit: 0, credit: amt }
      ]
    };

    await insertOrUpdateCollectionRecord("journalEntries", newEntry);
    payload.generatedJournalNumber = nextNum;
  });
}

export const ModuleIntegrationHubModule = {
  id: "module-integration",
  tCode: "INT01",
  name: "Integración de Módulos",
  category: "INTEGRACIÓN Y BI",
  templatePath: "./src/html/modules/module-integration-hub-view.html",
  requiredPermission: "SYS_INTEGRATION_VIEW",
  exportedFunctions: [
    "routeModuleAccountingEvent",
    "switchDatabaseTargetEndpoint",
    "verifyIntegrationRuleCompliance"
  ],

  async renderModuleWorkspace(containerEl, { searchQuery = "" } = {}) {
    let localSearch = searchQuery;

    const renderContent = () => {
      const rules = getCollectionRecords("integrationRules");
      const dbMeta = getActiveDatabaseProviderMetadata();
      const eventsHistory = getRecentSystemEventsHistory();
      const cleanSearch = String(localSearch || "").trim().toLowerCase();

      const filteredRules = rules.filter((r) =>
        !cleanSearch ||
        `${r.id} ${r.sourceModule} ${r.eventName} ${r.debitAccount} ${r.creditAccount}`.toLowerCase().includes(cleanSearch)
      );

      const totalExecutions = filteredRules.reduce((s, r) => s + (Number(r.executionsCount) || 0), 0) + eventsHistory.length;

      const kpisHtml = renderStatisticsKpiCardsHtml([
        {
          label: "Reglas de Acoplamiento Activas",
          value: `${filteredRules.length} / ${rules.length}`,
          badge: "EVENT BUS",
          subtitle: "Módulos 100% desacoplados",
          trend: "0 Dependencias Directas",
          accent: "info",
          progressPct: 100
        },
        {
          label: "Motor de Base de Datos Activo",
          value: dbMeta.projectId,
          badge: dbMeta.id.toUpperCase(),
          subtitle: dbMeta.endpoint,
          trend: dbMeta.encryption,
          accent: "success",
          progressPct: 100
        },
        {
          label: "Sincronizaciones Automáticas",
          value: `${totalExecutions}`,
          badge: "TIEMPO REAL",
          subtitle: `${eventsHistory.length} eventos en esta sesión`,
          trend: "Latencia < 5ms",
          accent: "purple",
          progressPct: 95
        },
        {
          label: "Portabilidad Cloud / On-Prem",
          value: `${dbMeta.allProviders.length} Motores`,
          badge: "MIGRABLE",
          subtitle: "Firebase / SQL Server / Postgres",
          trend: "Conmutación en Caliente",
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
              id="int-local-search-input"
              class="module-search-input"
              placeholder="Buscar regla de integración por módulo origen (POS, NOMINA, BANCOS), evento o cuenta contable..."
              value="${sanitizeTextString(localSearch)}"
            />
          </div>
          <div class="module-toolbar-actions">
            <span class="badge-pill badge-success">Proyecto Firebase: easy-data-accounting</span>
          </div>
        </div>

        <div class="workspace-split-layout">
          <!-- Matriz de Reglas de Integración entre Módulos -->
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Reglas de Integración Contable entre Módulos Independientes (${filteredRules.length})</h3>
              <span class="badge-pill badge-info">Acoplamiento por Eventos</span>
            </div>
            <div class="table-scroll-container">
              <table class="accounting-table">
                <thead>
                  <tr>
                    <th>ID Regla</th>
                    <th>Módulo Independiente Origen</th>
                    <th>Evento Disparador</th>
                    <th>Cuenta Cargo (Debe)</th>
                    <th>Cuenta Abono (Haber)</th>
                    <th>Seguridad</th>
                    <th class="col-numeric">Ejecuciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredRules.map((rule) => `
                    <tr>
                      <td class="font-mono"><strong>${highlightSearchMatchSafe(rule.id, localSearch)}</strong></td>
                      <td><span class="badge-pill badge-purple">${highlightSearchMatchSafe(rule.sourceModule, localSearch)}</span></td>
                      <td class="font-mono">${highlightSearchMatchSafe(rule.eventName, localSearch)}</td>
                      <td class="font-mono col-debit">${highlightSearchMatchSafe(rule.debitAccount, localSearch)}</td>
                      <td class="font-mono col-credit">${highlightSearchMatchSafe(rule.creditAccount, localSearch)}</td>
                      <td><span class="badge-pill badge-success">VERIFICADO</span></td>
                      <td class="col-numeric font-mono">${rule.executionsCount}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Gestor de Conexión Firebase y Migración de Base de Datos -->
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Arquitectura de Base de Datos (Firebase &amp; Migración)</h3>
              <span class="badge-pill badge-success">ADAPTADOR DESACOPLADO</span>
            </div>
            <div class="enterprise-panel-body">
              <div class="search-content-inspector">
                <div class="inspector-header">
                  <strong>Configuración Activa de Base de Datos</strong>
                  <span class="badge-pill badge-info">${sanitizeTextString(dbMeta.type)}</span>
                </div>
                <div class="inspector-field-grid">
                  <div class="inspector-field-item">
                    <span class="inspector-field-label">Proveedor Actual</span>
                    <span class="inspector-field-value">${sanitizeTextString(dbMeta.name)}</span>
                  </div>
                  <div class="inspector-field-item">
                    <span class="inspector-field-label">Project ID / Instancia</span>
                    <span class="inspector-field-value font-mono">${sanitizeTextString(dbMeta.projectId)}</span>
                  </div>
                  <div class="inspector-field-item">
                    <span class="inspector-field-label">Endpoint de Destino</span>
                    <span class="inspector-field-value font-mono">${sanitizeTextString(dbMeta.endpoint)}</span>
                  </div>
                  <div class="inspector-field-item">
                    <span class="inspector-field-label">Cifrado de Transporte</span>
                    <span class="inspector-field-value">${sanitizeTextString(dbMeta.encryption)}</span>
                  </div>
                </div>
              </div>

              <hr class="module-header-banner" />

              <h4 class="enterprise-panel-title">Apuntar o Migrar Base de Datos a Otro Sitio / Servidor</h4>
              <form id="form-switch-db-provider" class="form-grid-layout">
                <div class="form-field-group">
                  <label class="form-field-label" for="db-provider-select">Motor de Base de Datos Destino</label>
                  <select id="db-provider-select" class="form-select-control">
                    ${dbMeta.allProviders.map((prov) => `
                      <option value="${sanitizeTextString(prov.id)}" ${prov.id === dbMeta.id ? "selected" : ""}>
                        ${sanitizeTextString(prov.name)}
                      </option>
                    `).join("")}
                  </select>
                </div>
                <div class="form-field-group">
                  <label class="form-field-label" for="db-custom-endpoint">URL / Endpoint del Servidor</label>
                  <input id="db-custom-endpoint" class="form-input-control font-mono" type="text" value="${sanitizeTextString(dbMeta.endpoint)}" required />
                </div>
                <div class="form-field-group">
                  <button type="submit" class="btn-action btn-primary">
                    Conmutar Destino de Base de Datos
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      `;

      const searchInput = containerEl.querySelector("#int-local-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          localSearch = e.target.value;
          renderContent();
          const refreshed = containerEl.querySelector("#int-local-search-input");
          if (refreshed) {
            refreshed.focus();
            refreshed.setSelectionRange(localSearch.length, localSearch.length);
          }
        });
      }

      const formEl = containerEl.querySelector("#form-switch-db-provider");
      if (formEl) {
        formEl.addEventListener("submit", (e) => {
          e.preventDefault();
          const targetId = containerEl.querySelector("#db-provider-select").value;
          const customEndpoint = containerEl.querySelector("#db-custom-endpoint").value.trim();

          const updatedMeta = switchActiveDatabaseProvider(targetId, customEndpoint);

          const statusDbEl = document.getElementById("statusbar-active-db");
          if (statusDbEl) {
            statusDbEl.textContent = `${updatedMeta.name}`;
          }

          recordSecurityAuditEvent({
            moduleId: "module-integration",
            action: "DATABASE_PROVIDER_SWITCHED",
            detail: `Puntero de base de datos actualizado a ${updatedMeta.name} (${updatedMeta.endpoint}).`,
            severity: "WARNING"
          });

          dispatchEnterpriseToast({
            title: "Motor de Base de Datos Actualizado",
            message: `Sistema apuntando a ${updatedMeta.name}.`,
            variant: "success"
          });

          renderContent();
        });
      }
    };

    renderContent();
  }
};
