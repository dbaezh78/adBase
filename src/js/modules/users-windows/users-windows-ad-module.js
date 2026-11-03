/**
 * MÓDULO INDEPENDIENTE 2: USUARIOS E INTEGRACIÓN CON SERVIDORES WINDOWS (T-CODE: USR01)
 * Gestión de identidades corporativas, extracción real de usuarios desde LDAP (172.16.4.2:389)
 * y RADIUS (172.16.4.3:1812), y asignación directa de Grupos de Permisos por Departamento.
 */

import { getCollectionRecords, getActiveCompanyRecord } from "../../database/database-provider-adapter.js";
import {
  getWindowsServerDirectoryStatus,
  executeWindowsActiveDirectorySync
} from "../../security/windows-server-ad-connector.js";
import {
  switchActiveUserSecuritySession,
  getActiveUserSecuritySession
} from "../../security/role-permission-evaluator.js";
import {
  getDepartmentsList,
  getPermissionGroupsList,
  getPermissionGroupById,
  assignPermissionGroupToUser,
  registerFetchedAdOrRadiusUserWithPermissions
} from "../../security/modular-permissions-and-departments-service.js";
import {
  getAuthConnectionConfigurations,
  saveAuthConnectionConfigurations,
  syncCompanyAuthTelemetryToShell,
  fetchAndAuthenticateUserFromLdapGateway,
  fetchAndAuthenticateUserFromRadiusGateway
} from "../../security/connection-auth-providers-service.js";
import { renderStatisticsKpiCardsHtml } from "../../statistics/real-time-statistics-calculator.js";
import { sanitizeTextString, highlightSearchMatchSafe } from "../../validators/security-input-sanitizer.js";
import { dispatchEnterpriseToast } from "../../core/ui-notification-dispatcher.js";

export const UsersWindowsAdModule = {
  id: "users-windows",
  tCode: "USR01",
  name: "Usuarios y Windows AD",
  category: "GOBIERNO Y SEGURIDAD",
  templatePath: "./src/html/modules/users-windows-ad-view.html",
  requiredPermission: "USR_WINDOWS_AD_VIEW",
  exportedFunctions: [
    "syncWindowsServerActiveDirectory",
    "provisionDomainUserAccount",
    "mapAdGroupToErpRole",
    "validateKerberosTicketSession"
  ],

  async renderModuleWorkspace(containerEl, { searchQuery = "" } = {}) {
    let localSearch = searchQuery;
    let selectedUserRecord = null;
    let fetchedUserDraft = null;

    const renderContent = () => {
      const activeCompany = getActiveCompanyRecord();
      const companyAuthCfg = getAuthConnectionConfigurations(activeCompany?.id);
      const isWinConnectorEnabled = Boolean(companyAuthCfg.windowsConnectorEnabled);
      const allAdUsers = getCollectionRecords("windowsAdUsers");
      const adStatus = getWindowsServerDirectoryStatus();
      const activeSession = getActiveUserSecuritySession();
      const departments = getDepartmentsList();
      const permissionGroups = getPermissionGroupsList();
      const cleanSearch = String(localSearch || "").trim().toLowerCase();

      const filteredUsers = allAdUsers.filter((u) =>
        !cleanSearch || `${u.username} ${u.fullName} ${u.email} ${u.organizationalUnit} ${u.adGroup} ${u.erpRole} ${u.permissionGroupName || ""} ${u.departmentName || ""} ${u.authProtocol}`.toLowerCase().includes(cleanSearch)
      );

      if (!selectedUserRecord || !filteredUsers.some((u) => u.id === selectedUserRecord.id)) {
        selectedUserRecord = filteredUsers[0] || allAdUsers[0];
      } else {
        selectedUserRecord = allAdUsers.find((u) => u.id === selectedUserRecord.id) || selectedUserRecord;
      }

      const mfaPct = filteredUsers.length > 0
        ? (filteredUsers.filter((u) => u.mfaEnabled).length / filteredUsers.length) * 100
        : 0;

      const kpisHtml = renderStatisticsKpiCardsHtml([
        {
          label: "Usuarios Poblados en Plataforma",
          value: `${filteredUsers.length} / ${allAdUsers.length}`,
          badge: isWinConnectorEnabled ? "SAMAccountName" : "LOCAL / OAUTH",
          subtitle: `Empresa activa: ${activeCompany?.nombreComercial || "-"}`,
          trend: isWinConnectorEnabled ? `Dominio: ${adStatus.config.domainName}` : "Directorio Independiente",
          accent: "info",
          progressPct: (filteredUsers.length / Math.max(1, allAdUsers.length)) * 100
        },
        {
          label: `Conector Windows (${activeCompany?.nombreComercial || "Empresa"})`,
          value: isWinConnectorEnabled ? "LDAP + RADIUS Activo" : "Modo Autónomo (Sin AD)",
          badge: isWinConnectorEnabled ? `${companyAuthCfg.ldap.serverIpName}` : "LOCAL / OAUTH",
          subtitle: isWinConnectorEnabled
            ? `DC01 (${companyAuthCfg.ldap.serverIpName}:389) y NPS (${companyAuthCfg.radius.ipAddress}:1812)`
            : "Conector Windows Server desactivado para esta empresa",
          trend: isWinConnectorEnabled ? "Segmentado a esta Empresa" : "Aislamiento Multi-Empresa",
          accent: isWinConnectorEnabled ? "success" : "warning",
          progressPct: 100
        },
        {
          label: "Departamentos y Grupos",
          value: `${permissionGroups.length} Grupos`,
          badge: `${departments.length} DEPTOS`,
          subtitle: "Permisos modulares asignados por usuario",
          trend: "Granular 13 Módulos",
          accent: "purple",
          progressPct: mfaPct
        },
        {
          label: "Sesión Activa & Permisos",
          value: activeSession.username,
          badge: activeSession.permissionGroupName || activeSession.erpRole,
          subtitle: `Depto: ${activeSession.departmentName || activeSession.adGroup}`,
          trend: isWinConnectorEnabled ? "Ticket Kerberos / RADIUS Válido" : "Sesión Local / OAuth Activa",
          accent: "warning",
          progressPct: 100
        }
      ]);

      const selectedUserGroup = selectedUserRecord
        ? getPermissionGroupById(selectedUserRecord.assignedPermissionGroupId || "GRP-ADMIN")
        : null;

      containerEl.innerHTML = `
        <div class="stats-kpi-grid">${kpisHtml}</div>

        <div class="company-connector-segmentation-banner ${isWinConnectorEnabled ? "" : "is-standalone-mode"}">
          <div class="company-connector-banner-left">
            <img
              src="${sanitizeTextString(activeCompany?.logoUrl || "./src/img/logos/easy-data-accounting-brand-logo.jpg")}"
              alt="Logo Empresa"
              class="company-logo-preview-thumb"
            />
            <div class="company-connector-banner-info">
              <div class="company-connector-banner-title">
                <span>Empresa Activa: <strong>${sanitizeTextString(activeCompany?.nombreComercial || "-")} (RNC: ${sanitizeTextString(activeCompany?.rnc || "-")})</strong></span>
                <span class="badge-pill ${isWinConnectorEnabled ? "badge-success" : "badge-warning"}">
                  ${isWinConnectorEnabled ? "CONECTOR WINDOWS SERVER (LDAP / RADIUS) ACTIVO" : "EMPRESA AUTÓNOMA (SIN LDAP / RADIUS)"}
                </span>
              </div>
              <span class="company-connector-banner-desc">
                El conector de Windows Server está segmentado por empresa. Si una empresa que compra o alquila la aplicación no desea usar LDAP o RADIUS, funciona de forma 100% independiente.
              </span>
            </div>
          </div>
          <div class="company-connector-banner-actions">
            <div class="protocol-control-inline">
              <label class="erp-toggle-switch" title="Habilitar o desactivar el conector Windows Server para esta empresa">
                <input type="checkbox" id="usr-toggle-company-win-connector" ${isWinConnectorEnabled ? "checked" : ""} />
                <span class="erp-toggle-slider"></span>
              </label>
              <span class="protocol-form-label">
                ${isWinConnectorEnabled ? "Conector Windows Server Habilitado" : "Habilitar Conector Windows Server"}
              </span>
            </div>
          </div>
        </div>

        <div class="module-filter-bar">
          <div class="filter-input-group">
            <input
              type="search"
              id="usr-local-search-input"
              class="module-search-input"
              placeholder="Buscar usuarios por cuenta Windows (laantillana\\...), nombre, departamento, grupo de permisos o protocolo..."
              value="${sanitizeTextString(localSearch)}"
            />
          </div>
          <div class="module-toolbar-actions">
            <button type="button" id="btn-sync-windows-dc" class="btn-action btn-primary">
              Sincronizar Directorio LDAP / RADIUS
            </button>
          </div>
        </div>

        <div class="workspace-split-layout">
          <!-- Tabla de Usuarios del Dominio Windows y Grupos de Permisos -->
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Usuarios Integrados con Permisos por Departamento (${filteredUsers.length})</h3>
              <span class="badge-pill badge-info">Click en fila para inspeccionar y asignar grupo</span>
            </div>
            <div class="table-scroll-container">
              <table class="accounting-table">
                <thead>
                  <tr>
                    <th>Cuenta (LDAP / RADIUS)</th>
                    <th>Nombre Completo</th>
                    <th>Departamento</th>
                    <th>Permisos que Usa (Grupo)</th>
                    <th>Protocolo</th>
                    <th>Sesión</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredUsers.map((usr) => {
                    const grp = getPermissionGroupById(usr.assignedPermissionGroupId || "GRP-ADMIN");
                    const deptName = usr.departmentName || departments.find((d) => d.id === grp?.departmentId)?.name || usr.adGroup;
                    return `
                      <tr class="ad-user-row ${selectedUserRecord?.id === usr.id ? "is-selected-row" : ""}" data-user-id="${sanitizeTextString(usr.id)}">
                        <td class="font-mono"><strong>${highlightSearchMatchSafe(usr.username, localSearch)}</strong></td>
                        <td>${highlightSearchMatchSafe(usr.fullName, localSearch)}</td>
                        <td><span class="badge-pill badge-info">${highlightSearchMatchSafe(deptName, localSearch)}</span></td>
                        <td><span class="badge-pill badge-purple">${highlightSearchMatchSafe(usr.permissionGroupName || grp?.name || usr.erpRole, localSearch)}</span></td>
                        <td><span class="badge-pill badge-success">${sanitizeTextString(usr.authProtocol)}</span></td>
                        <td>
                          <button type="button" class="btn-action btn-secondary btn-xs btn-switch-session" data-switch-id="${sanitizeTextString(usr.id)}">
                            ${activeSession.username === usr.username ? "Sesión Actual" : "Probar Permisos"}
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Inspector + Asignación de Permisos del Grupo + Traer Usuario desde LDAP / RADIUS -->
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Asignación de Permisos &amp; Extracción LDAP / RADIUS</h3>
              <span class="badge-pill badge-success">172.16.4.2 / 172.16.4.3</span>
            </div>
            <div class="enterprise-panel-body">
              ${selectedUserRecord ? `
                <div class="search-content-inspector">
                  <div class="inspector-header">
                    <strong class="font-mono">${sanitizeTextString(selectedUserRecord.username)}</strong>
                    <span class="badge-pill badge-info">${sanitizeTextString(selectedUserRecord.authProtocol || selectedUserRecord.status)}</span>
                  </div>
                  <div class="inspector-field-grid">
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Nombre Completo</span>
                      <span class="inspector-field-value">${sanitizeTextString(selectedUserRecord.fullName)}</span>
                    </div>
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Correo Corporativo</span>
                      <span class="inspector-field-value font-mono">${sanitizeTextString(selectedUserRecord.email)}</span>
                    </div>
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Departamento Asignado</span>
                      <span class="inspector-field-value">${sanitizeTextString(selectedUserRecord.departmentName || "Dirección General / TI")}</span>
                    </div>
                    <div class="inspector-field-item">
                      <span class="inspector-field-label">Grupo de Permisos que Usa</span>
                      <span class="inspector-field-value"><strong>${sanitizeTextString(selectedUserRecord.permissionGroupName || selectedUserGroup?.name || selectedUserRecord.erpRole)}</strong></span>
                    </div>
                  </div>
                  <div class="inspector-field-item">
                    <span class="inspector-field-label">Distinguished Name (DN / Origen AD / RADIUS)</span>
                    <span class="inspector-field-value font-mono">${sanitizeTextString(selectedUserRecord.organizationalUnit)}</span>
                  </div>

                  <form id="form-usr-assign-perm-group" class="form-grid-layout">
                    <div class="form-field-group">
                      <label class="form-field-label" for="usr-select-perm-group">Indicar al Usuario qué Grupo de Permisos Usará</label>
                      <select id="usr-select-perm-group" class="form-select-control">
                        ${permissionGroups.map((grp) => {
                          const dept = departments.find((d) => d.id === grp.departmentId);
                          const isSelected = (selectedUserRecord.assignedPermissionGroupId || "GRP-ADMIN") === grp.id;
                          return `<option value="${sanitizeTextString(grp.id)}" ${isSelected ? "selected" : ""}>[${sanitizeTextString(dept ? dept.name : "Depto")}] — ${sanitizeTextString(grp.name)}</option>`;
                        }).join("")}
                      </select>
                    </div>
                    <div class="form-field-group">
                      <label class="form-field-label">&nbsp;</label>
                      <button type="submit" class="btn-action btn-primary">
                        Aplicar Permisos del Grupo al Usuario
                      </button>
                    </div>
                  </form>
                </div>
              ` : ""}

              <hr class="module-header-banner" />

              <h4 class="enterprise-panel-title">Traer y Autenticar Usuario desde LDAP (172.16.4.2) o RADIUS (172.16.4.3)</h4>
              <form id="form-fetch-ad-radius-user" class="form-grid-layout">
                <div class="form-field-group">
                  <label class="form-field-label" for="usr-fetch-source">Servidor de Origen</label>
                  <select id="usr-fetch-source" class="form-select-control">
                    <option value="LDAP">LDAP Active Directory (DC01 - 172.16.4.2:389)</option>
                    <option value="RADIUS">RADIUS Windows NPS (AC_TIC - 172.16.4.3:1812)</option>
                  </select>
                </div>
                <div class="form-field-group">
                  <label class="form-field-label" for="usr-fetch-account">Cuenta de Usuario (sAMAccountName / Dominio)</label>
                  <input id="usr-fetch-account" class="form-input-control font-mono" type="text" value="laantillana\\dbaezh" placeholder="ej. laantillana\\dbaezh" required />
                </div>
                <div class="form-field-group">
                  <label class="form-field-label" for="usr-fetch-password">Contraseña (Requerida para Autenticar o RADIUS)</label>
                  <input id="usr-fetch-password" class="form-input-control font-mono" type="password" placeholder="Contraseña de dominio del usuario" />
                </div>
                <div class="form-field-group">
                  <label class="form-field-label" for="usr-fetch-perm-group">Permisos que Usará (Grupo por Departamento)</label>
                  <select id="usr-fetch-perm-group" class="form-select-control">
                    ${permissionGroups.map((grp) => {
                      const dept = departments.find((d) => d.id === grp.departmentId);
                      return `<option value="${sanitizeTextString(grp.id)}">[${sanitizeTextString(dept ? dept.name : "Depto")}] — ${sanitizeTextString(grp.name)}</option>`;
                    }).join("")}
                  </select>
                </div>
                <div class="form-field-group">
                  <button type="submit" id="btn-usr-fetch-submit" class="btn-action btn-success">
                    Traer Usuario y Asignar Permisos del Grupo
                  </button>
                </div>
              </form>

              ${fetchedUserDraft ? `
                <div class="ldap-info-banner">
                  <span class="ldap-info-icon">✓</span>
                  <div>
                    <strong>${sanitizeTextString(fetchedUserDraft.displayName)} (${sanitizeTextString(fetchedUserDraft.username)})</strong>
                    — Origen: <span class="font-mono">${sanitizeTextString(fetchedUserDraft.source)}</span> |
                    DN: <span class="font-mono">${sanitizeTextString(fetchedUserDraft.distinguishedName)}</span>
                  </div>
                </div>
              ` : ""}
            </div>
          </div>
        </div>
      `;

      const searchInput = containerEl.querySelector("#usr-local-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          localSearch = e.target.value;
          renderContent();
          const refreshed = containerEl.querySelector("#usr-local-search-input");
          if (refreshed) {
            refreshed.focus();
            refreshed.setSelectionRange(localSearch.length, localSearch.length);
          }
        });
      }

      containerEl.querySelectorAll(".ad-user-row").forEach((row) => {
        row.addEventListener("click", (e) => {
          if (e.target.closest(".btn-switch-session")) {
            return;
          }
          const uid = row.getAttribute("data-user-id");
          selectedUserRecord = filteredUsers.find((u) => u.id === uid) || selectedUserRecord;
          renderContent();
        });
      });

      containerEl.querySelectorAll(".btn-switch-session").forEach((btn) => {
        btn.addEventListener("click", () => {
          const uid = btn.getAttribute("data-switch-id");
          const targetUser = allAdUsers.find((u) => u.id === uid);
          if (targetUser) {
            switchActiveUserSecuritySession(targetUser);
            const headerUserBadge = document.getElementById("header-active-ad-user");
            if (headerUserBadge) {
              headerUserBadge.textContent = `${targetUser.username} (${targetUser.permissionGroupName || targetUser.erpRole})`;
            }
            dispatchEnterpriseToast({
              title: "Sesión y Permisos Activos Cambiados",
              message: `Operando como ${targetUser.username} usando los permisos de "${targetUser.permissionGroupName || targetUser.erpRole}".`,
              variant: "info"
            });
            renderContent();
          }
        });
      });

      const assignForm = containerEl.querySelector("#form-usr-assign-perm-group");
      if (assignForm && selectedUserRecord) {
        assignForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const groupId = containerEl.querySelector("#usr-select-perm-group").value;
          const updated = await assignPermissionGroupToUser({
            userId: selectedUserRecord.id,
            permissionGroupId: groupId
          });
          selectedUserRecord = updated;
          if (activeSession.id === updated.id || activeSession.username === updated.username) {
            switchActiveUserSecuritySession(updated);
            const headerUserBadge = document.getElementById("header-active-ad-user");
            if (headerUserBadge) {
              headerUserBadge.textContent = `${updated.username} (${updated.permissionGroupName})`;
            }
          }
          dispatchEnterpriseToast({
            title: "Permisos del Grupo Asignados al Usuario",
            message: `El usuario ${updated.username} ahora usa los permisos del grupo "${updated.permissionGroupName}" (${updated.departmentName}).`,
            variant: "success"
          });
          renderContent();
        });
      }

      containerEl.querySelector("#usr-toggle-company-win-connector")?.addEventListener("change", (e) => {
        const enableFlag = Boolean(e.target.checked);
        saveAuthConnectionConfigurations(
          {
            windowsConnectorEnabled: enableFlag,
            activeProtocol: enableFlag ? "LDAP" : "LOCAL"
          },
          activeCompany?.id
        );
        syncCompanyAuthTelemetryToShell();
        dispatchEnterpriseToast({
          title: enableFlag
            ? `Windows Server Habilitado en ${activeCompany?.nombreComercial || "Empresa"}`
            : `Windows Server Desactivado en ${activeCompany?.nombreComercial || "Empresa"}`,
          message: enableFlag
            ? "Conector LDAP / RADIUS activado para esta empresa."
            : "Esta empresa opera ahora de forma independiente (LOCAL / OAuth).",
          variant: enableFlag ? "success" : "info"
        });
        renderContent();
      });

      const syncBtn = containerEl.querySelector("#btn-sync-windows-dc");
      if (syncBtn) {
        syncBtn.addEventListener("click", async () => {
          if (!isWinConnectorEnabled) {
            dispatchEnterpriseToast({
              title: "Conector Windows Server Desactivado en esta Empresa",
              message: `La empresa ${activeCompany?.nombreComercial} opera en modo autónomo. Active el interruptor arriba si desea sincronizar con Windows Server.`,
              variant: "warning"
            });
            return;
          }
          const res = await executeWindowsActiveDirectorySync();
          dispatchEnterpriseToast({
            title: "Sincronización Windows Server Exitosa",
            message: `Controlador ${res.domainController} respondió en ${res.latencyMs}ms (${res.syncedUsers} cuentas sincronizadas).`,
            variant: "success"
          });
        });
      }

      const fetchForm = containerEl.querySelector("#form-fetch-ad-radius-user");
      if (fetchForm) {
        fetchForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          if (!isWinConnectorEnabled) {
            dispatchEnterpriseToast({
              title: "Conector Windows Server Desactivado en esta Empresa",
              message: `Habilite primero el conector Windows Server para la empresa ${activeCompany?.nombreComercial || "actual"}.`,
              variant: "warning"
            });
            return;
          }

          const source = containerEl.querySelector("#usr-fetch-source").value;
          const targetUsername = containerEl.querySelector("#usr-fetch-account").value.trim();
          const targetPassword = containerEl.querySelector("#usr-fetch-password").value;
          const permissionGroupId = containerEl.querySelector("#usr-fetch-perm-group").value;
          const submitBtn = containerEl.querySelector("#btn-usr-fetch-submit");

          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = `Consultando ${source}...`;
          }

          const res = source === "RADIUS"
            ? await fetchAndAuthenticateUserFromRadiusGateway({
                radiusIp: companyAuthCfg.radius.ipAddress,
                radiusPort: companyAuthCfg.radius.authPort,
                sharedKey: companyAuthCfg.radius.sharedKey,
                nasIpAddress: companyAuthCfg.radius.nasIpAddress,
                nasIdentifier: companyAuthCfg.radius.nasIdentifier,
                ldapIp: companyAuthCfg.ldap.serverIpName,
                ldapPort: companyAuthCfg.ldap.serverPort,
                bindUsername: companyAuthCfg.ldap.username,
                bindPassword: companyAuthCfg.ldap.password,
                distinguishedName: companyAuthCfg.ldap.distinguishedName,
                targetUsername,
                userPasswordToAuthenticate: targetPassword
              })
            : await fetchAndAuthenticateUserFromLdapGateway({
                serverIpName: companyAuthCfg.ldap.serverIpName,
                serverPort: companyAuthCfg.ldap.serverPort,
                secureConnection: companyAuthCfg.ldap.secureConnection,
                bindUsername: companyAuthCfg.ldap.username,
                bindPassword: companyAuthCfg.ldap.password,
                distinguishedName: companyAuthCfg.ldap.distinguishedName,
                targetUsername,
                userPasswordToAuthenticate: targetPassword
              });

          if (!res.success || !res.userProfile) {
            dispatchEnterpriseToast({
              title: `Error al traer usuario desde ${source}`,
              message: res.detail || res.statusText,
              variant: "danger"
            });
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = "Traer Usuario y Asignar Permisos del Grupo";
            }
            return;
          }

          fetchedUserDraft = {
            displayName: res.userProfile.fullName,
            username: res.userProfile.username,
            source: res.userProfile.authProtocol,
            distinguishedName: res.userProfile.distinguishedName
          };
          const savedUser = await registerFetchedAdOrRadiusUserWithPermissions({
            userProfile: res.userProfile,
            permissionGroupId
          });
          selectedUserRecord = savedUser;

          dispatchEnterpriseToast({
            title: `Usuario Traído desde ${source} y Permisos Asignados`,
            message: `${savedUser.username} (${savedUser.fullName}) usa ahora los permisos de "${savedUser.assignedPermissionGroupName || savedUser.permissionGroupName}".`,
            variant: "success"
          });
          renderContent();
        });
      }
    };

    renderContent();
  }
};
