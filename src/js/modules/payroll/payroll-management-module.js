/**
 * MÓDULO INDEPENDIENTE 10: NÓMINA Y CAPITAL HUMANO (T-CODE: NOM01)
 * Cálculo autónomo de sueldos, horas extras, seguridad social, impuesto sobre la renta,
 * aportes patronales y emisión de póliza contable desacoplada.
 */

import {
  getCollectionRecords,
  insertOrUpdateCollectionRecord
} from "../../database/database-provider-adapter.js";
import { publishSystemEvent } from "../../core/event-bus-dispatcher.js";
import { recordSecurityAuditEvent } from "../../security/audit-trail-logger.js";
import { renderStatisticsKpiCardsHtml } from "../../statistics/real-time-statistics-calculator.js";
import { formatCurrencyAmount } from "../../formatters/currency-and-number-formatter.js";
import { sanitizeTextString, highlightSearchMatchSafe } from "../../validators/security-input-sanitizer.js";
import { dispatchEnterpriseToast } from "../../core/ui-notification-dispatcher.js";

export const PayrollManagementModule = {
  id: "payroll",
  tCode: "NOM01",
  name: "Nómina y RRHH",
  category: "MÓDULOS OPERATIVOS",
  templatePath: "./src/html/modules/payroll-management-view.html",
  requiredPermission: "OPS_PAYROLL_VIEW",
  exportedFunctions: [
    "calculateEmployeePayslipBreakdown",
    "executePayrollRunAndEmitAccountingEvent",
    "registerNewPayrollCollaborator"
  ],

  async renderModuleWorkspace(containerEl, { searchQuery = "" } = {}) {
    let localSearch = searchQuery;
    let selectedEmployee = null;

    const renderContent = () => {
      const allEmployees = getCollectionRecords("payrollEmployees");
      const cleanSearch = String(localSearch || "").trim().toLowerCase();

      const filteredEmployees = allEmployees.filter((emp) =>
        !cleanSearch ||
        `${emp.code} ${emp.fullName} ${emp.adSamAccount} ${emp.department} ${emp.position}`.toLowerCase().includes(cleanSearch)
      );

      if (!selectedEmployee || !filteredEmployees.some((e) => e.id === selectedEmployee.id)) {
        selectedEmployee = filteredEmployees[0] || allEmployees[0];
      }

      const sumGross = filteredEmployees.reduce((s, e) => s + (Number(e.baseSalary) || 0) + (Number(e.overtimeBonus) || 0), 0);
      const sumDeductions = filteredEmployees.reduce((s, e) => s + (Number(e.socialSecurityDeduction) || 0) + (Number(e.incomeTaxDeduction) || 0), 0);
      const sumEmployer = filteredEmployees.reduce((s, e) => s + (Number(e.employerContribution) || 0), 0);
      const sumNetPay = filteredEmployees.reduce((s, e) => s + (Number(e.netPay) || 0), 0);

      const kpisHtml = renderStatisticsKpiCardsHtml([
        {
          label: "Colaboradores Poblados",
          value: `${filteredEmployees.length} / ${allEmployees.length}`,
          badge: "NÓMINA ACTIVA",
          subtitle: "Vinculados a Windows AD",
          trend: "100% Activos",
          accent: "info",
          progressPct: (filteredEmployees.length / Math.max(1, allEmployees.length)) * 100
        },
        {
          label: "Masa Salarial Bruta",
          value: formatCurrencyAmount(sumGross),
          badge: "DEVENGADO",
          subtitle: `Cargas Patronales: ${formatCurrencyAmount(sumEmployer)}`,
          trend: "Cálculo Exacto",
          accent: "purple",
          progressPct: 90
        },
        {
          label: "Retenciones Ley (TSS / ISR)",
          value: formatCurrencyAmount(sumDeductions),
          badge: "DEDUCCIONES",
          subtitle: "Seguridad Social + Impuesto Renta",
          trend: "Pasivo 2.1.03",
          accent: "warning",
          progressPct: 75
        },
        {
          label: "Neto a Dispersar en Banco",
          value: formatCurrencyAmount(sumNetPay),
          badge: "DISPERSIÓN",
          subtitle: "Transferencia Cuenta 1.1.02",
          trend: "Listo para Pago",
          accent: "success",
          progressPct: 100
        }
      ]);

      containerEl.innerHTML = `
        <div class="stats-kpi-grid">${kpisHtml}</div>

        <div class="module-filter-bar">
          <div class="filter-input-group">
            <input
              type="search"
              id="nom-local-search-input"
              class="module-search-input"
              placeholder="Buscar colaborador por código (EMP-101), nombre, departamento, cargo o cuenta Windows AD..."
              value="${sanitizeTextString(localSearch)}"
            />
          </div>
          <div class="module-toolbar-actions">
            <button type="button" id="btn-run-payroll-dispersion" class="btn-action btn-primary">
              Liquidar Nómina General y Contabilizar Póliza Automática
            </button>
          </div>
        </div>

        <div class="workspace-split-layout">
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Planilla General de Nómina (${filteredEmployees.length} colaboradores)</h3>
              <span class="badge-pill badge-info">Click para ver volante de pago detallado</span>
            </div>
            <div class="table-scroll-container">
              <table class="accounting-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Colaborador</th>
                    <th>Departamento</th>
                    <th class="col-numeric">Sueldo Base</th>
                    <th class="col-numeric">Bonos/Extras</th>
                    <th class="col-numeric">Retenciones</th>
                    <th class="col-numeric">Neto a Pagar</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredEmployees.map((emp) => {
                    const ret = (Number(emp.socialSecurityDeduction) || 0) + (Number(emp.incomeTaxDeduction) || 0);
                    return `
                      <tr class="emp-row-item ${selectedEmployee?.id === emp.id ? "is-selected-row" : ""}" data-emp-id="${sanitizeTextString(emp.id)}">
                        <td class="font-mono"><strong>${highlightSearchMatchSafe(emp.code, localSearch)}</strong></td>
                        <td>${highlightSearchMatchSafe(emp.fullName, localSearch)}</td>
                        <td>${highlightSearchMatchSafe(emp.department, localSearch)}</td>
                        <td class="col-numeric font-mono">${formatCurrencyAmount(emp.baseSalary)}</td>
                        <td class="col-numeric font-mono">${formatCurrencyAmount(emp.overtimeBonus)}</td>
                        <td class="col-numeric col-negative">-${formatCurrencyAmount(ret)}</td>
                        <td class="col-numeric col-positive">${formatCurrencyAmount(emp.netPay)}</td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Contenido de Volante de Pago &amp; Alta de Colaborador</h3>
              <span class="badge-pill badge-purple">${sanitizeTextString(selectedEmployee?.code || "-")}</span>
            </div>
            <div class="enterprise-panel-body">
              ${selectedEmployee ? `
                <div class="search-content-inspector">
                  <div class="inspector-header">
                    <strong>${sanitizeTextString(selectedEmployee.fullName)} (${sanitizeTextString(selectedEmployee.position)})</strong>
                    <span class="badge-pill badge-success">${sanitizeTextString(selectedEmployee.adSamAccount)}</span>
                  </div>
                  <div class="inspector-field-grid">
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Sueldo Bruto + Bonos</span>
                      <span class="inspector-field-value font-mono">${formatCurrencyAmount(Number(selectedEmployee.baseSalary) + Number(selectedEmployee.overtimeBonus))}</span>
                    </div>
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Seguridad Social (5.91%)</span>
                      <span class="inspector-field-value font-mono col-negative">-${formatCurrencyAmount(selectedEmployee.socialSecurityDeduction)}</span>
                    </div>
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Retención ISR</span>
                      <span class="inspector-field-value font-mono col-negative">-${formatCurrencyAmount(selectedEmployee.incomeTaxDeduction)}</span>
                    </div>
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Aporte Patronal Empresa</span>
                      <span class="inspector-field-value font-mono">${formatCurrencyAmount(selectedEmployee.employerContribution)}</span>
                    </div>
                  </div>
                  <div class="journal-balance-bar is-balanced">
                    <strong>SALARIO NETO LIQUIDADO:</strong>
                    <span class="font-mono col-positive"><strong>${formatCurrencyAmount(selectedEmployee.netPay)}</strong></span>
                  </div>
                </div>
              ` : ""}

              <hr class="module-header-banner" />

              <h4 class="enterprise-panel-title">Incorporar Colaborador al Módulo Independiente de Nómina</h4>
              <form id="form-add-employee" class="form-grid-layout">
                <div class="form-field-group">
                  <label class="form-field-label" for="nom-emp-name">Nombre Completo</label>
                  <input id="nom-emp-name" class="form-input-control" type="text" placeholder="ej. Sofía Herrera" required />
                </div>
                <div class="form-field-group">
                  <label class="form-field-label" for="nom-emp-pos">Cargo / Posición</label>
                  <input id="nom-emp-pos" class="form-input-control" type="text" placeholder="ej. Analista de Tesorería" required />
                </div>
                <div class="form-field-group">
                  <label class="form-field-label" for="nom-emp-salary">Sueldo Base Mensual USD</label>
                  <input id="nom-emp-salary" class="form-input-control font-mono" type="number" step="0.01" value="3800.00" required />
                </div>
                <div class="form-field-group">
                  <button type="submit" class="btn-action btn-success">
                    Calcular Retenciones y Registrar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      `;

      const searchInput = containerEl.querySelector("#nom-local-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          localSearch = e.target.value;
          renderContent();
          const refreshed = containerEl.querySelector("#nom-local-search-input");
          if (refreshed) {
            refreshed.focus();
            refreshed.setSelectionRange(localSearch.length, localSearch.length);
          }
        });
      }

      containerEl.querySelectorAll(".emp-row-item").forEach((row) => {
        row.addEventListener("click", () => {
          const id = row.getAttribute("data-emp-id");
          selectedEmployee = filteredEmployees.find((e) => e.id === id) || selectedEmployee;
          renderContent();
        });
      });

      const runBtn = containerEl.querySelector("#btn-run-payroll-dispersion");
      if (runBtn) {
        runBtn.addEventListener("click", async () => {
          const totalExpense = Math.round((sumGross + sumEmployer) * 100) / 100;
          const totalLiabilities = Math.round((sumDeductions + sumEmployer) * 100) / 100;
          const totalBankNet = Math.round((totalExpense - totalLiabilities) * 100) / 100;

          const payload = {
            runId: `NOM-${Date.now().toString().slice(-5)}`,
            totalExpense,
            totalBankNet,
            totalLiabilities,
            employeesCount: filteredEmployees.length,
            generatedJournalNumber: null
          };

          await publishSystemEvent("PAYROLL_RUN_APPROVED", payload);

          recordSecurityAuditEvent({
            moduleId: "payroll",
            action: "PAYROLL_DISPERSION_POSTED",
            detail: `Nómina liquidada (${filteredEmployees.length} empleados) por ${formatCurrencyAmount(totalExpense)}. Asiento generado: ${payload.generatedJournalNumber || "AST-NOMINA"}.`,
            severity: "SUCCESS"
          });

          dispatchEnterpriseToast({
            title: "Nómina Liquidada y Contabilizada",
            message: `Póliza ${payload.generatedJournalNumber || "Automática"} registrada por ${formatCurrencyAmount(totalExpense)}.`,
            variant: "success"
          });

          renderContent();
        });
      }

      const formEl = containerEl.querySelector("#form-add-employee");
      if (formEl) {
        formEl.addEventListener("submit", async (e) => {
          e.preventDefault();
          const fullName = containerEl.querySelector("#nom-emp-name").value.trim();
          const position = containerEl.querySelector("#nom-emp-pos").value.trim();
          const baseSalary = Number(containerEl.querySelector("#nom-emp-salary").value) || 0;

          const ssDeduction = Math.round(baseSalary * 0.0591 * 100) / 100;
          const isrDeduction = Math.round(baseSalary * 0.095 * 100) / 100;
          const empContrib = Math.round(baseSalary * 0.141 * 100) / 100;
          const netPay = Math.round((baseSalary - ssDeduction - isrDeduction) * 100) / 100;
          const code = `EMP-${100 + allEmployees.length + 1}`;

          const newEmp = {
            id: code,
            code,
            fullName,
            adSamAccount: `CORP\\${fullName.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8)}`,
            department: "Finanzas y Operaciones",
            position,
            baseSalary,
            overtimeBonus: 0,
            socialSecurityDeduction: ssDeduction,
            incomeTaxDeduction: isrDeduction,
            employerContribution: empContrib,
            netPay,
            status: "ACTIVO"
          };

          await insertOrUpdateCollectionRecord("payrollEmployees", newEmp);
          selectedEmployee = newEmp;

          dispatchEnterpriseToast({
            title: "Colaborador Registrado en Nómina",
            message: `${code} - ${fullName} incorporado con salario neto ${formatCurrencyAmount(netPay)}.`,
            variant: "success"
          });

          renderContent();
        });
      }
    };

    renderContent();
  }
};
