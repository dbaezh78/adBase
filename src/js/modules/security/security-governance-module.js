/**
 * MÓDULO INDEPENDIENTE 1: SEGURIDAD Y GOBIERNO (T-CODE: SEC01)
 * Núcleo donde cada módulo, submódulo y función se registra, autoriza y audita.
 */

import {
  getAllSecuredRegisteredModules,
  getAllSecuredRegisteredFunctions,
  registerModuleInSecurityKernel,
  toggleModuleSecurityAuthorization
} from "../../security/security-kernel-gatekeeper.js";
import { getSecurityAuditTrail, recordSecurityAuditEvent } from "../../security/audit-trail-logger.js";
import { getAllRoleDefinitions, getActiveUserSecuritySession } from "../../security/role-permission-evaluator.js";
import { renderStatisticsKpiCardsHtml } from "../../statistics/real-time-statistics-calculator.js";
import { sanitizeTextString, highlightSearchMatchSafe } from "../../validators/security-input-sanitizer.js";
import { dispatchEnterpriseToast } from "../../core/ui-notification-dispatcher.js";

export const SecurityGovernanceModule = {
  id: "security",
  tCode: "SEC01",
  name: "Seguridad y Gobierno",
  category: "GOBIERNO Y SEGURIDAD",
  templatePath: "./src/html/modules/security-governance-view.html",
  requiredPermission: "SEC_GOVERNANCE_VIEW",
  exportedFunctions: [
    "registerNewExternalModuleInSecurity",
    "evaluateModuleAccessPolicy",
    "inspectImmutableAuditTrail",
    "enforceZeroTrustSession"
  ],

  async renderModuleWorkspace(containerEl, { searchQuery = "" } = {}) {
    let localSearch = searchQuery;
    let selectedAuditRecord = null;

    const renderContent = () => {
      const registeredModules = getAllSecuredRegisteredModules();
      const registeredFunctions = getAllSecuredRegisteredFunctions();
      const auditTrail = getSecurityAuditTrail();
      const roles = getAllRoleDefinitions();
      const activeSession = getActiveUserSecuritySession();

      const cleanSearch = String(localSearch || "").trim().toLowerCase();

      const filteredModules = registeredModules.filter((m) =>
        !cleanSearch || `${m.id} ${m.tCode} ${m.name} ${m.requiredPermission} ${m.securityStatus}`.toLowerCase().includes(cleanSearch)
      );

      const filteredAudits = auditTrail.filter((a) =>
        !cleanSearch || `${a.id} ${a.actor} ${a.moduleId} ${a.action} ${a.detail} ${a.integrityHash}`.toLowerCase().includes(cleanSearch)
      );

      if (!selectedAuditRecord || !filteredAudits.some((a) => a.id === selectedAuditRecord.id)) {
        selectedAuditRecord = filteredAudits[0] || auditTrail[0];
      }

      const authorizedCount = filteredModules.filter((m) => m.securityStatus === "AUTORIZADO_POR_SEGURIDAD").length;

      const kpisHtml = renderStatisticsKpiCardsHtml([
        {
          label: "Módulos Integrados en Seguridad",
          value: `${filteredModules.length} / ${registeredModules.length}`,
          badge: "ACOPLADOS",
          subtitle: `${authorizedCount} autorizados activos`,
          trend: "100% Independientes",
          accent: "success",
          progressPct: (filteredModules.length / Math.max(1, registeredModules.length)) * 100
        },
        {
          label: "Funciones Independientes Protegidas",
          value: `${registeredFunctions.length}`,
          badge: "ZERO-TRUST",
          subtitle: "Verificadas por llamada",
          trend: "Aislamiento Total",
          accent: "info",
          progressPct: 100
        },
        {
          label: "Eventos de Auditoría Poblados",
          value: `${filteredAudits.length}`,
          badge: "SHA-256",
          subtitle: `Sesión: ${activeSession.username}`,
          trend: `Rol: ${activeSession.erpRole}`,
          accent: "purple",
          progressPct: 90
        },
        {
          label: "Perfiles RBAC / Windows AD",
          value: `${roles.length} Roles`,
          badge: "RBAC + AD",
          subtitle: "Mapeo directo a Grupos AD",
          trend: "TLS 1.3 Activo",
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
              id="sec-local-search-input"
              class="module-search-input"
              placeholder="Buscar módulos acoplados, permisos RBAC, hashes SHA-256 o eventos de auditoría..."
              value="${sanitizeTextString(localSearch)}"
            />
          </div>
          <div class="module-toolbar-actions">
            <span class="badge-pill badge-success">Usuario Activo: ${sanitizeTextString(activeSession.username)}</span>
            <span class="badge-pill badge-info">Rol: ${sanitizeTextString(activeSession.erpRole)}</span>
          </div>
        </div>

        <div class="workspace-split-layout">
          <!-- Matriz de Módulos Acoplados desde Seguridad -->
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Matriz de Módulos Acoplados en el Núcleo de Seguridad (${filteredModules.length})</h3>
              <span class="badge-pill badge-info">Control de Autorización</span>
            </div>
            <div class="table-scroll-container">
              <table class="accounting-table">
                <thead>
                  <tr>
                    <th>T-Code</th>
                    <th>Módulo Independiente</th>
                    <th>Permiso Requerido</th>
                    <th>Funciones</th>
                    <th>Estado en Seguridad</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredModules.map((mod) => `
                    <tr>
                      <td class="font-mono"><strong>${highlightSearchMatchSafe(mod.tCode, localSearch)}</strong></td>
                      <td>${highlightSearchMatchSafe(mod.name, localSearch)}</td>
                      <td class="font-mono">${highlightSearchMatchSafe(mod.requiredPermission, localSearch)}</td>
                      <td class="col-numeric">${mod.registeredFunctionsCount}</td>
                      <td>
                        <span class="badge-pill ${mod.securityStatus === "AUTORIZADO_POR_SEGURIDAD" ? "badge-success" : "badge-danger"}">
                          ${sanitizeTextString(mod.securityStatus)}
                        </span>
                      </td>
                      <td>
                        ${mod.id === "security"
                          ? '<span class="badge-pill badge-purple">NÚCLEO</span>'
                          : `<button type="button" class="btn-action btn-secondary btn-xs btn-toggle-mod-sec" data-target-mod="${sanitizeTextString(mod.id)}">
                              ${mod.securityStatus === "AUTORIZADO_POR_SEGURIDAD" ? "Suspender" : "Autorizar"}
                             </button>`
                        }
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Formulario para Integrar un Nuevo Componente desde Seguridad + Inspector -->
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Integrar Nuevo Módulo o Servicio desde Seguridad</h3>
              <span class="badge-pill badge-success">REGISTRO OBLIGATORIO</span>
            </div>
            <div class="enterprise-panel-body">
              <form id="form-register-security-module" class="form-grid-layout">
                <div class="form-field-group">
                  <label class="form-field-label" for="sec-new-mod-id">ID del Módulo</label>
                  <input id="sec-new-mod-id" class="form-input-control" type="text" placeholder="ej. fixed-assets" required />
                </div>
                <div class="form-field-group">
                  <label class="form-field-label" for="sec-new-mod-tcode">Código Transacción (T-Code)</label>
                  <input id="sec-new-mod-tcode" class="form-input-control font-mono" type="text" placeholder="ej. AF01" required />
                </div>
                <div class="form-field-group">
                  <label class="form-field-label" for="sec-new-mod-name">Nombre Descriptivo</label>
                  <input id="sec-new-mod-name" class="form-input-control" type="text" placeholder="ej. Activos Fijos y Depreciación" required />
                </div>
                <div class="form-field-group">
                  <label class="form-field-label" for="sec-new-mod-perm">Permiso de Seguridad</label>
                  <input id="sec-new-mod-perm" class="form-input-control font-mono" type="text" value="ACC_FIXED_ASSETS_VIEW" required />
                </div>
                <div class="form-field-group">
                  <button type="submit" class="btn-action btn-primary">
                    Autorizar e Integrar en Estructura
                  </button>
                </div>
              </form>

              <hr class="module-header-banner" />

              <div class="search-content-inspector">
                <div class="inspector-header">
                  <strong>Contenido Detallado de Evento de Auditoría Seleccionado</strong>
                  <span class="badge-pill badge-purple">${sanitizeTextString(selectedAuditRecord?.id || "-")}</span>
                </div>
                ${selectedAuditRecord ? `
                  <div class="inspector-field-grid">
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Fecha y Hora</span>
                      <span class="inspector-field-value font-mono">${sanitizeTextString(selectedAuditRecord.timestamp)}</span>
                    </div>
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Actor / Cuenta AD</span>
                      <span class="inspector-field-value font-mono">${sanitizeTextString(selectedAuditRecord.actor)}</span>
                    </div>
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Acción Ejecutada</span>
                      <span class="inspector-field-value">${sanitizeTextString(selectedAuditRecord.action)}</span>
                    </div>
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Hash Criptográfico</span>
                      <span class="inspector-field-value font-mono">${sanitizeTextString(selectedAuditRecord.integrityHash)}</span>
                    </div>
                  </div>
                  <div class="inspector-field-item">
                    <span class="inspector-field-label">Detalle Completo del Evento</span>
                    <span class="inspector-field-value">${highlightSearchMatchSafe(selectedAuditRecord.detail, localSearch)}</span>
                  </div>
                ` : ""}
              </div>
            </div>
          </div>
        </div>

        <!-- Bitácora Inmutable de Auditoría -->
        <div class="enterprise-panel">
          <div class="enterprise-panel-header">
            <h3 class="enterprise-panel-title">Bitácora Criptográfica de Auditoría en Tiempo Real (Click para mostrar contenido)</h3>
            <span class="badge-pill badge-info">${filteredAudits.length} registros</span>
          </div>
          <div class="table-scroll-container">
            <table class="accounting-table">
              <thead>
                <tr>
                  <th>ID Evento</th>
                  <th>Timestamp</th>
                  <th>Actor (Windows AD)</th>
                  <th>Módulo</th>
                  <th>Acción</th>
                  <th>Detalle</th>
                  <th>Hash Integridad</th>
                </tr>
              </thead>
              <tbody>
                ${filteredAudits.map((aud) => `
                  <tr class="audit-row-item ${selectedAuditRecord?.id === aud.id ? "is-selected-row" : ""}" data-audit-id="${sanitizeTextString(aud.id)}">
                    <td class="font-mono">${highlightSearchMatchSafe(aud.id, localSearch)}</td>
                    <td class="font-mono">${sanitizeTextString(aud.timestamp)}</td>
                    <td class="font-mono">${highlightSearchMatchSafe(aud.actor, localSearch)}</td>
                    <td><span class="badge-pill badge-info">${sanitizeTextString(aud.moduleId)}</span></td>
                    <td class="font-mono">${highlightSearchMatchSafe(aud.action, localSearch)}</td>
                    <td>${highlightSearchMatchSafe(aud.detail, localSearch)}</td>
                    <td class="font-mono">${highlightSearchMatchSafe(aud.integrityHash, localSearch)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;

      const searchInputEl = containerEl.querySelector("#sec-local-search-input");
      if (searchInputEl) {
        searchInputEl.addEventListener("input", (e) => {
          localSearch = e.target.value;
          renderContent();
          const refreshedInput = containerEl.querySelector("#sec-local-search-input");
          if (refreshedInput) {
            refreshedInput.focus();
            refreshedInput.setSelectionRange(localSearch.length, localSearch.length);
          }
        });
      }

      containerEl.querySelectorAll(".btn-toggle-mod-sec").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetId = btn.getAttribute("data-target-mod");
          const updated = toggleModuleSecurityAuthorization(targetId);
          if (updated) {
            dispatchEnterpriseToast({
              title: "Política de Seguridad Actualizada",
              message: `Módulo ${updated.name}: ${updated.securityStatus}`,
              variant: updated.securityStatus === "AUTORIZADO_POR_SEGURIDAD" ? "success" : "warning"
            });
            renderContent();
          }
        });
      });

      containerEl.querySelectorAll(".audit-row-item").forEach((row) => {
        row.addEventListener("click", () => {
          const id = row.getAttribute("data-audit-id");
          selectedAuditRecord = filteredAudits.find((a) => a.id === id) || selectedAuditRecord;
          renderContent();
        });
      });

      const formEl = containerEl.querySelector("#form-register-security-module");
      if (formEl) {
        formEl.addEventListener("submit", (e) => {
          e.preventDefault();
          const newId = containerEl.querySelector("#sec-new-mod-id").value.trim();
          const newTCode = containerEl.querySelector("#sec-new-mod-tcode").value.trim().toUpperCase();
          const newName = containerEl.querySelector("#sec-new-mod-name").value.trim();
          const newPerm = containerEl.querySelector("#sec-new-mod-perm").value.trim().toUpperCase();

          registerModuleInSecurityKernel({
            id: newId,
            tCode: newTCode,
            name: newName,
            category: "EXTENSIÓN CORPORATIVA",
            requiredPermission: newPerm,
            exportedFunctions: ["initModule", "queryData", "computeStats"]
          });

          recordSecurityAuditEvent({
            moduleId: "security",
            action: "NEW_MODULE_INTEGRATED",
            detail: `Nuevo módulo independiente '${newName}' (${newTCode}) integrado desde el Módulo de Seguridad.`,
            severity: "SUCCESS"
          });

          dispatchEnterpriseToast({
            title: "Módulo Integrado desde Seguridad",
            message: `${newName} (${newTCode}) fue autorizado en la estructura del sistema.`,
            variant: "success"
          });
          renderContent();
        });
      }
    };

    renderContent();
  }
};
