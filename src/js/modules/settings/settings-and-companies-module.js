/**
 * MÓDULO INDEPENDIENTE 13: CONFIGURACIÓN, EMPRESAS (SAP LOGON 800), CONEXIONES REALES (LDAP/RADIUS),
 * PERMISOS MODULARES POR DEPARTAMENTO Y PERFILES DE COLORES / TEMAS (T-CODE: CFG01)
 */

import {
  getCollectionRecords,
  insertOrUpdateCollectionRecord,
  deleteRecordFromCollection,
  getActiveCompanyRecord,
  setActiveCompanyRecord
} from "../../database/database-provider-adapter.js";
import {
  applyRncMaskFormat,
  validateRncMaskFormat
} from "../../formatters/rnc-tax-id-mask-formatter.js";
import {
  applyThemePaletteToDocument,
  createAndApplyNamedTheme,
  createAndApplyCustomColorProfile,
  previewCustomColorsLive,
  derivePaletteFromThemeName,
  getActiveThemeMetadata,
  getAllSavedThemes
} from "../../core/theme-customization-engine.js";
import {
  getAuthConnectionConfigurations,
  saveAuthConnectionConfigurations,
  syncCompanyAuthTelemetryToShell,
  verifyRealLdapCredentialsWithGateway,
  verifyRealRadiusWithGateway,
  fetchAndAuthenticateUserFromLdapGateway,
  fetchAndAuthenticateUserFromRadiusGateway,
  generateSixteenCharacterAccessCode,
  registerUserCompanyEntry,
  getCompanyUserAccessRegistry,
  checkGatewayServiceStatus
} from "../../security/connection-auth-providers-service.js";
import {
  M365_HAMBURGER_TOGGLE_SVG,
  M365_CHEVRON_DOWN_SVG,
  getMicrosoft365NavIconSvg
} from "../../core/microsoft365-navigation-icons.js";
import {
  PLATFORM_MODULAR_PERMISSIONS_CATALOG,
  GRANULAR_FUNCTION_ACTIONS,
  getDepartmentsList,
  createOrUpdateDepartment,
  getPermissionGroupsList,
  getPermissionGroupById,
  createOrUpdatePermissionGroup,
  assignPermissionGroupToUser,
  registerFetchedAdOrRadiusUserWithPermissions,
  updateUserLocalCredentials,
  countEnabledModulesInGroup
} from "../../security/modular-permissions-and-departments-service.js";
import {
  switchActiveUserSecuritySession,
  getActiveUserSecuritySession
} from "../../security/role-permission-evaluator.js";
import { provisionWindowsAdUserToErp } from "../../security/windows-server-ad-connector.js";
import { recordSecurityAuditEvent } from "../../security/audit-trail-logger.js";
import { renderStatisticsKpiCardsHtml } from "../../statistics/real-time-statistics-calculator.js";
import { sanitizeTextString, highlightSearchMatchSafe } from "../../validators/security-input-sanitizer.js";
import { dispatchEnterpriseToast } from "../../core/ui-notification-dispatcher.js";

export const SettingsAndCompaniesModule = {
  id: "settings",
  tCode: "CFG01",
  name: "Configuración y Empresas",
  category: "GOBIERNO Y SEGURIDAD",
  templatePath: "./src/html/modules/settings-and-companies-view.html",
  requiredPermission: "SYS_SETTINGS_VIEW",
  exportedFunctions: [
    "selectActiveEnterpriseSapLogon",
    "createEnterpriseWithRncMask",
    "configureLdapRadiusLocalOAuthConnections",
    "fetchAndAssignModularPermissionsToUser",
    "customizeThemeAndColorProfiles"
  ],

  async renderModuleWorkspace(containerEl, { searchQuery = "" } = {}) {
    // Grupos contraídos en la cinta vertical de Configuración ("Sistema dBase" inicia contraído para expandirse al darle clic)
    const collapsedRibbonGroups = new Set(["GRP_SISTEMA_DBASE"]);

    // Subvista activa controlada por la Cinta Vertical Contraíble (Estilo GOBIERNO Y SEGURIDAD)
    let activeRibbonItem = "LDAP";
    if (window.__EDA_TARGET_SETTINGS_SUBVIEW === "TEMA_COLORES") {
      activeRibbonItem = "TEMAS_SISTEMA";
      window.__EDA_TARGET_SETTINGS_SUBVIEW = null;
    } else if (window.__EDA_TARGET_SETTINGS_SUBVIEW === "EMPRESAS_SAP800") {
      activeRibbonItem = "SAP800";
      window.__EDA_TARGET_SETTINGS_SUBVIEW = null;
    } else if (window.__EDA_TARGET_SETTINGS_SUBVIEW === "SOBRE_ABOUT") {
      activeRibbonItem = "SOBRE_ABOUT";
      collapsedRibbonGroups.delete("GRP_SISTEMA_DBASE");
      window.__EDA_TARGET_SETTINGS_SUBVIEW = null;
    } else if (window.__EDA_TARGET_SETTINGS_SUBVIEW === "OPCIONES_SISTEMA") {
      activeRibbonItem = "OPCIONES_SISTEMA";
      collapsedRibbonGroups.delete("GRP_SISTEMA_DBASE");
      window.__EDA_TARGET_SETTINGS_SUBVIEW = null;
    }

    let isLdapTestCredentialsDrawerOpen = false;
    let ldapDrawerFeedback = null;
    let fetchedUserFeedback = null;

    const DEFAULT_COMPANY_LOGO_PATH = "./src/img/logos/easy-data-accounting-brand-logo.jpg";
    let localFilter = searchQuery;
    let activeWorkspaceArea = "Local";
    let selectedCompany = getActiveCompanyRecord();
    // Empresa seleccionada para configurar sus conexiones segmentadas (LDAP / RADIUS / LOCAL / OAuth)
    let configCompanyId = selectedCompany?.id || "COMP-001";
    let editingCompanyId = null;
    let draftCompanyLogoUrl = "";
    let generated16Code = generateSixteenCharacterAccessCode();

    // Estado para contraer la Cinta Vertical de Configuración al estilo Microsoft 365 (solo iconos)
    let isCintaRailCollapsed = localStorage.getItem("EDA_CINTA_RAIL_COLLAPSED_V1") === "true";
    let isCintaAutoHide = localStorage.getItem("EDA_CINTA_RAIL_AUTOHIDE_V1") === "true";

    // Estado para gestión de Departamentos y Grupos de Permisos Modulares
    let selectedPermGroupId = "GRP-ADMIN";
    let selectedUserForPermId = null;
    let filterDeptForUserSelect = "ALL";

    // Estado para Creador de Perfil de Colores
    const initialThemeMeta = getActiveThemeMetadata();
    let draftColorProfile = {
      name: "Mi Perfil Corporativo",
      bgPrimary: initialThemeMeta.activeColors?.bgPrimary || "#0b1120",
      bgSecondary: initialThemeMeta.activeColors?.bgSecondary || "#111827",
      bgSurface: initialThemeMeta.activeColors?.bgSurface || "#1e293b",
      textPrimary: initialThemeMeta.activeColors?.textPrimary || "#f8fafc",
      textSecondary: initialThemeMeta.activeColors?.textSecondary || "#cbd5e1",
      brandPrimary: initialThemeMeta.activeColors?.brandPrimary || "#38bdf8",
      brandSecondary: initialThemeMeta.activeColors?.brandSecondary || "#6366f1",
      borderDefault: initialThemeMeta.activeColors?.borderDefault || "#334155",
      successColor: initialThemeMeta.activeColors?.successColor || "#10b981"
    };

    const activateCompanySession = (companyObj) => {
      if (!companyObj) {
        return;
      }
      const activated = setActiveCompanyRecord(companyObj.id);
      selectedCompany = activated;
      configCompanyId = activated.id;

      const headerCompanyLabel = document.getElementById("header-active-company-label");
      if (headerCompanyLabel && activated) {
        headerCompanyLabel.textContent = `${activated.nombreComercial} (${activated.rnc})`;
      }
      const headerCompanyLogo = document.getElementById("header-active-company-logo");
      if (headerCompanyLogo && activated) {
        headerCompanyLogo.src = activated.logoUrl || DEFAULT_COMPANY_LOGO_PATH;
      }

      // Sincronizar el indicador de Windows Server AD/RADIUS en el Shell según la empresa activada
      syncCompanyAuthTelemetryToShell();

      recordSecurityAuditEvent({
        moduleId: "settings",
        action: "COMPANY_SWITCHED_SAP_LOGON",
        detail: `Empresa activa cambiada a ${activated.nombreComercial} - RNC ${activated.rnc}`,
        severity: "SUCCESS"
      });

      const compConnCfg = getAuthConnectionConfigurations(activated.id);
      dispatchEnterpriseToast({
        title: `Conectado a: ${activated.nombreComercial}`,
        message: compConnCfg.windowsConnectorEnabled
          ? `RNC: ${activated.rnc} | Conector Windows Server (${compConnCfg.activeProtocol}) Activo`
          : `RNC: ${activated.rnc} | Modo Autónomo (LOCAL / OAuth — Sin Windows Server)`,
        variant: "success"
      });

      renderContent();
    };

    const RIBBON_GROUPS_DEFINITION = [
      {
        groupId: "GRP_CONEXION",
        groupTitle: "CONEXIÓN",
        items: [
          { id: "LDAP", label: "LDAP (Active Directory)", badge: "DC01" },
          { id: "RADIUS", label: "RADIUS (Servidor NPS)", badge: "AC_TIC" },
          { id: "TRAER_USUARIO", label: "Traer Usuario AD / RADIUS", badge: "SYNC" },
          { id: "LOCAL", label: "LOCAL (Usuarios Manuales)", badge: "LOC" },
          { id: "OAUTH_CORREO", label: "OAuth Correo (16-Char)", badge: "KEY16" },
          { id: "SERVICIO_WINDOWS", label: "Servicio Windows (Gateway)", badge: "SRV" }
        ]
      },
      {
        groupId: "GRP_PERMISOS",
        groupTitle: "PERMISOS Y DEPARTAMENTOS",
        items: [
          { id: "ASIGNAR_USUARIO", label: "Asignar Permisos a Usuario", badge: "RBAC" },
          { id: "DEPARTAMENTOS_GRUPOS", label: "Departamentos y Grupos", badge: "DEPT" },
          { id: "MATRIZ_PERMISOS", label: "Crear Grupo de Permisos", badge: "MOD" }
        ]
      },
      {
        groupId: "GRP_TEMA",
        groupTitle: "TEMA",
        items: [
          { id: "TEMAS_SISTEMA", label: "Oscuro, Claro y Azul", badge: "TEMA" },
          { id: "PERFIL_COLORES", label: "Perfil de Colores", badge: "COLOR" }
        ]
      },
      {
        groupId: "GRP_EMPRESAS",
        groupTitle: "EMPRESAS Y SOCIEDADES",
        items: [
          { id: "SAP800", label: "Selector SAP Logon 800", badge: "SAP" },
          { id: "CREAR_EMPRESA", label: "Crear / Editar Empresa", badge: "RNC" }
        ]
      },
      {
        groupId: "GRP_SISTEMA_DBASE",
        groupTitle: "Sistema dBase",
        items: [
          { id: "SOBRE_ABOUT", label: "Sobre / About", badge: "VER" },
          { id: "OPCIONES_SISTEMA", label: "Opciones del sistema", badge: "OPT" }
        ]
      }
    ];

    const renderContent = () => {
      const allCompanies = getCollectionRecords("companies");
      const activeCompany = getActiveCompanyRecord();
      const targetConfigCompany = allCompanies.find((c) => c.id === configCompanyId) || activeCompany || allCompanies[0];
      if (targetConfigCompany) {
        configCompanyId = targetConfigCompany.id;
      }

      const savedThemes = getAllSavedThemes();
      const activeThemeMeta = getActiveThemeMetadata();
      const connConfigs = getAuthConnectionConfigurations(targetConfigCompany?.id);
      const isWinConnectorEnabled = Boolean(connConfigs.windowsConnectorEnabled);
      const accessRegistry = getCompanyUserAccessRegistry();
      const allAdUsers = getCollectionRecords("windowsAdUsers");
      const departments = getDepartmentsList();
      const permissionGroups = getPermissionGroupsList();
      const activeUserSession = getActiveUserSecuritySession();
      const cleanQuery = String(localFilter || "").trim().toLowerCase();

      if (!selectedUserForPermId || !allAdUsers.some((u) => u.id === selectedUserForPermId)) {
        selectedUserForPermId = allAdUsers[0]?.id || null;
      }

      const filteredCompanies = allCompanies.filter((comp) => {
        const matchesArea = activeWorkspaceArea === "Local" || comp.areaTrabajo === activeWorkspaceArea || comp.categoria === activeWorkspaceArea;
        const searchable = `${comp.rnc} ${comp.cedulaRnc} ${comp.razonSocial} ${comp.nombreComercial} ${comp.categoria} ${comp.regimenPagos} ${comp.actividadEconomica} ${comp.administracionLocal} ${comp.idSistema} ${comp.grupoServidor}`.toLowerCase();
        const matchesText = !cleanQuery || searchable.includes(cleanQuery);
        return matchesArea && matchesText;
      });

      const filteredAccessLogs = accessRegistry.filter((entry) => {
        if (!cleanQuery) {
          return true;
        }
        return `${entry.usernameOrEmail} ${entry.fullName} ${entry.authMethod} ${entry.code16} ${entry.companyName} ${entry.companyRnc}`
          .toLowerCase()
          .includes(cleanQuery);
      });

      if (!selectedCompany || !allCompanies.some((c) => c.id === selectedCompany.id)) {
        selectedCompany = filteredCompanies[0] || activeCompany || allCompanies[0];
      }

      const companyToEdit = editingCompanyId
        ? allCompanies.find((c) => c.id === editingCompanyId)
        : null;

      const formPrefill = companyToEdit || {
        rnc: "",
        cedulaRnc: "",
        razonSocial: "",
        nombreComercial: "",
        categoria: "GRAN CONTRIBUYENTE NACIONAL",
        regimenPagos: "RÉGIMEN ORDINARIO DE TRIBUTACIÓN",
        estado: "ACTIVO",
        actividadEconomica: "",
        administracionLocal: "ADM LOCAL GRANDES CONTRIBUYENTES",
        facturadorElectronico: "SÍ - AUTORIZADO E-CF (SERIE E)",
        licenciasVhm: "NO APLICA",
        grupoServidor: "172.16.4.15"
      };

      const ldapCfg = connConfigs.ldap;
      const radiusCfg = connConfigs.radius;

      const kpisHtml = renderStatisticsKpiCardsHtml([
        {
          label: "Empresa Activa en Sesión",
          value: activeCompany?.nombreComercial || "Sin Empresa",
          badge: `RNC ${activeCompany?.rnc || "-"}`,
          subtitle: activeCompany?.razonSocial || "-",
          trend: activeCompany?.administracionLocal || "-",
          accent: "success",
          progressPct: 100
        },
        {
          label: `Conector (${targetConfigCompany?.nombreComercial || "Empresa"})`,
          value: isWinConnectorEnabled
            ? `LDAP ${ldapCfg.serverIpName} | RAD ${radiusCfg.ipAddress}`
            : "Modo Autónomo (LOCAL / OAuth)",
          badge: isWinConnectorEnabled ? "WINDOWS AD ACTIVO" : "SIN WINDOWS AD",
          subtitle: isWinConnectorEnabled
            ? `Segmentado exclusivamente para ${targetConfigCompany?.nombreComercial}`
            : `Empresa independiente sin LDAP ni RADIUS`,
          trend: `Protocolo: ${isWinConnectorEnabled ? connConfigs.activeProtocol : "LOCAL"}`,
          accent: isWinConnectorEnabled ? "info" : "warning",
          progressPct: 100
        },
        {
          label: "Departamentos y Grupos RBAC",
          value: `${departments.length} Deptos / ${permissionGroups.length} Grupos`,
          badge: "13 MÓDULOS",
          subtitle: `Permisos activos: ${activeUserSession.assignedPermissionGroupName || activeUserSession.erpRole}`,
          trend: "Seguridad Modular",
          accent: "purple",
          progressPct: 100
        },
        {
          label: "Tema y Perfil de Color Activo",
          value: activeThemeMeta.themeName,
          badge: activeThemeMeta.paletteKey.replace("palette-", "").toUpperCase(),
          subtitle: `${savedThemes.length} perfiles y temas disponibles`,
          trend: "Personalización Total",
          accent: "warning",
          progressPct: 100
        }
      ]);

      // ======================================================================
      // BANNER DE SEGMENTACIÓN DE CONECTOR WINDOWS SERVER POR EMPRESA (MULTI-TENANT)
      // ======================================================================
      const renderCompanyConnectorSegmentationBannerHtml = () => `
        <div class="company-connector-segmentation-banner ${isWinConnectorEnabled ? "" : "is-standalone-mode"}">
          <div class="company-connector-banner-left">
            <img
              src="${sanitizeTextString(targetConfigCompany?.logoUrl || DEFAULT_COMPANY_LOGO_PATH)}"
              alt="Logo Empresa"
              class="company-logo-preview-thumb"
            />
            <div class="company-connector-banner-info">
              <div class="company-connector-banner-title">
                <span>Conector Segmentado por Empresa: <strong>${sanitizeTextString(targetConfigCompany?.nombreComercial || "-")}</strong></span>
                <span class="badge-pill ${isWinConnectorEnabled ? "badge-success" : "badge-warning"}">
                  ${isWinConnectorEnabled ? "CONECTOR WINDOWS SERVER (LDAP / RADIUS) HABILITADO" : "EMPRESA INDEPENDIENTE (SOLO LOCAL / OAUTH)"}
                </span>
              </div>
              <span class="company-connector-banner-desc">
                La configuración de Windows Server (LDAP / RADIUS) es exclusiva de cada empresa. Si un cliente que compra o alquila la aplicación no desea usar LDAP o RADIUS, su empresa funciona de forma independiente con usuarios Locales u OAuth.
              </span>
            </div>
          </div>

          <div class="company-connector-banner-actions">
            <div class="form-field-group">
              <label class="form-field-label" for="select-company-for-auth-config">Empresa a Configurar:</label>
              <select id="select-company-for-auth-config" class="form-select-control">
                ${allCompanies.map((comp) => {
                  const compAuth = getAuthConnectionConfigurations(comp.id);
                  return `
                    <option value="${sanitizeTextString(comp.id)}" ${comp.id === targetConfigCompany?.id ? "selected" : ""}>
                      ${sanitizeTextString(comp.nombreComercial)} (${sanitizeTextString(comp.rnc)}) — [${compAuth.windowsConnectorEnabled ? "Windows AD/RADIUS" : "Autónomo LOCAL"}]
                    </option>
                  `;
                }).join("")}
              </select>
            </div>

            <div class="protocol-control-inline">
              <label class="erp-toggle-switch" title="Activar o desactivar el conector Windows Server (LDAP/RADIUS) exclusivamente para esta empresa">
                <input type="checkbox" id="toggle-company-windows-connector" ${isWinConnectorEnabled ? "checked" : ""} />
                <span class="erp-toggle-slider"></span>
              </label>
              <span class="protocol-form-label">
                ${isWinConnectorEnabled ? "Windows Server Activo en esta Empresa" : "Habilitar Windows Server en esta Empresa"}
              </span>
            </div>
          </div>
        </div>
      `;

      // ======================================================================
      // RENDERIZADO DE LA CINTA VERTICAL CONTRAÍBLE (ESTILO MICROSOFT 365 CON ICONOS)
      // ======================================================================
      const renderVerticalCollapsibleRibbonHtml = () => `
        <aside class="cinta-vertical-sidebar ${isCintaRailCollapsed ? "is-rail-collapsed" : ""}" aria-label="Cinta Vertical de Configuración">
          <div class="m365-rail-header">
            <button
              type="button"
              id="btn-cinta-rail-toggle"
              class="m365-hamburger-btn"
              title="Contraer o expandir menú de configuración a iconos (Estilo Microsoft 365)"
              aria-label="Contraer o expandir menú de configuración"
            >
              ${M365_HAMBURGER_TOGGLE_SVG}
            </button>
          </div>
          ${RIBBON_GROUPS_DEFINITION.map((grp) => {
            const isCollapsed = collapsedRibbonGroups.has(grp.groupId);
            return `
              <div class="sidebar-section-group ${isCollapsed ? "is-collapsed" : ""}" data-ribbon-group="${grp.groupId}">
                <button
                  type="button"
                  class="sidebar-section-title"
                  data-toggle-ribbon-group="${grp.groupId}"
                  title="Click para contraer o expandir ${grp.groupTitle}"
                >
                  <span>${grp.groupTitle}</span>
                  <span class="sidebar-section-chevron">${M365_CHEVRON_DOWN_SVG}</span>
                </button>
                <div class="sidebar-section-items">
                  ${grp.items.map((item) => `
                    <button
                      type="button"
                      class="sidebar-module-btn ${activeRibbonItem === item.id ? "is-active" : ""}"
                      data-ribbon-item="${item.id}"
                      title="${item.label} (${item.badge})"
                    >
                      <span class="sidebar-module-label-group">
                        <span class="m365-nav-icon-box" aria-hidden="true">${getMicrosoft365NavIconSvg(item.id)}</span>
                        <span class="sidebar-module-text">${item.label}</span>
                      </span>
                      <span class="sidebar-tcode-badge">${item.badge}</span>
                    </button>
                  `).join("")}
                </div>
              </div>
            `;
          }).join("")}
        </aside>
      `;

      // ======================================================================
      // PANEL DE AUDITORÍA DE USUARIOS QUE HAN ENTRADO A LA EMPRESA
      // ======================================================================
      const renderAccessLogPanelHtml = () => `
        <div class="enterprise-panel">
          <div class="enterprise-panel-header">
            <h3 class="enterprise-panel-title">Usuarios Autenticados (${filteredAccessLogs.length})</h3>
            <span class="badge-pill badge-success">${sanitizeTextString(targetConfigCompany?.nombreComercial || "Empresa")}</span>
          </div>
          <div class="enterprise-panel-body">
            <div class="filter-input-group">
              <input
                type="search"
                id="conn-access-log-search"
                class="module-search-input"
                placeholder="Buscar usuario, método (LDAP, RADIUS, OAuth), empresa..."
                value="${sanitizeTextString(localFilter)}"
              />
            </div>
            <div class="table-scroll-container">
              <table class="accounting-table">
                <thead>
                  <tr>
                    <th>Fecha / Hora</th>
                    <th>Usuario / Correo</th>
                    <th>Nombre Completo</th>
                    <th>Empresa</th>
                    <th>Método</th>
                    <th>Código / Grupo</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredAccessLogs.map((log) => `
                    <tr>
                      <td class="font-mono">${sanitizeTextString(log.enteredAt)}</td>
                      <td class="font-mono"><strong>${highlightSearchMatchSafe(log.usernameOrEmail, localFilter)}</strong></td>
                      <td>${highlightSearchMatchSafe(log.fullName, localFilter)}</td>
                      <td>${highlightSearchMatchSafe(log.companyName, localFilter)}</td>
                      <td><span class="badge-pill badge-info">${highlightSearchMatchSafe(log.authMethod, localFilter)}</span></td>
                      <td class="font-mono col-debit"><strong>${highlightSearchMatchSafe(log.code16, localFilter)}</strong></td>
                      <td>
                        <button type="button" class="btn-action btn-secondary btn-xs btn-jump-assign-perm" data-log-user="${sanitizeTextString(log.usernameOrEmail)}">
                          Asignar Permisos
                        </button>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      // ======================================================================
      // RENDERIZADO DEL CONTENIDO SEGÚN LA OPCIÓN SELECCIONADA EN LA CINTA VERTICAL
      // ======================================================================
      const renderActiveRibbonContentHtml = () => {
        const statusClass = ldapCfg.statusState === "SUCCESS"
          ? ""
          : ldapCfg.statusState === "FAILED"
            ? "is-failed"
            : "is-pending";
        const statusSymbol = ldapCfg.statusState === "SUCCESS"
          ? "✓"
          : ldapCfg.statusState === "FAILED"
            ? "✕"
            : "!";

        // 1. CONEXIÓN: LDAP (DC01 - 172.16.4.2:389)
        if (activeRibbonItem === "LDAP") {
          return `
            ${renderCompanyConnectorSegmentationBannerHtml()}
            ${!isWinConnectorEnabled ? `
              <div class="journal-balance-bar is-unbalanced">
                <div>
                  <strong>Conector Windows Server (LDAP) Desactivado para ${sanitizeTextString(targetConfigCompany?.nombreComercial || "esta empresa")}</strong>
                  <div class="module-description">
                    Esta empresa opera en modo independiente (LOCAL / OAuth Correo) sin requerir servidores Windows Server. Si esta empresa cuenta con Active Directory propio, puede habilitar su conector arriba o pulsando el botón.
                  </div>
                </div>
                <div class="module-toolbar-actions">
                  <button type="button" id="btn-enable-win-connector-now" class="btn-action btn-primary btn-xs">
                    Habilitar LDAP / RADIUS en ${sanitizeTextString(targetConfigCompany?.nombreComercial || "Empresa")}
                  </button>
                  <button type="button" class="btn-action btn-secondary btn-xs" data-go-ribbon="LOCAL">
                    Ir a Usuarios Locales
                  </button>
                </div>
              </div>
            ` : ""}
            <div class="workspace-split-layout">
              <div class="auth-protocol-card">
                <div class="auth-protocol-card-header">
                  <h3 class="auth-protocol-card-title">Edit LDAP Server (${sanitizeTextString(ldapCfg.name || "DC01")}) — ${sanitizeTextString(targetConfigCompany?.nombreComercial || "")}</h3>
                  <div class="module-toolbar-actions">
                    <button type="button" class="btn-action btn-primary btn-xs" data-go-ribbon="TRAER_USUARIO">
                      + Traer Usuario desde LDAP
                    </button>
                    <span class="badge-pill ${isWinConnectorEnabled && ldapCfg.statusState === "SUCCESS" ? "badge-success" : ldapCfg.statusState === "FAILED" ? "badge-danger" : "badge-warning"}">
                      ${isWinConnectorEnabled ? `Socket TCP Real ${sanitizeTextString(ldapCfg.serverIpName)}:${sanitizeTextString(ldapCfg.serverPort)}` : "Desactivado en esta empresa"}
                    </span>
                  </div>
                </div>

                <form id="form-ldap-config" class="auth-protocol-card-body">
                  <div class="ldap-info-banner">
                    <span class="ldap-info-icon">i</span>
                    <span>Configuración LDAP exclusiva para la empresa <strong>${sanitizeTextString(targetConfigCompany?.nombreComercial || "-")} (RNC: ${sanitizeTextString(targetConfigCompany?.rnc || "-")})</strong>.</span>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="ldap-name">Name</label>
                    <div class="protocol-control-inline">
                      <input id="ldap-name" type="text" class="protocol-input-box font-mono ldap-live-field" value="${sanitizeTextString(ldapCfg.name)}" required />
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="ldap-server-ip">Server IP/Name</label>
                    <div class="protocol-control-inline">
                      <input id="ldap-server-ip" type="text" class="protocol-input-box font-mono ldap-live-field" value="${sanitizeTextString(ldapCfg.serverIpName)}" required />
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="ldap-port">Server Port</label>
                    <div class="protocol-control-inline">
                      <input id="ldap-port" type="number" class="protocol-input-box font-mono ldap-live-field" value="${sanitizeTextString(ldapCfg.serverPort)}" required />
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="ldap-cn-id">Common Name Identifier</label>
                    <div class="protocol-control-inline">
                      <input id="ldap-cn-id" type="text" class="protocol-input-box font-mono" value="${sanitizeTextString(ldapCfg.commonNameIdentifier)}" required />
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="ldap-dn">Distinguished Name</label>
                    <div class="protocol-control-inline">
                      <input id="ldap-dn" type="text" class="protocol-input-box font-mono ldap-live-field" value="${sanitizeTextString(ldapCfg.distinguishedName)}" required />
                      <button type="button" id="btn-ldap-browse-dn" class="btn-protocol-outline">Browse</button>
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="ldap-exchange">Exchange server</label>
                    <div class="protocol-control-inline">
                      <label class="erp-toggle-switch">
                        <input type="checkbox" id="ldap-exchange" ${ldapCfg.exchangeServer ? "checked" : ""} />
                        <span class="erp-toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <span class="protocol-form-label">Bind Type</span>
                    <div class="protocol-control-inline">
                      <div class="bind-type-segmented">
                        <button type="button" class="bind-type-btn ${ldapCfg.bindType === "Simple" ? "is-active" : ""}" data-bind="Simple">Simple</button>
                        <button type="button" class="bind-type-btn ${ldapCfg.bindType === "Anonymous" ? "is-active" : ""}" data-bind="Anonymous">Anonymous</button>
                        <button type="button" class="bind-type-btn ${ldapCfg.bindType === "Regular" ? "is-active" : ""}" data-bind="Regular">Regular</button>
                      </div>
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="ldap-username">Username</label>
                    <div class="protocol-control-inline">
                      <input id="ldap-username" type="text" class="protocol-input-box font-mono ldap-live-field" value="${sanitizeTextString(ldapCfg.username)}" required />
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="ldap-password">Password</label>
                    <div class="protocol-control-inline">
                      <input
                        id="ldap-password"
                        type="password"
                        class="protocol-input-box ldap-live-field"
                        placeholder="Ingrese contraseña real de ${sanitizeTextString(ldapCfg.username)}"
                        value="${sanitizeTextString(ldapCfg.password)}"
                      />
                      <button type="button" id="btn-ldap-change-pwd" class="btn-protocol-outline">Change</button>
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="ldap-secure">Secure Connection</label>
                    <div class="protocol-control-inline">
                      <label class="erp-toggle-switch">
                        <input type="checkbox" id="ldap-secure" ${ldapCfg.secureConnection ? "checked" : ""} />
                        <span class="erp-toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <span class="protocol-form-label">Connection status</span>
                    <div class="protocol-control-inline">
                      <span id="ldap-live-status-wrapper" class="ldap-status-indicator ${statusClass}">
                        <span id="ldap-live-status-icon" class="ldap-status-check ${statusClass}">${statusSymbol}</span>
                        <span id="ldap-live-status-text">${sanitizeTextString(ldapCfg.connectionStatus)}</span>
                      </span>
                    </div>
                  </div>

                  <div class="protocol-card-footer-left">
                    <button type="button" id="btn-ldap-test-connectivity" class="btn-protocol-outline">
                      Test Connectivity
                    </button>
                    <button type="button" id="btn-ldap-open-test-user-drawer" class="btn-protocol-outline">
                      Test User Credentials (Traer Usuario AD)
                    </button>
                  </div>

                  <div class="protocol-card-footer-right">
                    <button type="submit" class="btn-radius-ok">Validar en AD y Guardar Servidor LDAP</button>
                  </div>
                </form>

                ${isLdapTestCredentialsDrawerOpen ? `
                  <div class="ldap-test-drawer-backdrop" id="ldap-drawer-backdrop">
                    <aside class="ldap-test-drawer-panel" aria-label="Test User Credentials">
                      <div class="ldap-test-drawer-header">
                        <h4 class="ldap-test-drawer-title">Test User Credentials &amp; Traer Usuario</h4>
                        <button type="button" id="btn-close-ldap-drawer" class="btn-action btn-secondary btn-xs">Cerrar</button>
                      </div>

                      <p class="module-description">
                        Autentica y trae al usuario desde <strong>${sanitizeTextString(ldapCfg.serverIpName)}:${sanitizeTextString(ldapCfg.serverPort)}</strong> asignándole su grupo de permisos.
                      </p>

                      <form id="form-ldap-test-user-creds" class="auth-protocol-card-body">
                        <div class="ldap-test-drawer-row">
                          <label class="protocol-form-label" for="test-ldap-user-input">Username</label>
                          <input
                            id="test-ldap-user-input"
                            type="text"
                            class="protocol-input-box font-mono"
                            placeholder="ej. laantillana\\dbaezh"
                            value="laantillana\\dbaezh"
                            required
                          />
                        </div>

                        <div class="ldap-test-drawer-row">
                          <label class="protocol-form-label" for="test-ldap-pass-input">Password</label>
                          <input
                            id="test-ldap-pass-input"
                            type="password"
                            class="protocol-input-box"
                            placeholder="Contraseña de Active Directory"
                            required
                          />
                        </div>

                        <div class="ldap-test-drawer-row">
                          <label class="protocol-form-label" for="test-ldap-perm-group">Permisos</label>
                          <select id="test-ldap-perm-group" class="form-select-control">
                            ${permissionGroups.map((grp) => `
                              <option value="${sanitizeTextString(grp.id)}">${sanitizeTextString(grp.name)} [${sanitizeTextString(grp.departmentName)}]</option>
                            `).join("")}
                          </select>
                        </div>

                        ${ldapDrawerFeedback ? `
                          <div class="journal-balance-bar ${ldapDrawerFeedback.success ? "is-balanced" : "is-unbalanced"}">
                            <strong>${ldapDrawerFeedback.success ? "✓ Successful:" : "✕ Failed:"} ${sanitizeTextString(ldapDrawerFeedback.title)}</strong>
                            <span class="font-mono">${sanitizeTextString(ldapDrawerFeedback.detail)}</span>
                          </div>
                        ` : ""}

                        <div class="protocol-card-footer-right">
                          <button type="submit" class="btn-radius-ok">Autenticar, Traer y Asignar Permisos</button>
                        </div>
                      </form>
                    </aside>
                  </div>
                ` : ""}
              </div>

              ${renderAccessLogPanelHtml()}
            </div>
          `;
        }

        // 2. CONEXIÓN: RADIUS (AC_TIC - 172.16.4.3:1812)
        if (activeRibbonItem === "RADIUS") {
          return `
            ${renderCompanyConnectorSegmentationBannerHtml()}
            ${!isWinConnectorEnabled ? `
              <div class="journal-balance-bar is-unbalanced">
                <div>
                  <strong>Conector Windows Server (RADIUS NPS) Desactivado para ${sanitizeTextString(targetConfigCompany?.nombreComercial || "esta empresa")}</strong>
                  <div class="module-description">
                    Esta empresa opera en modo independiente (LOCAL / OAuth Correo) sin requerir servidores RADIUS. Si esta empresa cuenta con servidor NPS propio, habilite su conector arriba o pulsando el botón.
                  </div>
                </div>
                <div class="module-toolbar-actions">
                  <button type="button" id="btn-enable-win-connector-now" class="btn-action btn-primary btn-xs">
                    Habilitar LDAP / RADIUS en ${sanitizeTextString(targetConfigCompany?.nombreComercial || "Empresa")}
                  </button>
                  <button type="button" class="btn-action btn-secondary btn-xs" data-go-ribbon="LOCAL">
                    Ir a Usuarios Locales
                  </button>
                </div>
              </div>
            ` : ""}
            <div class="workspace-split-layout">
              <div class="auth-protocol-card">
                <div class="auth-protocol-card-header">
                  <h3 class="auth-protocol-card-title">${sanitizeTextString(radiusCfg.profileName || "AC_TIC")} — Configuración Servidor RADIUS (${sanitizeTextString(targetConfigCompany?.nombreComercial || "")})</h3>
                  <div class="module-toolbar-actions">
                    <button type="button" class="btn-action btn-primary btn-xs" data-go-ribbon="TRAER_USUARIO">
                      + Traer Usuario desde RADIUS
                    </button>
                    <span class="auth-help-circle" title="Configuración Servidor RADIUS RFC 2865 / RFC 3579">?</span>
                  </div>
                </div>

                <form id="form-radius-config" class="auth-protocol-card-body">
                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="rad-radsec">RadSec</label>
                    <div class="protocol-control-inline">
                      <label class="erp-toggle-switch">
                        <input type="checkbox" id="rad-radsec" ${radiusCfg.radSec ? "checked" : ""} />
                        <span class="erp-toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="rad-ip">IP Address</label>
                    <div class="protocol-control-inline">
                      <input id="rad-ip" type="text" class="protocol-input-box font-mono radius-live-field" value="${sanitizeTextString(radiusCfg.ipAddress)}" required />
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="rad-auth-port">Auth port</label>
                    <div class="protocol-control-inline">
                      <input id="rad-auth-port" type="number" class="protocol-input-box font-mono radius-live-field" value="${sanitizeTextString(radiusCfg.authPort)}" required />
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="rad-acct-port">Accounting port</label>
                    <div class="protocol-control-inline">
                      <input id="rad-acct-port" type="number" class="protocol-input-box font-mono radius-live-field" value="${sanitizeTextString(radiusCfg.accountingPort)}" required />
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="rad-shared-key">Shared key</label>
                    <div class="protocol-control-inline">
                      <input id="rad-shared-key" type="password" class="protocol-input-box radius-live-field" placeholder="Ingrese Shared Key real de NPS/RADIUS" value="${sanitizeTextString(radiusCfg.sharedKey)}" required />
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="rad-retype-key">Retype key</label>
                    <div class="protocol-control-inline">
                      <input id="rad-retype-key" type="password" class="protocol-input-box radius-live-field" placeholder="Repita la Shared Key" value="${sanitizeTextString(radiusCfg.retypeKey)}" required />
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="rad-timeout">Timeout</label>
                    <div class="protocol-control-inline">
                      <input id="rad-timeout" type="number" class="protocol-input-box font-mono" value="${sanitizeTextString(radiusCfg.timeoutSec)}" required />
                      <span class="protocol-optional-hint">sec.</span>
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="rad-retry">Retry count</label>
                    <div class="protocol-control-inline">
                      <input id="rad-retry" type="number" class="protocol-input-box font-mono" value="${sanitizeTextString(radiusCfg.retryCount)}" required />
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="rad-dyn-auth">Dynamic Authorization</label>
                    <div class="protocol-control-inline">
                      <label class="erp-toggle-switch">
                        <input type="checkbox" id="rad-dyn-auth" ${radiusCfg.dynamicAuthorization ? "checked" : ""} />
                        <span class="erp-toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <span class="protocol-form-label">Status-Server</span>
                    <div class="protocol-control-inline">
                      <label class="protocol-checkbox-label">
                        <input type="checkbox" id="rad-status-auth" class="protocol-checkbox-input" ${radiusCfg.statusServerAuth ? "checked" : ""} />
                        <span>Authentication</span>
                      </label>
                      <label class="protocol-checkbox-label">
                        <input type="checkbox" id="rad-status-acct" class="protocol-checkbox-input" ${radiusCfg.statusServerAccounting ? "checked" : ""} />
                        <span>Accounting</span>
                      </label>
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="rad-nas-ip">NAS-IP-Address</label>
                    <div class="protocol-control-inline">
                      <input id="rad-nas-ip" type="text" class="protocol-input-box font-mono" value="${sanitizeTextString(radiusCfg.nasIpAddress)}" />
                      <span class="protocol-optional-hint">(optional)</span>
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <label class="protocol-form-label" for="rad-nas-id">NAS-Identifier</label>
                    <div class="protocol-control-inline">
                      <input id="rad-nas-id" type="text" class="protocol-input-box font-mono" value="${sanitizeTextString(radiusCfg.nasIdentifier)}" />
                      <span class="protocol-optional-hint">(optional)</span>
                    </div>
                  </div>

                  <div class="protocol-form-row">
                    <span class="protocol-form-label">Estado RADIUS</span>
                    <div class="protocol-control-inline">
                      <span id="radius-live-status-wrapper" class="ldap-status-indicator ${radiusCfg.statusState === "SUCCESS" ? "" : radiusCfg.statusState === "FAILED" ? "is-failed" : "is-pending"}">
                        <span id="radius-live-status-icon" class="ldap-status-check ${radiusCfg.statusState === "SUCCESS" ? "" : radiusCfg.statusState === "FAILED" ? "is-failed" : "is-pending"}">
                          ${radiusCfg.statusState === "SUCCESS" ? "✓" : radiusCfg.statusState === "FAILED" ? "✕" : "!"}
                        </span>
                        <span id="radius-live-status-text">${sanitizeTextString(radiusCfg.connectionStatus || "Pendiente de prueba")}</span>
                      </span>
                    </div>
                  </div>

                  <div class="protocol-card-footer-right">
                    <button type="button" id="btn-radius-cancel" class="btn-radius-cancel">Cancel</button>
                    <button type="submit" class="btn-radius-ok">OK (Probar y Guardar)</button>
                  </div>
                </form>
              </div>

              ${renderAccessLogPanelHtml()}
            </div>
          `;
        }

        // 3. CONEXIÓN: TRAER Y AUTENTICAR USUARIO DESDE LDAP O RADIUS Y ASIGNARLE PERMISOS DE GRUPO
        if (activeRibbonItem === "TRAER_USUARIO") {
          return `
            ${renderCompanyConnectorSegmentationBannerHtml()}
            <div class="workspace-split-layout">
              <div class="auth-protocol-card">
                <div class="auth-protocol-card-header">
                  <h3 class="auth-protocol-card-title">Traer y Autenticar Usuario desde LDAP (${sanitizeTextString(ldapCfg.serverIpName)}) o RADIUS (${sanitizeTextString(radiusCfg.ipAddress)})</h3>
                  <span class="badge-pill ${isWinConnectorEnabled ? "badge-success" : "badge-warning"}">${isWinConnectorEnabled ? "Sincronización Real AD / NPS" : "Modo Independiente"}</span>
                </div>

                <form id="form-fetch-ad-radius-user" class="auth-protocol-card-body">
                  <p class="module-description">
                    Consulte o autentique un usuario real desde sus conexiones de <strong>${sanitizeTextString(targetConfigCompany?.nombreComercial || "la empresa")}</strong> e indíquele qué grupo de permisos del departamento utilizará en toda la plataforma.
                  </p>

                  <div class="form-grid-layout">
                    <div class="form-field-group">
                      <label class="form-field-label" for="fetch-protocol-select">Conexión Origen para Traer al Usuario *</label>
                      <select id="fetch-protocol-select" class="form-select-control">
                        <option value="LDAP">Conexión LDAP (${sanitizeTextString(ldapCfg.name || "DC01")} - ${sanitizeTextString(ldapCfg.serverIpName || "Sin IP")}:${sanitizeTextString(ldapCfg.serverPort)})</option>
                        <option value="RADIUS">Conexión RADIUS (${sanitizeTextString(radiusCfg.profileName || "RADIUS")} - ${sanitizeTextString(radiusCfg.ipAddress || "Sin IP")}:${sanitizeTextString(radiusCfg.authPort)})</option>
                      </select>
                    </div>

                    <div class="form-field-group">
                      <label class="form-field-label" for="fetch-username-input">Cuenta de Usuario en Dominio (sAMAccountName) *</label>
                      <input
                        id="fetch-username-input"
                        type="text"
                        class="form-input-control font-mono"
                        placeholder="ej. laantillana\\dbaezh o dbaezh o nps"
                        value="laantillana\\dbaezh"
                        required
                      />
                    </div>

                    <div class="form-field-group">
                      <label class="form-field-label" for="fetch-user-password-input">Contraseña del Usuario (Para Autenticar en Vivo)</label>
                      <input
                        id="fetch-user-password-input"
                        type="password"
                        class="form-input-control"
                        placeholder="Contraseña de AD (o deje en blanco si usa cuenta de servicio LDAP)"
                      />
                    </div>

                    <div class="form-field-group">
                      <label class="form-field-label" for="fetch-assign-perm-group-select">Permisos que Usará este Usuario (Grupo de Departamento) *</label>
                      <select id="fetch-assign-perm-group-select" class="form-select-control">
                        ${permissionGroups.map((grp) => `
                          <option value="${sanitizeTextString(grp.id)}">
                            Usar permisos de: ${sanitizeTextString(grp.name)} — [${sanitizeTextString(grp.departmentName)}]
                          </option>
                        `).join("")}
                      </select>
                    </div>
                  </div>

                  ${fetchedUserFeedback ? `
                    <div class="journal-balance-bar ${fetchedUserFeedback.success ? "is-balanced" : "is-unbalanced"}">
                      <div>
                        <strong>${fetchedUserFeedback.success ? "✓ Usuario Traído y Autenticado:" : "✕ Error al Traer Usuario:"} ${sanitizeTextString(fetchedUserFeedback.title)}</strong>
                        <div class="font-mono">${sanitizeTextString(fetchedUserFeedback.detail)}</div>
                      </div>
                      ${fetchedUserFeedback.success ? `
                        <button type="button" class="btn-action btn-primary btn-xs" data-go-ribbon="ASIGNAR_USUARIO">
                          Ver Permisos del Usuario
                        </button>
                      ` : ""}
                    </div>
                  ` : ""}

                  <div class="protocol-card-footer-right">
                    <button type="submit" class="btn-radius-ok">
                      Traer Usuario desde Servidor, Autenticar y Asignar Permisos
                    </button>
                  </div>
                </form>
              </div>

              <!-- Directorio de Usuarios Ya Traídos y Sus Permisos Asignados -->
              <div class="enterprise-panel">
                <div class="enterprise-panel-header">
                  <h3 class="enterprise-panel-title">Usuarios Traídos y Grupo de Permisos que Usan (${allAdUsers.length})</h3>
                  <span class="badge-pill badge-purple">Click en fila para cambiar permisos</span>
                </div>
                <div class="table-scroll-container">
                  <table class="accounting-table">
                    <thead>
                      <tr>
                        <th>Usuario Dominio</th>
                        <th>Nombre Completo</th>
                        <th>Origen</th>
                        <th>Departamento</th>
                        <th>Permisos que Usa el Usuario</th>
                        <th>Sesión</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${allAdUsers.map((u) => `
                        <tr class="fetched-user-row" data-sel-uid="${sanitizeTextString(u.id)}">
                          <td class="font-mono"><strong>${sanitizeTextString(u.username)}</strong></td>
                          <td>${sanitizeTextString(u.fullName)}</td>
                          <td><span class="badge-pill badge-info">${sanitizeTextString(u.authProtocol || "LDAP")}</span></td>
                          <td>${sanitizeTextString(u.assignedDepartmentName || "Departamento TI")}</td>
                          <td>
                            <span class="badge-pill badge-success">
                              ${sanitizeTextString(u.assignedPermissionGroupName || u.erpRole)}
                            </span>
                          </td>
                          <td>
                            <button type="button" class="btn-action btn-secondary btn-xs btn-activate-fetched-user" data-act-uid="${sanitizeTextString(u.id)}">
                              ${activeUserSession.username.toLowerCase() === u.username.toLowerCase() ? "En Sesión" : "Usar Usuario"}
                            </button>
                          </td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          `;
        }

        // 4. CONEXIÓN: LOCAL (USUARIOS MANUALES)
        if (activeRibbonItem === "LOCAL") {
          return `
            ${renderCompanyConnectorSegmentationBannerHtml()}
            <div class="workspace-split-layout">
              <div class="auth-protocol-card">
                <div class="auth-protocol-card-header">
                  <h3 class="auth-protocol-card-title">Conexión LOCAL — Registro Manual de Usuarios (${sanitizeTextString(targetConfigCompany?.nombreComercial || "")})</h3>
                  <span class="badge-pill badge-info">DIRECTORIO INTERNO POR EMPRESA</span>
                </div>
                <form id="form-create-local-user" class="auth-protocol-card-body">
                  <div class="form-grid-layout">
                    <div class="form-field-group">
                      <label class="form-field-label" for="loc-usr-account">Usuario / Cuenta Local *</label>
                      <input id="loc-usr-account" class="form-input-control font-mono" type="text" placeholder="ej. mrodriguez" required />
                    </div>
                    <div class="form-field-group">
                      <label class="form-field-label" for="loc-usr-fullname">Nombre Completo *</label>
                      <input id="loc-usr-fullname" class="form-input-control" type="text" placeholder="ej. María Rodríguez" required />
                    </div>
                    <div class="form-field-group">
                      <label class="form-field-label" for="loc-usr-email">Correo Corporativo *</label>
                      <input id="loc-usr-email" class="form-input-control font-mono" type="email" placeholder="ej. mrodriguez@laantillana.com" required />
                    </div>
                    <div class="form-field-group">
                      <label class="form-field-label" for="loc-usr-perm-group">Permisos que Usará este Usuario *</label>
                      <select id="loc-usr-perm-group" class="form-select-control">
                        ${permissionGroups.map((grp) => `
                          <option value="${sanitizeTextString(grp.id)}">
                            Usar permisos de: ${sanitizeTextString(grp.name)} (${sanitizeTextString(grp.departmentName)})
                          </option>
                        `).join("")}
                      </select>
                    </div>
                  </div>
                  <div class="protocol-card-footer-right">
                    <button type="submit" class="btn-radius-ok">Crear Usuario Local y Asignar Permisos</button>
                  </div>
                </form>
              </div>

              ${renderAccessLogPanelHtml()}
            </div>
          `;
        }

        // 5. CONEXIÓN: OAUTH CORREO / GMAIL (CÓDIGO 16 CARACTERES)
        if (activeRibbonItem === "OAUTH_CORREO") {
          return `
            ${renderCompanyConnectorSegmentationBannerHtml()}
            <div class="workspace-split-layout">
              <div class="auth-protocol-card">
                <div class="auth-protocol-card-header">
                  <h3 class="auth-protocol-card-title">OAuth Gmail / Correo — Código de 16 Caracteres (${sanitizeTextString(targetConfigCompany?.nombreComercial || "")})</h3>
                  <span class="badge-pill badge-purple">TOKEN 16 CARACTERES</span>
                </div>
                <div class="auth-protocol-card-body">
                  <div class="code-16-showcase-box">
                    <span class="protocol-form-label">Código de Acceso Generado (16 Caracteres Exactos):</span>
                    <div id="oauth-16-code-display" class="code-16-digits-display">${sanitizeTextString(generated16Code)}</div>
                    <div class="module-toolbar-actions">
                      <button type="button" id="btn-regenerate-16-code" class="btn-action btn-secondary btn-xs">
                        Generar Nuevo Código de 16 Caracteres
                      </button>
                      <button type="button" id="btn-copy-16-code" class="btn-action btn-primary btn-xs">
                        Usar Código en Validación
                      </button>
                    </div>
                  </div>

                  <form id="form-oauth-email-verify" class="form-grid-layout">
                    <div class="form-field-group">
                      <label class="form-field-label" for="oauth-email-input">Correo Gmail / Corporativo *</label>
                      <input id="oauth-email-input" class="form-input-control font-mono" type="email" placeholder="ej. usuario@laantillana.com" required />
                    </div>
                    <div class="form-field-group">
                      <label class="form-field-label" for="oauth-fullname-input">Nombre del Usuario *</label>
                      <input id="oauth-fullname-input" class="form-input-control" type="text" placeholder="ej. Carlos Almonte" required />
                    </div>
                    <div class="form-field-group">
                      <label class="form-field-label" for="oauth-code16-input">Código de 16 Caracteres *</label>
                      <input
                        id="oauth-code16-input"
                        class="form-input-control font-mono"
                        type="text"
                        maxlength="16"
                        value="${sanitizeTextString(generated16Code)}"
                        required
                      />
                    </div>
                    <div class="form-field-group">
                      <label class="form-field-label" for="oauth-perm-group-select">Permisos que Usará este Usuario *</label>
                      <select id="oauth-perm-group-select" class="form-select-control">
                        ${permissionGroups.map((grp) => `
                          <option value="${sanitizeTextString(grp.id)}">${sanitizeTextString(grp.name)} [${sanitizeTextString(grp.departmentName)}]</option>
                        `).join("")}
                      </select>
                    </div>
                    <div class="form-field-group">
                      <button type="submit" class="btn-radius-ok">Validar Código de 16 Caracteres y Asignar Permisos</button>
                    </div>
                  </form>
                </div>
              </div>

              ${renderAccessLogPanelHtml()}
            </div>
          `;
        }

        // 5.1 CONEXIÓN: SERVICIO WINDOWS (GATEWAY DAEMON AD/RADIUS)
        if (activeRibbonItem === "SERVICIO_WINDOWS") {
          return `
            ${renderCompanyConnectorSegmentationBannerHtml()}
            <div class="workspace-split-layout">
              <div class="auth-protocol-card">
                <div class="auth-protocol-card-header">
                  <h3 class="auth-protocol-card-title">Servicio de Windows — Gateway AD/LDAP/RADIUS Daemon</h3>
                  <div class="module-toolbar-actions">
                    <button type="button" id="btn-check-gateway-status-live" class="btn-action btn-primary btn-xs">
                      Comprobar Estado en Vivo
                    </button>
                    <span class="badge-pill badge-info">services.msc / schtasks</span>
                  </div>
                </div>

                <div class="auth-protocol-card-body">
                  <p class="module-description">
                    Para que el navegador pueda comunicarse con los servidores <strong>Active Directory (LDAP TCP 389/636)</strong> y <strong>RADIUS NPS (UDP 1812/1813)</strong> sin restricciones de socket web, el sistema cuenta con un microservicio puente local nativo (<strong>127.0.0.1:3890</strong>).
                  </p>

                  <div class="search-content-inspector">
                    <div class="inspector-field-grid">
                      <div class="inspector-field-item">
                        <span class="inspector-field-label">Nombre del Servicio en Windows</span>
                        <span class="inspector-field-value font-mono"><strong>ContabilidadDbaseGateway</strong></span>
                      </div>
                      <div class="inspector-field-item">
                        <span class="inspector-field-label">Nombre para Mostrar (Display Name)</span>
                        <span class="inspector-field-value">Contabilidad dBase - Windows AD &amp; RADIUS Gateway Service</span>
                      </div>
                      <div class="inspector-field-item">
                        <span class="inspector-field-label">Puerto Local de Escucha</span>
                        <span class="inspector-field-value font-mono col-debit"><strong>http://127.0.0.1:3890</strong></span>
                      </div>
                      <div class="inspector-field-item">
                        <span class="inspector-field-label">Estado en Vivo del Servicio</span>
                        <span id="gateway-service-live-status-pill" class="badge-pill badge-success">
                          ONLINE (Respondiendo peticiones)
                        </span>
                      </div>
                      <div class="inspector-field-item">
                        <span class="inspector-field-label">Modo de Ejecución</span>
                        <span class="inspector-field-value">Servicio de Windows / Tarea en Segundo Plano al Iniciar Sistema</span>
                      </div>
                      <div class="inspector-field-item">
                        <span class="inspector-field-label">Destinos de Red Interna</span>
                        <span class="inspector-field-value font-mono">LDAP: 172.16.4.2:389 | RADIUS: 172.16.4.3:1812</span>
                      </div>
                    </div>
                  </div>

                  <hr class="module-header-banner" />

                  <h4 class="enterprise-panel-title">Comandos de Gestión del Servicio (PowerShell / Terminal / CMD)</h4>
                  <p class="module-description">
                    Copie y pegue estos comandos en su terminal para instalar, arrancar, detener o consultar el servicio en cualquier servidor Windows:
                  </p>

                  <div class="form-grid-layout">
                    <div class="form-field-group">
                      <label class="form-field-label">1. Instalar como Servicio Permanente de Windows (Auto-inicio):</label>
                      <div class="protocol-control-inline">
                        <input type="text" class="form-input-control font-mono" readonly value="npm run service:install" />
                        <button type="button" class="btn-action btn-secondary btn-xs btn-copy-cmd-text" data-copy-val="npm run service:install">Copiar</button>
                      </div>
                    </div>

                    <div class="form-field-group">
                      <label class="form-field-label">2. Consultar Estado del Servicio:</label>
                      <div class="protocol-control-inline">
                        <input type="text" class="form-input-control font-mono" readonly value="npm run service:status" />
                        <button type="button" class="btn-action btn-secondary btn-xs btn-copy-cmd-text" data-copy-val="npm run service:status">Copiar</button>
                      </div>
                    </div>

                    <div class="form-field-group">
                      <label class="form-field-label">3. Iniciar Servicio:</label>
                      <div class="protocol-control-inline">
                        <input type="text" class="form-input-control font-mono" readonly value="npm run service:start" />
                        <button type="button" class="btn-action btn-secondary btn-xs btn-copy-cmd-text" data-copy-val="npm run service:start">Copiar</button>
                      </div>
                    </div>

                    <div class="form-field-group">
                      <label class="form-field-label">4. Detener Servicio:</label>
                      <div class="protocol-control-inline">
                        <input type="text" class="form-input-control font-mono" readonly value="npm run service:stop" />
                        <button type="button" class="btn-action btn-secondary btn-xs btn-copy-cmd-text" data-copy-val="npm run service:stop">Copiar</button>
                      </div>
                    </div>

                    <div class="form-field-group">
                      <label class="form-field-label">5. Instalador 1-Click para Administradores de Windows:</label>
                      <div class="protocol-control-inline">
                        <input type="text" class="form-input-control font-mono" readonly value=".\\install-windows-service.bat" />
                        <button type="button" class="btn-action btn-secondary btn-xs btn-copy-cmd-text" data-copy-val=".\\install-windows-service.bat">Copiar</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              ${renderAccessLogPanelHtml()}
            </div>
          `;
        }

        // ====================================================================
        // 6. PERMISOS Y DEPARTAMENTOS: ASIGNAR PERMISOS DE GRUPO A UN USUARIO
        // ====================================================================
        if (activeRibbonItem === "ASIGNAR_USUARIO") {
          const targetUser = allAdUsers.find((u) => u.id === selectedUserForPermId) || allAdUsers[0];
          const currentGroupOfUser = getPermissionGroupById(targetUser?.assignedPermissionGroupId || "GRP-ADMIN");
          const filteredGroupsByDept = filterDeptForUserSelect === "ALL"
            ? permissionGroups
            : permissionGroups.filter((g) => g.departmentId === filterDeptForUserSelect);

          return `
            <div class="workspace-split-layout">
              <div class="enterprise-panel">
                <div class="enterprise-panel-header">
                  <h3 class="enterprise-panel-title">Decirle al Usuario qué Grupo de Permisos Usará</h3>
                  <span class="badge-pill badge-info">Asignación Directa Usuario → Permisos del Grupo</span>
                </div>
                <div class="enterprise-panel-body">
                  <div class="user-permission-assignment-banner">
                    <p class="module-description">
                      Seleccione cualquier usuario traído desde <strong>LDAP (${sanitizeTextString(ldapCfg.serverIpName)})</strong>, <strong>RADIUS (${sanitizeTextString(radiusCfg.ipAddress)})</strong> o Local, e indíquele directamente qué <strong>Grupo de Permisos</strong> (ej. <em>Grupo Admin</em>, <em>Grupo Administrativo</em> o cualquier grupo de los departamentos) utilizará en la plataforma.
                    </p>

                    <form id="form-assign-group-permissions-to-user" class="form-grid-layout">
                      <div class="form-field-group">
                        <label class="form-field-label" for="assign-select-user">1. Seleccionar Usuario Autenticado / Traído *</label>
                        <select id="assign-select-user" class="form-select-control font-mono">
                          ${allAdUsers.map((usr) => `
                            <option value="${sanitizeTextString(usr.id)}" ${targetUser?.id === usr.id ? "selected" : ""}>
                              ${sanitizeTextString(usr.username)} — ${sanitizeTextString(usr.fullName)} [${sanitizeTextString(usr.authProtocol || "AD")}]
                            </option>
                          `).join("")}
                        </select>
                      </div>

                      <div class="form-field-group">
                        <label class="form-field-label" for="assign-filter-dept">2. Filtrar Grupos por Departamento</label>
                        <select id="assign-filter-dept" class="form-select-control">
                          <option value="ALL" ${filterDeptForUserSelect === "ALL" ? "selected" : ""}>TODOS LOS DEPARTAMENTOS (${departments.length})</option>
                          ${departments.map((d) => `
                            <option value="${sanitizeTextString(d.id)}" ${filterDeptForUserSelect === d.id ? "selected" : ""}>
                              ${sanitizeTextString(d.name)} (${sanitizeTextString(d.code)})
                            </option>
                          `).join("")}
                        </select>
                      </div>

                      <div class="form-field-group">
                        <label class="form-field-label" for="assign-select-perm-group">3. Los Permisos que Usará este Usuario son los de: *</label>
                        <select id="assign-select-perm-group" class="form-select-control">
                          ${filteredGroupsByDept.map((grp) => `
                            <option value="${sanitizeTextString(grp.id)}" ${currentGroupOfUser?.id === grp.id ? "selected" : ""}>
                              ${sanitizeTextString(grp.name)} — [${sanitizeTextString(grp.departmentName)}] (${countEnabledModulesInGroup(grp)}/13 módulos)
                            </option>
                          `).join("")}
                        </select>
                      </div>

                      <div class="form-field-group">
                        <label class="form-field-label">Acción de Seguridad</label>
                        <div class="module-toolbar-actions">
                          <button type="submit" class="btn-radius-ok">
                            Guardar Permisos para ${sanitizeTextString(targetUser?.username || "Usuario")}
                          </button>
                          <button type="button" id="btn-activate-selected-user-session" class="btn-action btn-secondary">
                            Activar Sesión con este Usuario
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>

                  <h4 class="enterprise-panel-title">Detalle Modular de los Permisos que Usa: ${sanitizeTextString(targetUser?.username || "-")} (${sanitizeTextString(currentGroupOfUser?.name || "-")})</h4>
                  <div class="permissions-matrix-wrapper">
                    <table class="permissions-matrix-table">
                      <thead>
                        <tr>
                          <th>Módulo Independiente</th>
                          <th>T-Code</th>
                          <th>Acceso Módulo</th>
                          <th>Ver</th>
                          <th>Buscar/Popular</th>
                          <th>Crear</th>
                          <th>Editar</th>
                          <th>Eliminar/Anular</th>
                          <th>Contabilizar</th>
                          <th>Exportar</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${PLATFORM_MODULAR_PERMISSIONS_CATALOG.map((mod) => {
                          const modPerm = currentGroupOfUser?.modulesAccess?.[mod.moduleId] || {};
                          return `
                            <tr>
                              <td><strong>${sanitizeTextString(mod.moduleName)}</strong></td>
                              <td class="font-mono">${sanitizeTextString(mod.tCode)}</td>
                              <td>
                                <span class="badge-pill ${modPerm.enabled ? "badge-success" : "badge-danger"}">
                                  ${modPerm.enabled ? "AUTORIZADO" : "SIN ACCESO"}
                                </span>
                              </td>
                              <td>${modPerm.ver ? "✓" : "—"}</td>
                              <td>${modPerm.buscarPopular ? "✓" : "—"}</td>
                              <td>${modPerm.crear ? "✓" : "—"}</td>
                              <td>${modPerm.editar ? "✓" : "—"}</td>
                              <td>${modPerm.eliminarAnular ? "✓" : "—"}</td>
                              <td>${modPerm.aprobarContabilizar ? "✓" : "—"}</td>
                              <td>${modPerm.exportar ? "✓" : "—"}</td>
                            </tr>
                          `;
                        }).join("")}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <!-- Lista Rápida de Todos los Usuarios y los Permisos de Grupo que Tienen Asignados -->
              <div class="enterprise-panel">
                <div class="enterprise-panel-header">
                  <h3 class="enterprise-panel-title">Usuarios de la Plataforma (${allAdUsers.length})</h3>
                  <button type="button" class="btn-action btn-primary btn-xs" data-go-ribbon="TRAER_USUARIO">
                    + Traer Usuario de LDAP/RADIUS
                  </button>
                </div>
                <div class="table-scroll-container">
                  <table class="accounting-table">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Nombre</th>
                        <th>Departamento Asignado</th>
                        <th>Permisos de Grupo que Usa</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${allAdUsers.map((usr) => `
                        <tr class="user-perm-select-row ${targetUser?.id === usr.id ? "is-selected-row" : ""}" data-uid="${sanitizeTextString(usr.id)}">
                          <td class="font-mono"><strong>${sanitizeTextString(usr.username)}</strong></td>
                          <td>${sanitizeTextString(usr.fullName)}</td>
                          <td>${sanitizeTextString(usr.assignedDepartmentName || "Departamento de Tecnología y Sistemas (TI)")}</td>
                          <td>
                            <span class="badge-pill badge-success">
                              ${sanitizeTextString(usr.assignedPermissionGroupName || "Grupo Admin (Acceso Total Plataforma)")}
                            </span>
                          </td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          `;
        }

        // ====================================================================
        // 7. PERMISOS Y DEPARTAMENTOS: CREAR DEPARTAMENTOS Y VER GRUPOS POR DEPARTAMENTO
        // ====================================================================
        if (activeRibbonItem === "DEPARTAMENTOS_GRUPOS") {
          return `
            <div class="workspace-split-layout">
              <div class="enterprise-panel">
                <div class="enterprise-panel-header">
                  <h3 class="enterprise-panel-title">Crear Nuevo Departamento Corporativo</h3>
                  <span class="badge-pill badge-info">Contenedor de Grupos de Permisos</span>
                </div>
                <div class="enterprise-panel-body">
                  <p class="module-description">
                    Cree los departamentos de la empresa para organizar dentro de ellos los grupos de permisos modulares (ej. Departamento Administrativo, Contabilidad, Tesorería, TI, Operaciones POS, RRHH).
                  </p>
                  <form id="form-create-department" class="form-grid-layout">
                    <div class="form-field-group">
                      <label class="form-field-label" for="dept-code-input">Código del Departamento *</label>
                      <input id="dept-code-input" type="text" class="form-input-control font-mono" placeholder="ej. DEPT-FINANZAS" required />
                    </div>
                    <div class="form-field-group">
                      <label class="form-field-label" for="dept-name-input">Nombre del Departamento *</label>
                      <input id="dept-name-input" type="text" class="form-input-control" placeholder="ej. Departamento de Finanzas y Presupuesto" required />
                    </div>
                    <div class="form-field-group">
                      <label class="form-field-label" for="dept-manager-input">Gerencia / Responsable *</label>
                      <input id="dept-manager-input" type="text" class="form-input-control" placeholder="ej. Dirección Financiera" required />
                    </div>
                    <div class="form-field-group">
                      <label class="form-field-label" for="dept-desc-input">Descripción de Funciones *</label>
                      <input id="dept-desc-input" type="text" class="form-input-control" placeholder="ej. Control presupuestario y estados financieros" required />
                    </div>
                    <div class="form-field-group">
                      <button type="submit" class="btn-radius-ok">Crear Departamento</button>
                    </div>
                  </form>

                  <hr class="module-header-banner" />

                  <h4 class="enterprise-panel-title">Departamentos Registrados (${departments.length})</h4>
                  <div class="table-scroll-container">
                    <table class="accounting-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Departamento</th>
                          <th>Gerencia</th>
                          <th>Grupos de Permisos en este Depto.</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${departments.map((dept) => {
                          const deptGroups = permissionGroups.filter((g) => g.departmentId === dept.id);
                          return `
                            <tr>
                              <td class="font-mono"><strong>${sanitizeTextString(dept.code)}</strong></td>
                              <td><strong>${sanitizeTextString(dept.name)}</strong></td>
                              <td>${sanitizeTextString(dept.manager)}</td>
                              <td>
                                ${deptGroups.map((g) => `<span class="badge-pill badge-purple">${sanitizeTextString(g.name)}</span>`).join(" ") || `<span class="badge-pill badge-warning">Sin grupos aún</span>`}
                              </td>
                            </tr>
                          `;
                        }).join("")}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div class="enterprise-panel">
                <div class="enterprise-panel-header">
                  <h3 class="enterprise-panel-title">Grupos de Permisos por Departamento (${permissionGroups.length})</h3>
                  <button type="button" class="btn-action btn-primary btn-xs" data-go-ribbon="MATRIZ_PERMISOS">
                    + Configurar / Crear Grupo de Permisos
                  </button>
                </div>
                <div class="table-scroll-container">
                  <table class="accounting-table">
                    <thead>
                      <tr>
                        <th>Grupo de Permisos</th>
                        <th>Departamento al que Pertenece</th>
                        <th>Módulos Habilitados</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${permissionGroups.map((grp) => `
                        <tr>
                          <td><strong>${sanitizeTextString(grp.name)}</strong></td>
                          <td>${sanitizeTextString(grp.departmentName)}</td>
                          <td>
                            <span class="badge-pill badge-success">
                              ${countEnabledModulesInGroup(grp)} / 13 Módulos
                            </span>
                          </td>
                          <td>
                            <button type="button" class="btn-action btn-secondary btn-xs btn-edit-perm-group" data-grp-id="${sanitizeTextString(grp.id)}">
                              Editar Permisos Modulares
                            </button>
                          </td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          `;
        }

        // ====================================================================
        // 8. PERMISOS Y DEPARTAMENTOS: MATRIZ MODULAR DE GRUPOS DE PERMISOS
        // ====================================================================
        if (activeRibbonItem === "MATRIZ_PERMISOS") {
          const activePermGroup = getPermissionGroupById(selectedPermGroupId);

          return `
            <div class="enterprise-panel">
              <div class="enterprise-panel-header">
                <h3 class="enterprise-panel-title">Configurador Modular de Grupos de Permisos (13 Módulos Independientes)</h3>
                <span class="badge-pill badge-purple">Grupo Activo: ${sanitizeTextString(activePermGroup.name)}</span>
              </div>
              <div class="enterprise-panel-body">
                <form id="form-save-permission-group">
                  <div class="form-grid-layout">
                    <div class="form-field-group">
                      <label class="form-field-label" for="perm-grp-select-existing">Cargar Grupo Existente o Crear Nuevo</label>
                      <select id="perm-grp-select-existing" class="form-select-control">
                        ${permissionGroups.map((g) => `
                          <option value="${sanitizeTextString(g.id)}" ${g.id === activePermGroup.id ? "selected" : ""}>
                            ${sanitizeTextString(g.name)} (${sanitizeTextString(g.departmentName)})
                          </option>
                        `).join("")}
                        <option value="__NEW__">+ CREAR NUEVO GRUPO DE PERMISOS...</option>
                      </select>
                    </div>

                    <div class="form-field-group">
                      <label class="form-field-label" for="perm-grp-name-input">Nombre del Grupo de Permisos *</label>
                      <input
                        id="perm-grp-name-input"
                        type="text"
                        class="form-input-control"
                        placeholder="ej. Grupo Admin, Grupo Administrativo, Grupo Contabilidad..."
                        value="${sanitizeTextString(activePermGroup.name)}"
                        required
                      />
                    </div>

                    <div class="form-field-group">
                      <label class="form-field-label" for="perm-grp-dept-select">Departamento donde se ubica este Grupo *</label>
                      <select id="perm-grp-dept-select" class="form-select-control">
                        ${departments.map((d) => `
                          <option value="${sanitizeTextString(d.id)}" ${d.id === activePermGroup.departmentId ? "selected" : ""}>
                            ${sanitizeTextString(d.name)} (${sanitizeTextString(d.code)})
                          </option>
                        `).join("")}
                      </select>
                    </div>

                    <div class="form-field-group">
                      <label class="form-field-label" for="perm-grp-desc-input">Descripción del Alcance</label>
                      <input
                        id="perm-grp-desc-input"
                        type="text"
                        class="form-input-control"
                        value="${sanitizeTextString(activePermGroup.description)}"
                      />
                    </div>
                  </div>

                  <div class="module-filter-bar">
                    <strong>Matriz de Permisos por Módulo y Función Independiente</strong>
                    <div class="module-toolbar-actions">
                      <button type="button" id="btn-perm-check-all" class="btn-action btn-secondary btn-xs">Marcar Todos (Full Admin)</button>
                      <button type="button" id="btn-perm-uncheck-all" class="btn-action btn-secondary btn-xs">Desmarcar Todos</button>
                    </div>
                  </div>

                  <div class="permissions-matrix-wrapper">
                    <table class="permissions-matrix-table">
                      <thead>
                        <tr>
                          <th>Módulo Independiente</th>
                          <th>T-Code</th>
                          <th>Habilitar Módulo</th>
                          ${GRANULAR_FUNCTION_ACTIONS.map((act) => `<th>${sanitizeTextString(act.label)}</th>`).join("")}
                        </tr>
                      </thead>
                      <tbody>
                        ${PLATFORM_MODULAR_PERMISSIONS_CATALOG.map((mod) => {
                          const mAccess = activePermGroup.modulesAccess?.[mod.moduleId] || {};
                          return `
                            <tr data-perm-mod-row="${sanitizeTextString(mod.moduleId)}">
                              <td><strong>${sanitizeTextString(mod.moduleName)}</strong></td>
                              <td class="font-mono">${sanitizeTextString(mod.tCode)}</td>
                              <td>
                                <input
                                  type="checkbox"
                                  class="protocol-checkbox-input perm-mod-enabled-chk"
                                  data-mod-id="${sanitizeTextString(mod.moduleId)}"
                                  ${mAccess.enabled ? "checked" : ""}
                                />
                              </td>
                              ${GRANULAR_FUNCTION_ACTIONS.map((act) => `
                                <td>
                                  <input
                                    type="checkbox"
                                    class="protocol-checkbox-input perm-mod-action-chk"
                                    data-mod-id="${sanitizeTextString(mod.moduleId)}"
                                    data-act-key="${sanitizeTextString(act.key)}"
                                    ${mAccess[act.key] ? "checked" : ""}
                                  />
                                </td>
                              `).join("")}
                            </tr>
                          `;
                        }).join("")}
                      </tbody>
                    </table>
                  </div>

                  <div class="protocol-card-footer-right">
                    <button type="submit" class="btn-radius-ok">
                      Guardar Grupo de Permisos en el Departamento
                    </button>
                  </div>
                </form>
              </div>
            </div>
          `;
        }

        // ====================================================================
        // 9. TEMA: MODO OSCURO, CLARO, AZUL Y POR NOMBRE
        // ====================================================================
        if (activeRibbonItem === "TEMAS_SISTEMA") {
          return `
            <div class="enterprise-panel">
              <div class="enterprise-panel-header">
                <h3 class="enterprise-panel-title">Selección de Tema: Modo Oscuro, Modo Claro, Tema Azul y Temas por Nombre</h3>
                <div class="module-toolbar-actions">
                  <button type="button" class="btn-action btn-primary btn-xs" data-go-ribbon="PERFIL_COLORES">
                    + Crear Perfil de Colores Personalizado
                  </button>
                  <span class="badge-pill badge-success">Activo: ${sanitizeTextString(activeThemeMeta.themeName)}</span>
                </div>
              </div>
              <div class="enterprise-panel-body">
                <p class="module-description">
                  Haga clic en cualquier tema para cambiar toda la plataforma al instante entre <strong>Modo Oscuro</strong>, <strong>Modo Claro</strong>, <strong>Tema Azul</strong> o sus perfiles personalizados.
                </p>

                <div class="theme-cards-grid">
                  ${savedThemes.map((thm) => `
                    <div
                      class="theme-selector-card ${activeThemeMeta.themeName === thm.name ? "is-active-theme" : ""}"
                      data-theme-id="${sanitizeTextString(thm.id)}"
                      data-theme-palette="${sanitizeTextString(thm.paletteKey)}"
                      data-theme-name="${sanitizeTextString(thm.name)}"
                    >
                      <div class="inspector-header">
                        <strong>${sanitizeTextString(thm.name)}</strong>
                        <span class="badge-pill ${thm.isCustomColorProfile ? "badge-success" : thm.isPreset ? "badge-info" : "badge-purple"}">
                          ${thm.isCustomColorProfile ? "PERFIL COLOR" : thm.isPreset ? "OFICIAL" : "POR NOMBRE"}
                        </span>
                      </div>
                      <span class="module-description">${sanitizeTextString(thm.description)}</span>
                    </div>
                  `).join("")}
                </div>

                <hr class="module-header-banner" />

                <form id="form-create-named-theme" class="journal-balance-bar">
                  <div class="form-field-group">
                    <label class="form-field-label" for="custom-theme-name-input">
                      Generar y Aplicar Tema en Base al Nombre Escrito:
                    </label>
                    <input
                      id="custom-theme-name-input"
                      class="form-input-control"
                      type="text"
                      placeholder="Escriba un nombre (ej. Claro, Oscuro, Azul, La Antillana, Esmeralda, Oro Imperial, Rubí...)"
                      required
                    />
                  </div>
                  <button type="submit" class="btn-action btn-primary">
                    Aplicar Tema por Nombre
                  </button>
                </form>
              </div>
            </div>
          `;
        }

        // ====================================================================
        // 10. TEMA: CREADOR DE PERFIL DE COLORES PERSONALIZADO POR EL USUARIO
        // ====================================================================
        if (activeRibbonItem === "PERFIL_COLORES") {
          const colorFields = [
            { key: "bgPrimary", label: "1. Fondo Principal Plataforma", desc: "Área central de trabajo" },
            { key: "bgSecondary", label: "2. Fondo Barra Lateral y Cabecera", desc: "Menús, paneles y tarjetas" },
            { key: "bgSurface", label: "3. Fondo Superficies y Tablas", desc: "Encabezados de tabla y cajas" },
            { key: "textPrimary", label: "4. Texto Principal y Títulos", desc: "Lectura principal" },
            { key: "textSecondary", label: "5. Texto Secundario y Etiquetas", desc: "Subtítulos y descripciones" },
            { key: "brandPrimary", label: "6. Color Primario / Botones / Acento", desc: "Resaltado principal corporativo" },
            { key: "brandSecondary", label: "7. Color Secundario Corporativo", desc: "Insignias y acentos secundarios" },
            { key: "borderDefault", label: "8. Color de Bordes y Divisores", desc: "Líneas de tablas y paneles" },
            { key: "successColor", label: "9. Color de Éxito y Saldos Positivos", desc: "Indicadores OK y cuadres" }
          ];

          return `
            <div class="enterprise-panel">
              <div class="enterprise-panel-header">
                <h3 class="enterprise-panel-title">Creador de Perfil de Colores — Personalice los Colores de Toda la Plataforma</h3>
                <span class="badge-pill badge-success">Vista Previa en Tiempo Real</span>
              </div>
              <div class="enterprise-panel-body">
                <p class="module-description">
                  Elija los colores que desee para cada elemento de la plataforma. A medida que seleccione cada color, toda la plataforma cambiará en vivo. Guarde su perfil con un nombre para usarlo cuando quiera.
                </p>

                <div class="module-filter-bar">
                  <span>Plantillas Rápidas para Iniciar su Perfil:</span>
                  <div class="module-toolbar-actions">
                    <button type="button" class="btn-action btn-secondary btn-xs" data-preset-seed="palette-oscuro">Cargar Base Oscuro</button>
                    <button type="button" class="btn-action btn-secondary btn-xs" data-preset-seed="palette-claro">Cargar Base Claro</button>
                    <button type="button" class="btn-action btn-secondary btn-xs" data-preset-seed="palette-azul">Cargar Base Azul SAP</button>
                    <button type="button" class="btn-action btn-secondary btn-xs" data-preset-seed="palette-antillana">Cargar Base Antillana</button>
                  </div>
                </div>

                <form id="form-save-color-profile">
                  <div class="form-field-group">
                    <label class="form-field-label" for="color-profile-name-input">Nombre del Perfil de Colores *</label>
                    <input
                      id="color-profile-name-input"
                      type="text"
                      class="form-input-control"
                      placeholder="ej. Perfil Corporativo Antillana, Mi Tema Ejecutivo, Finanzas Claro..."
                      value="${sanitizeTextString(draftColorProfile.name)}"
                      required
                    />
                  </div>

                  <div class="color-profile-creator-grid">
                    ${colorFields.map((cf) => `
                      <div class="color-picker-tile">
                        <div class="color-picker-info">
                          <span class="color-picker-title">${sanitizeTextString(cf.label)}</span>
                          <span class="module-description">${sanitizeTextString(cf.desc)}</span>
                          <span class="color-picker-code" id="hex-label-${cf.key}">${sanitizeTextString(draftColorProfile[cf.key])}</span>
                        </div>
                        <input
                          type="color"
                          class="color-input-native live-color-picker-input"
                          data-color-key="${cf.key}"
                          value="${sanitizeTextString(draftColorProfile[cf.key])}"
                        />
                      </div>
                    `).join("")}
                  </div>

                  <div class="protocol-card-footer-right">
                    <button type="button" id="btn-go-back-themes" class="btn-radius-cancel">Ver Todos los Temas</button>
                    <button type="submit" class="btn-radius-ok">Guardar y Activar Perfil de Colores</button>
                  </div>
                </form>
              </div>
            </div>
          `;
        }

        // ====================================================================
        // 11. EMPRESAS: CREAR / EDITAR EMPRESA (LOGO + 11 CAMPOS DGII + RNC ###-#####-#)
        // ====================================================================
        if (activeRibbonItem === "CREAR_EMPRESA") {
          const effectiveLogoPreview = draftCompanyLogoUrl || formPrefill.logoUrl || DEFAULT_COMPANY_LOGO_PATH;

          return `
            <div class="workspace-split-layout">
              <div class="enterprise-panel">
                <div class="enterprise-panel-header">
                  <h3 class="enterprise-panel-title">
                    ${editingCompanyId ? `Editando Empresa: ${sanitizeTextString(companyToEdit?.nombreComercial || "")}` : "Crear Nueva Empresa / Sociedad Contable"}
                  </h3>
                  <span class="badge-pill badge-info">Logo + Máscara RNC: ###-#####-#</span>
                </div>
                <div class="enterprise-panel-body">
                  <div class="module-filter-bar">
                    <div class="filter-input-group">
                      <label class="form-field-label" for="comp-select-existing-to-edit">Seleccionar Empresa para Editar o Crear Nueva:</label>
                      <select id="comp-select-existing-to-edit" class="form-select-control">
                        <option value="__NEW__" ${!editingCompanyId ? "selected" : ""}>+ CREAR NUEVA EMPRESA...</option>
                        ${allCompanies.map((c) => `
                          <option value="${sanitizeTextString(c.id)}" ${editingCompanyId === c.id ? "selected" : ""}>
                            Editar: ${sanitizeTextString(c.nombreComercial)} — RNC ${sanitizeTextString(c.rnc)}
                          </option>
                        `).join("")}
                      </select>
                    </div>
                  </div>

                  <form id="form-create-edit-company">
                    <!-- Sección de Logo de la Empresa en el Registro -->
                    <div class="company-logo-upload-box">
                      <img
                        id="comp-logo-preview-img"
                        src="${sanitizeTextString(effectiveLogoPreview)}"
                        alt="Logo de la Empresa"
                        class="company-logo-preview-thumb"
                      />
                      <div class="company-logo-upload-controls">
                        <label class="form-field-label" for="comp-input-logo-file">
                          Logo de la Empresa (Subir imagen PNG, JPG, SVG o WEBP para esta empresa)
                        </label>
                        <input
                          id="comp-input-logo-file"
                          type="file"
                          accept="image/*"
                          class="company-logo-file-input"
                        />
                        <div class="module-toolbar-actions">
                          <input
                            id="comp-input-logo-url"
                            type="text"
                            class="form-input-control font-mono"
                            placeholder="O pegue ruta/URL del logo de la empresa..."
                            value="${sanitizeTextString(effectiveLogoPreview.startsWith("data:") ? "" : effectiveLogoPreview)}"
                          />
                          <button type="button" id="btn-reset-company-logo" class="btn-action btn-secondary btn-xs">
                            Logo por Defecto
                          </button>
                        </div>
                      </div>
                    </div>

                    <div class="form-grid-layout">
                      <div class="form-field-group">
                        <label class="form-field-label" for="comp-input-rnc">1. RNC (Numérico ###-#####-#) *</label>
                        <input
                          id="comp-input-rnc"
                          class="form-input-control font-mono"
                          type="text"
                          inputmode="numeric"
                          maxlength="11"
                          placeholder="###-#####-# (ej. 101-88921-2)"
                          value="${sanitizeTextString(formPrefill.rnc)}"
                          required
                        />
                      </div>

                      <div class="form-field-group">
                        <label class="form-field-label" for="comp-input-cedula-rnc">2. Cédula/RNC *</label>
                        <input
                          id="comp-input-cedula-rnc"
                          class="form-input-control font-mono"
                          type="text"
                          placeholder="101-88921-2"
                          value="${sanitizeTextString(formPrefill.cedulaRnc)}"
                          required
                        />
                      </div>

                      <div class="form-field-group">
                        <label class="form-field-label" for="comp-input-razon-social">3. Nombre/Razón Social *</label>
                        <input
                          id="comp-input-razon-social"
                          class="form-input-control"
                          type="text"
                          placeholder="ej. GRUPO EMPRESARIAL DEL CARIBE S.A."
                          value="${sanitizeTextString(formPrefill.razonSocial)}"
                          required
                        />
                      </div>

                      <div class="form-field-group">
                        <label class="form-field-label" for="comp-input-nombre-comercial">4. Nombre Comercial *</label>
                        <input
                          id="comp-input-nombre-comercial"
                          class="form-input-control"
                          type="text"
                          placeholder="ej. PRODUCCION CARIBE"
                          value="${sanitizeTextString(formPrefill.nombreComercial)}"
                          required
                        />
                      </div>

                      <div class="form-field-group">
                        <label class="form-field-label" for="comp-input-categoria">5. Categoría *</label>
                        <select id="comp-input-categoria" class="form-select-control">
                          <option value="GRAN CONTRIBUYENTE NACIONAL" ${formPrefill.categoria === "GRAN CONTRIBUYENTE NACIONAL" ? "selected" : ""}>GRAN CONTRIBUYENTE NACIONAL</option>
                          <option value="MEDIANO CONTRIBUYENTE" ${formPrefill.categoria === "MEDIANO CONTRIBUYENTE" ? "selected" : ""}>MEDIANO CONTRIBUYENTE</option>
                          <option value="MIPYMES / CONTRIBUYENTE ESPECIAL" ${formPrefill.categoria === "MIPYMES / CONTRIBUYENTE ESPECIAL" ? "selected" : ""}>MIPYMES / CONTRIBUYENTE ESPECIAL</option>
                          <option value="PERSONA JURÍDICA CORPORATIVA" ${formPrefill.categoria === "PERSONA JURÍDICA CORPORATIVA" ? "selected" : ""}>PERSONA JURÍDICA CORPORATIVA</option>
                        </select>
                      </div>

                      <div class="form-field-group">
                        <label class="form-field-label" for="comp-input-regimen">6. Régimen de pagos *</label>
                        <select id="comp-input-regimen" class="form-select-control">
                          <option value="RÉGIMEN ORDINARIO DE TRIBUTACIÓN" ${formPrefill.regimenPagos === "RÉGIMEN ORDINARIO DE TRIBUTACIÓN" ? "selected" : ""}>RÉGIMEN ORDINARIO DE TRIBUTACIÓN</option>
                          <option value="RST - RÉGIMEN SIMPLIFICADO DE TRIBUTACIÓN" ${formPrefill.regimenPagos === "RST - RÉGIMEN SIMPLIFICADO DE TRIBUTACIÓN" ? "selected" : ""}>RST - RÉGIMEN SIMPLIFICADO DE TRIBUTACIÓN</option>
                          <option value="RÉGIMEN ESPECIAL DE ZONAS FRANCAS" ${formPrefill.regimenPagos === "RÉGIMEN ESPECIAL DE ZONAS FRANCAS" ? "selected" : ""}>RÉGIMEN ESPECIAL DE ZONAS FRANCAS</option>
                        </select>
                      </div>

                      <div class="form-field-group">
                        <label class="form-field-label" for="comp-input-estado">7. Estado *</label>
                        <select id="comp-input-estado" class="form-select-control">
                          <option value="ACTIVO" ${formPrefill.estado === "ACTIVO" ? "selected" : ""}>ACTIVO</option>
                          <option value="EN PROCESO DE ALTA" ${formPrefill.estado === "EN PROCESO DE ALTA" ? "selected" : ""}>EN PROCESO DE ALTA</option>
                          <option value="SUSPENDIDO TEMPORAL" ${formPrefill.estado === "SUSPENDIDO TEMPORAL" ? "selected" : ""}>SUSPENDIDO TEMPORAL</option>
                        </select>
                      </div>

                      <div class="form-field-group">
                        <label class="form-field-label" for="comp-input-actividad">8. Actividad Económica *</label>
                        <input
                          id="comp-input-actividad"
                          class="form-input-control"
                          type="text"
                          placeholder="ej. COMERCIALIZACIÓN, IMPORTACIÓN Y SERVICIOS"
                          value="${sanitizeTextString(formPrefill.actividadEconomica)}"
                          required
                        />
                      </div>

                      <div class="form-field-group">
                        <label class="form-field-label" for="comp-input-adm-local">9. Administración Local *</label>
                        <input
                          id="comp-input-adm-local"
                          class="form-input-control"
                          type="text"
                          value="${sanitizeTextString(formPrefill.administracionLocal || "ADM LOCAL GRANDES CONTRIBUYENTES")}"
                          required
                        />
                      </div>

                      <div class="form-field-group">
                        <label class="form-field-label" for="comp-input-facturador">10. Facturador Electrónico *</label>
                        <select id="comp-input-facturador" class="form-select-control">
                          <option value="SÍ - AUTORIZADO E-CF (SERIE E)" ${formPrefill.facturadorElectronico === "SÍ - AUTORIZADO E-CF (SERIE E)" ? "selected" : ""}>SÍ - AUTORIZADO E-CF (SERIE E)</option>
                          <option value="EN CERTIFICACIÓN E-CF" ${formPrefill.facturadorElectronico === "EN CERTIFICACIÓN E-CF" ? "selected" : ""}>EN CERTIFICACIÓN E-CF</option>
                          <option value="NO - COMPROBANTES B TRADICIONALES" ${formPrefill.facturadorElectronico === "NO - COMPROBANTES B TRADICIONALES" ? "selected" : ""}>NO - COMPROBANTES B TRADICIONALES</option>
                        </select>
                      </div>

                      <div class="form-field-group">
                        <label class="form-field-label" for="comp-input-vhm">11. Licencias de Comercialización de VHM *</label>
                        <input
                          id="comp-input-vhm"
                          class="form-input-control"
                          type="text"
                          value="${sanitizeTextString(formPrefill.licenciasVhm || "NO APLICA")}"
                          required
                        />
                      </div>

                      <div class="form-field-group">
                        <label class="form-field-label" for="comp-input-servidor">IP Grupo/Servidor SAP Logon</label>
                        <input
                          id="comp-input-servidor"
                          class="form-input-control font-mono"
                          type="text"
                          value="${sanitizeTextString(formPrefill.grupoServidor || "172.16.4.15")}"
                        />
                      </div>
                    </div>

                    <div class="journal-balance-bar is-balanced">
                      <div class="module-toolbar-actions">
                        <button type="submit" class="btn-action btn-primary">
                          ${editingCompanyId ? "Actualizar Empresa y su Logo" : "Guardar Empresa con su Logo y Agregar a SAP Logon"}
                        </button>
                      </div>
                      <span class="badge-pill badge-success">Sincronización Instantánea Firebase</span>
                    </div>
                  </form>
                </div>
              </div>

              <div class="enterprise-panel">
                <div class="enterprise-panel-header">
                  <h3 class="enterprise-panel-title">Ficha Fiscal Completa y Logo de la Empresa</h3>
                  <span class="badge-pill badge-purple">${sanitizeTextString(selectedCompany?.rnc || "-")}</span>
                </div>
                <div class="enterprise-panel-body">
                  ${selectedCompany ? `
                    <div class="search-content-inspector">
                      <div class="inspector-company-logo-banner">
                        <img
                          src="${sanitizeTextString(selectedCompany.logoUrl || DEFAULT_COMPANY_LOGO_PATH)}"
                          alt="Logo ${sanitizeTextString(selectedCompany.nombreComercial)}"
                          class="company-logo-preview-thumb"
                        />
                        <div>
                          <div class="inspector-header">
                            <strong>${sanitizeTextString(selectedCompany.razonSocial)}</strong>
                            <span class="badge-pill badge-success">${sanitizeTextString(selectedCompany.estado)}</span>
                          </div>
                          <span class="module-description">Nombre Comercial: <strong>${sanitizeTextString(selectedCompany.nombreComercial)}</strong></span>
                        </div>
                      </div>
                      <div class="inspector-field-grid">
                        <div class="inspector-field-item">
                          <span class="inspector-field-label">RNC (###-#####-#)</span>
                          <span class="inspector-field-value font-mono col-debit">${sanitizeTextString(selectedCompany.rnc)}</span>
                        </div>
                        <div class="inspector-field-item">
                          <span class="inspector-field-label">Cédula / RNC</span>
                          <span class="inspector-field-value font-mono">${sanitizeTextString(selectedCompany.cedulaRnc)}</span>
                        </div>
                        <div class="inspector-field-item">
                          <span class="inspector-field-label">Nombre Comercial</span>
                          <span class="inspector-field-value">${sanitizeTextString(selectedCompany.nombreComercial)}</span>
                        </div>
                        <div class="inspector-field-item">
                          <span class="inspector-field-label">Categoría</span>
                          <span class="inspector-field-value">${sanitizeTextString(selectedCompany.categoria)}</span>
                        </div>
                        <div class="inspector-field-item">
                          <span class="inspector-field-label">Régimen de Pagos</span>
                          <span class="inspector-field-value">${sanitizeTextString(selectedCompany.regimenPagos)}</span>
                        </div>
                        <div class="inspector-field-item">
                          <span class="inspector-field-label">Administración Local</span>
                          <span class="inspector-field-value">${sanitizeTextString(selectedCompany.administracionLocal)}</span>
                        </div>
                        <div class="inspector-field-item">
                          <span class="inspector-field-label">Facturador Electrónico</span>
                          <span class="inspector-field-value">${sanitizeTextString(selectedCompany.facturadorElectronico)}</span>
                        </div>
                        <div class="inspector-field-item">
                          <span class="inspector-field-label">Licencias VHM</span>
                          <span class="inspector-field-value">${sanitizeTextString(selectedCompany.licenciasVhm)}</span>
                        </div>
                      </div>
                    </div>
                  ` : ""}

                  <hr class="module-header-banner" />

                  <h4 class="enterprise-panel-title">Empresas Registradas (${allCompanies.length}) — Click para Cambiar Logo o Editar</h4>
                  <div class="table-scroll-container">
                    <table class="accounting-table">
                      <thead>
                        <tr>
                          <th>Logo</th>
                          <th>Empresa</th>
                          <th>RNC</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${allCompanies.map((c) => `
                          <tr>
                            <td>
                              <img
                                src="${sanitizeTextString(c.logoUrl || DEFAULT_COMPANY_LOGO_PATH)}"
                                alt="Logo"
                                class="sap-company-row-logo"
                              />
                            </td>
                            <td><strong>${sanitizeTextString(c.nombreComercial)}</strong></td>
                            <td class="font-mono">${sanitizeTextString(c.rnc)}</td>
                            <td>
                              <button type="button" class="btn-action btn-secondary btn-xs btn-quick-edit-company-logo" data-edit-comp-id="${sanitizeTextString(c.id)}">
                                Cambiar Logo / Editar
                              </button>
                            </td>
                          </tr>
                        `).join("")}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          `;
        }

        // ====================================================================
        // 12. SISTEMA DBASE: MÓDULO SOBRE / ABOUT (CONTABILIDAD DBASE / ACCOUNTING DBASE)
        // ====================================================================
        if (activeRibbonItem === "SOBRE_ABOUT") {
          return `
            <div class="enterprise-panel">
              <div class="enterprise-panel-header">
                <h3 class="enterprise-panel-title">Sistema dBase — Sobre / About (Información Oficial de Versión)</h3>
                <span class="badge-pill badge-success">Contabilidad dBase</span>
              </div>
              <div class="enterprise-panel-body">
                <div class="about-dbase-hero-card">
                  <div class="about-dbase-logos-row">
                    <img
                      src="./src/img/logos/easy-data-accounting-brand-logo.jpg"
                      alt="Logo Contabilidad dBase"
                      class="about-dbase-logo-showcase"
                    />
                    <img
                      src="./src/img/icons/easy-data-accounting-favicon.jpg"
                      alt="Icono Accounting dBase"
                      class="about-dbase-icon-showcase"
                    />
                  </div>
                  <div class="about-dbase-system-brand">Contabilidad dBase</div>
                  <h2 class="about-dbase-above-version-title">Accounting dBase</h2>
                  <div class="about-dbase-version-badge">Versión Actual: v5.0.0-ENTERPRISE (Build 2026.11)</div>
                  <div class="about-dbase-below-version-subtitle">Base de datos para Contabilidad</div>
                </div>

                <div class="inspector-field-grid">
                  <div class="inspector-field-item">
                    <span class="inspector-field-label">Nombre Oficial de la Plataforma</span>
                    <span class="inspector-field-value"><strong>Contabilidad dBase</strong></span>
                  </div>
                  <div class="inspector-field-item">
                    <span class="inspector-field-label">Identificador del Motor</span>
                    <span class="inspector-field-value"><strong>Accounting dBase — Base de datos para Contabilidad</strong></span>
                  </div>
                  <div class="inspector-field-item">
                    <span class="inspector-field-label">Versión Actual del Sistema</span>
                    <span class="inspector-field-value font-mono col-debit"><strong>v5.0.0-ENTERPRISE (2026.11)</strong></span>
                  </div>
                  <div class="inspector-field-item">
                    <span class="inspector-field-label">Arquitectura del Sistema</span>
                    <span class="inspector-field-value">13 Módulos 100% Independientes Acoplados por Seguridad</span>
                  </div>
                  <div class="inspector-field-item">
                    <span class="inspector-field-label">Motor de Base de Datos</span>
                    <span class="inspector-field-value">Google Firebase Cloud + Adaptador Agnóstico Migrable</span>
                  </div>
                  <div class="inspector-field-item">
                    <span class="inspector-field-label">Conectores Windows Server</span>
                    <span class="inspector-field-value font-mono">LDAP (172.16.4.2:389) &amp; RADIUS NPS (172.16.4.3:1812)</span>
                  </div>
                  <div class="inspector-field-item">
                    <span class="inspector-field-label">Gobierno de Permisos</span>
                    <span class="inspector-field-value">${departments.length} Departamentos y ${permissionGroups.length} Grupos Modulares</span>
                  </div>
                  <div class="inspector-field-item">
                    <span class="inspector-field-label">Empresa Activa en Sesión</span>
                    <span class="inspector-field-value">${sanitizeTextString(activeCompany?.nombreComercial || "-")} (RNC: ${sanitizeTextString(activeCompany?.rnc || "-")})</span>
                  </div>
                </div>
              </div>
            </div>
          `;
        }

        // ====================================================================
        // 12.1 SISTEMA DBASE: OPCIONES DEL SISTEMA (AUTO-OCULTAR, CONTRASEÑAS LOCALES Y SERVICIO)
        // ====================================================================
        if (activeRibbonItem === "OPCIONES_SISTEMA") {
          const isSidebarAutoHide = localStorage.getItem("EDA_SIDEBAR_AUTOHIDE_V1") !== "false";
          const isCintaAutoHide = localStorage.getItem("EDA_CINTA_RAIL_AUTOHIDE_V1") === "true";
          return `
            <div class="workspace-split-layout">
              <div class="enterprise-panel">
                <div class="enterprise-panel-header">
                  <h3 class="enterprise-panel-title">Opciones del Sistema — Preferencias y Comportamiento</h3>
                  <span class="badge-pill badge-info">Sistema dBase</span>
                </div>
                <div class="enterprise-panel-body">
                  <div class="search-content-inspector">
                    <h4 class="enterprise-panel-title">1. Comportamiento de Navegación (Estilo Microsoft 365)</h4>
                    <p class="module-description">
                      Configure cómo se comportan los paneles de módulos y menús al trabajar en la plataforma.
                    </p>

                    <div class="form-grid-layout">
                      <div class="form-field-group">
                        <label class="protocol-checkbox-label">
                          <input type="checkbox" id="chk-opt-sidebar-autohide" class="protocol-checkbox-input" ${isSidebarAutoHide ? "checked" : ""} />
                          <span><strong>Ocultar automáticamente el menú de módulos a la izquierda (solo iconos)</strong></span>
                        </label>
                        <span class="module-description">Al seleccionar un módulo o interactuar con el área de trabajo, el panel se contrae a 56px dejando solo la columna de iconos con indicador vertical azul.</span>
                      </div>

                      <div class="form-field-group">
                        <label class="protocol-checkbox-label">
                          <input type="checkbox" id="chk-opt-cinta-autohide" class="protocol-checkbox-input" ${isCintaAutoHide ? "checked" : ""} />
                          <span><strong>Ocultar automáticamente la cinta vertical de configuración a iconos</strong></span>
                        </label>
                        <span class="module-description">La cinta vertical de opciones se contrae automáticamente a 56px mostrando solo iconos al elegir una subvista.</span>
                      </div>
                    </div>

                    <hr class="module-header-banner" />

                    <h4 class="enterprise-panel-title">2. Autenticación Web y Respaldo Local (Offline Contingency)</h4>
                    <p class="module-description">
                      Cuando la plataforma se ejecute desde la web pública o en la nube sin alcance al controlador de dominio Windows Server (172.16.4.2), los usuarios registrados podrán autenticarse con su contraseña local sincronizada.
                    </p>

                    <div class="inspector-field-grid">
                      <div class="inspector-field-item">
                        <span class="inspector-field-label">Control de Entrada Web</span>
                        <span class="inspector-field-value"><strong>Pantalla de Login Obligatoria Activa</strong></span>
                      </div>
                      <div class="inspector-field-item">
                        <span class="inspector-field-label">Respaldo Local por Usuario</span>
                        <span class="inspector-field-value font-mono col-debit"><strong>Sincronizado con Correo y Contraseña</strong></span>
                      </div>
                      <div class="inspector-field-item">
                        <span class="inspector-field-label">Empresas con Windows Server</span>
                        <span class="inspector-field-value">${allCompanies.filter(c => getAuthConnectionConfigurations(c.id).windowsConnectorEnabled).length} Sociedades Habilitadas</span>
                      </div>
                      <div class="inspector-field-item">
                        <span class="inspector-field-label">Usuarios con Respaldo Web</span>
                        <span class="inspector-field-value">${allAdUsers.length} Cuentas Listas para Acceso Web</span>
                      </div>
                    </div>

                    <hr class="module-header-banner" />

                    <h4 class="enterprise-panel-title">3. Estado del Servicio de Windows en esta Máquina</h4>
                    <div class="module-toolbar-actions">
                      <button type="button" id="btn-opt-test-service" class="btn-action btn-primary btn-xs">
                        Probar Servicio Windows (Gateway)
                      </button>
                      <button type="button" class="btn-action btn-secondary btn-xs" data-go-ribbon="SERVICIO_WINDOWS">
                        Ver Comandos del Servicio
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Lista de Usuarios y Contraseñas Locales de Respaldo -->
              <div class="enterprise-panel">
                <div class="enterprise-panel-header">
                  <h3 class="enterprise-panel-title">Usuarios y Credenciales de Respaldo Web (${allAdUsers.length})</h3>
                  <span class="badge-pill badge-success">Acceso Web Seguro</span>
                </div>
                <div class="enterprise-panel-body">
                  <p class="module-description">
                    Cada usuario traído desde LDAP, RADIUS o creado manualmente posee una contraseña local vinculada a su correo corporativo para garantizar el acceso desde la web si el dominio está fuera.
                  </p>
                  <div class="table-scroll-container">
                    <table class="accounting-table">
                      <thead>
                        <tr>
                          <th>Usuario Dominio</th>
                          <th>Correo Vinculado</th>
                          <th>Contraseña Local Respaldo</th>
                          <th>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${allAdUsers.map((u) => `
                          <tr>
                            <td class="font-mono"><strong>${sanitizeTextString(u.username)}</strong></td>
                            <td class="font-mono">${sanitizeTextString(u.email || "-")}</td>
                            <td class="font-mono">
                              <span class="badge-pill badge-info">●●●●●●●●</span>
                            </td>
                            <td>
                              <button type="button" class="btn-action btn-secondary btn-xs btn-edit-user-local-pass" data-user-id="${sanitizeTextString(u.id)}" data-username="${sanitizeTextString(u.username)}" data-email="${sanitizeTextString(u.email || "")}">
                                Modificar Contraseña
                              </button>
                            </td>
                          </tr>
                        `).join("")}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          `;
        }

        // 13. EMPRESAS: SELECTOR SAP LOGON 800 (POR DEFECTO EN EMPRESAS)
        return `
          <div class="sap-logon-window">
            <div class="sap-logon-titlebar">
              <span>SAP Logon 800 — Selector Corporativo de Empresas y Conexiones Contabilidad dBase</span>
              <span class="badge-pill badge-info">Conectado: ${sanitizeTextString(activeCompany?.nombreComercial || "-")} (RNC: ${sanitizeTextString(activeCompany?.rnc || "-")})</span>
            </div>

            <div class="sap-logon-toolbar">
              <div class="sap-logon-actions-left">
                <span class="sap-logon-link-btn">Acceso variable</span>
                <button type="button" id="btn-sap-new-company" class="btn-action btn-secondary btn-xs">
                  + Nueva Empresa
                </button>
                <button type="button" id="btn-sap-edit-company" class="btn-action btn-secondary btn-xs">
                  Editar / Cambiar Logo
                </button>
                <button type="button" id="btn-sap-delete-company" class="btn-action btn-danger btn-xs">
                  Eliminar
                </button>
              </div>
              <div>
                <select id="sap-workspace-view-select" class="form-select-control">
                  <option value="Local">Vista de área de trabajo</option>
                  <option value="GRAN CONTRIBUYENTE NACIONAL">Filtrar: Grandes Contribuyentes</option>
                  <option value="MEDIANO CONTRIBUYENTE">Filtrar: Medianos Contribuyentes</option>
                </select>
              </div>
            </div>

            <div class="sap-logon-subbar">
              <strong>Conexiones (${filteredCompanies.length} Sociedades Registradas)</strong>
              <div>
                <input
                  type="search"
                  id="sap-filter-elements-input"
                  class="sap-logon-filter-input"
                  placeholder="Filtrar elementos (RNC, Nombre, Servidor)..."
                  value="${sanitizeTextString(localFilter)}"
                />
              </div>
            </div>

            <div class="sap-logon-body-split">
              <div class="sap-logon-workspace-tree">
                <div class="sap-tree-header">Áreas de trabajo</div>
                <div class="sap-tree-node ${activeWorkspaceArea === "Local" ? "is-active-node" : ""}" data-area="Local">
                  <span>Local (Todas)</span>
                  <span class="badge-pill badge-info">${allCompanies.length}</span>
                </div>
                <div class="sap-tree-node ${activeWorkspaceArea === "GRAN CONTRIBUYENTE NACIONAL" ? "is-active-node" : ""}" data-area="GRAN CONTRIBUYENTE NACIONAL">
                  <span>Grandes Contrib.</span>
                </div>
                <div class="sap-tree-node ${activeWorkspaceArea === "MEDIANO CONTRIBUYENTE" ? "is-active-node" : ""}" data-area="MEDIANO CONTRIBUYENTE">
                  <span>Medianos Contrib.</span>
                </div>
                <div class="sap-tree-node ${activeWorkspaceArea === "MIPYMES / CONTRIBUYENTE ESPECIAL" ? "is-active-node" : ""}" data-area="MIPYMES / CONTRIBUYENTE ESPECIAL">
                  <span>Régimen Especial</span>
                </div>
              </div>

              <div class="sap-logon-connections-grid">
                <table class="sap-connections-table">
                  <thead>
                    <tr>
                      <th>Logo &amp; Nombre</th>
                      <th>Descripción del sistema (Razón Social)</th>
                      <th>IdS</th>
                      <th>RNC (###-#####-#)</th>
                      <th>Grupo/Servidor (Adm. Local)</th>
                      <th>Nú...</th>
                      <th>Estado</th>
                      <th>Facturador e-CF</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredCompanies.map((comp) => `
                      <tr
                        class="sap-connection-row ${selectedCompany?.id === comp.id ? "is-sap-selected" : ""}"
                        data-comp-id="${sanitizeTextString(comp.id)}"
                      >
                        <td>
                          <div class="sap-company-row-cell">
                            <img
                              src="${sanitizeTextString(comp.logoUrl || DEFAULT_COMPANY_LOGO_PATH)}"
                              alt="Logo"
                              class="sap-company-row-logo"
                            />
                            <strong>${highlightSearchMatchSafe(comp.nombreComercial, localFilter)}</strong>
                          </div>
                        </td>
                        <td>${highlightSearchMatchSafe(comp.razonSocial, localFilter)}</td>
                        <td class="font-mono">${highlightSearchMatchSafe(comp.idSistema || "ERP", localFilter)}</td>
                        <td class="font-mono col-debit"><strong>${highlightSearchMatchSafe(comp.rnc, localFilter)}</strong></td>
                        <td class="font-mono">${highlightSearchMatchSafe(comp.grupoServidor || comp.administracionLocal, localFilter)}</td>
                        <td class="font-mono">${sanitizeTextString(comp.numeroSistema || "00")}</td>
                        <td>
                          <span class="badge-pill ${comp.estado === "ACTIVO" ? "badge-success" : "badge-warning"}">
                            ${sanitizeTextString(comp.estado)}
                          </span>
                        </td>
                        <td>${highlightSearchMatchSafe(comp.facturadorElectronico, localFilter)}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="sap-logon-footer">
              <div class="module-description">
                Seleccionada: <strong>${sanitizeTextString(selectedCompany?.nombreComercial || "-")}</strong> |
                RNC: <span class="font-mono">${sanitizeTextString(selectedCompany?.rnc || "-")}</span> |
                Doble clic en la fila o pulse "Acceder al sistema" para activar la empresa.
              </div>
              <button type="button" id="btn-sap-access-system" class="btn-sap-access">
                Acceder al sistema
              </button>
            </div>
          </div>
        `;
      };

      containerEl.innerHTML = `
        <div class="stats-kpi-grid">${kpisHtml}</div>

        <div class="cinta-vertical-config-layout">
          ${renderVerticalCollapsibleRibbonHtml()}
          <div class="cinta-vertical-content">
            ${renderActiveRibbonContentHtml()}
          </div>
        </div>
      `;

      // ====================================================================
      // EVENTOS DE LA CINTA VERTICAL CONTRAÍBLE (MICROSOFT 365 ICONOS Y GRUPOS)
      // ====================================================================
      containerEl.querySelector("#btn-cinta-rail-toggle")?.addEventListener("click", () => {
        isCintaRailCollapsed = !isCintaRailCollapsed;
        localStorage.setItem("EDA_CINTA_RAIL_COLLAPSED_V1", isCintaRailCollapsed ? "true" : "false");
        const cintaAside = containerEl.querySelector(".cinta-vertical-sidebar");
        if (cintaAside) {
          cintaAside.classList.toggle("is-rail-collapsed", isCintaRailCollapsed);
        }
      });

      containerEl.querySelector("#chk-cinta-rail-autohide")?.addEventListener("change", (e) => {
        isCintaAutoHide = Boolean(e.target.checked);
        localStorage.setItem("EDA_CINTA_RAIL_AUTOHIDE_V1", isCintaAutoHide ? "true" : "false");
        dispatchEnterpriseToast({
          title: isCintaAutoHide ? "Auto-ocultar cinta activado" : "Auto-ocultar cinta desactivado",
          message: isCintaAutoHide
            ? "La cinta vertical se contraerá mostrando solo los iconos al seleccionar una opción."
            : "La cinta vertical permanecerá expandida hasta que pulse el botón ☰.",
          variant: "info"
        });
      });

      containerEl.querySelectorAll("[data-toggle-ribbon-group]").forEach((grpBtn) => {
        grpBtn.addEventListener("click", () => {
          const grpId = grpBtn.getAttribute("data-toggle-ribbon-group");
          const grpEl = grpBtn.closest(".sidebar-section-group");
          if (grpEl) {
            grpEl.classList.toggle("is-collapsed");
            if (grpEl.classList.contains("is-collapsed")) {
              collapsedRibbonGroups.add(grpId);
            } else {
              collapsedRibbonGroups.delete(grpId);
            }
          }
        });
      });

      containerEl.querySelectorAll("[data-ribbon-item]").forEach((itemBtn) => {
        itemBtn.addEventListener("click", () => {
          activeRibbonItem = itemBtn.getAttribute("data-ribbon-item");
          if (isCintaAutoHide) {
            isCintaRailCollapsed = true;
            localStorage.setItem("EDA_CINTA_RAIL_COLLAPSED_V1", "true");
          }
          renderContent();
        });
      });

      containerEl.querySelectorAll("[data-go-ribbon]").forEach((jumpBtn) => {
        jumpBtn.addEventListener("click", () => {
          activeRibbonItem = jumpBtn.getAttribute("data-go-ribbon");
          renderContent();
        });
      });

      // ====================================================================
      // EVENTOS DE SEGMENTACIÓN DEL CONECTOR WINDOWS SERVER POR EMPRESA
      // ====================================================================
      containerEl.querySelector("#select-company-for-auth-config")?.addEventListener("change", (e) => {
        configCompanyId = e.target.value;
        const chosenComp = allCompanies.find((c) => c.id === configCompanyId);
        if (chosenComp) {
          dispatchEnterpriseToast({
            title: `Configurando conexiones de: ${chosenComp.nombreComercial}`,
            message: `RNC: ${chosenComp.rnc} — Configuración aislada para esta empresa.`,
            variant: "info"
          });
        }
        renderContent();
      });

      const handleToggleCompanyWindowsConnector = (enableFlag) => {
        if (!targetConfigCompany) {
          return;
        }
        const updated = saveAuthConnectionConfigurations(
          {
            windowsConnectorEnabled: Boolean(enableFlag),
            activeProtocol: enableFlag ? "LDAP" : "LOCAL"
          },
          targetConfigCompany.id
        );
        syncCompanyAuthTelemetryToShell();

        dispatchEnterpriseToast({
          title: updated.windowsConnectorEnabled
            ? `Windows Server Habilitado en ${targetConfigCompany.nombreComercial}`
            : `Windows Server Desactivado en ${targetConfigCompany.nombreComercial}`,
          message: updated.windowsConnectorEnabled
            ? `La empresa ${targetConfigCompany.nombreComercial} ahora permite conexión por LDAP y RADIUS.`
            : `La empresa ${targetConfigCompany.nombreComercial} opera de forma independiente (LOCAL / OAuth) sin LDAP ni RADIUS.`,
          variant: updated.windowsConnectorEnabled ? "success" : "info"
        });

        renderContent();
      };

      containerEl.querySelector("#toggle-company-windows-connector")?.addEventListener("change", (e) => {
        handleToggleCompanyWindowsConnector(e.target.checked);
      });

      containerEl.querySelector("#btn-enable-win-connector-now")?.addEventListener("click", () => {
        handleToggleCompanyWindowsConnector(true);
      });

      // ====================================================================
      // EVENTOS 1: RADIUS (AC_TIC - 172.16.4.3:1812)
      // ====================================================================
      containerEl.querySelectorAll(".radius-live-field").forEach((inputEl) => {
        inputEl.addEventListener("input", () => {
          const wrapper = containerEl.querySelector("#radius-live-status-wrapper");
          const icon = containerEl.querySelector("#radius-live-status-icon");
          const text = containerEl.querySelector("#radius-live-status-text");
          if (wrapper && icon && text) {
            wrapper.className = "ldap-status-indicator is-pending";
            icon.className = "ldap-status-check is-pending";
            icon.textContent = "!";
            text.textContent = "Shared Key / IP modificada — Pulse 'OK (Probar y Guardar)' para validar en NPS";
          }
        });
      });

      const radiusForm = containerEl.querySelector("#form-radius-config");
      if (radiusForm) {
        radiusForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const sharedKey = containerEl.querySelector("#rad-shared-key").value;
          const retypeKey = containerEl.querySelector("#rad-retype-key").value;

          if (sharedKey !== retypeKey) {
            dispatchEnterpriseToast({
              title: "Error de Clave Compartida RADIUS",
              message: "Shared key y Retype key deben coincidir exactamente.",
              variant: "danger"
            });
            return;
          }

          const newRadiusCfg = {
            profileName: "AC_TIC",
            radSec: containerEl.querySelector("#rad-radsec").checked,
            ipAddress: containerEl.querySelector("#rad-ip").value.trim(),
            authPort: containerEl.querySelector("#rad-auth-port").value.trim(),
            accountingPort: containerEl.querySelector("#rad-acct-port").value.trim(),
            sharedKey,
            retypeKey,
            timeoutSec: containerEl.querySelector("#rad-timeout").value.trim(),
            retryCount: containerEl.querySelector("#rad-retry").value.trim(),
            dynamicAuthorization: containerEl.querySelector("#rad-dyn-auth").checked,
            statusServerAuth: containerEl.querySelector("#rad-status-auth").checked,
            statusServerAccounting: containerEl.querySelector("#rad-status-acct").checked,
            nasIpAddress: containerEl.querySelector("#rad-nas-ip").value.trim(),
            nasIdentifier: containerEl.querySelector("#rad-nas-id").value.trim()
          };

          const radiusVerify = await verifyRealRadiusWithGateway(newRadiusCfg);
          newRadiusCfg.connectionStatus = radiusVerify.statusText;
          newRadiusCfg.statusState = radiusVerify.statusState;

          saveAuthConnectionConfigurations(
            { windowsConnectorEnabled: true, activeProtocol: "RADIUS", radius: newRadiusCfg },
            targetConfigCompany?.id
          );
          syncCompanyAuthTelemetryToShell();

          if (radiusVerify.success) {
            dispatchEnterpriseToast({
              title: `RADIUS Verificado (${targetConfigCompany?.nombreComercial || "Empresa"})`,
              message: radiusVerify.detail,
              variant: "success"
            });
          } else {
            dispatchEnterpriseToast({
              title: radiusVerify.statusText,
              message: radiusVerify.detail,
              variant: "danger"
            });
          }

          renderContent();
        });
      }

      // ====================================================================
      // EVENTOS 2: LDAP (DC01 - 172.16.4.2:389)
      // ====================================================================
      containerEl.querySelectorAll(".ldap-live-field").forEach((inputEl) => {
        inputEl.addEventListener("input", () => {
          const wrapper = containerEl.querySelector("#ldap-live-status-wrapper");
          const icon = containerEl.querySelector("#ldap-live-status-icon");
          const text = containerEl.querySelector("#ldap-live-status-text");
          if (wrapper && icon && text) {
            wrapper.className = "ldap-status-indicator is-pending";
            icon.className = "ldap-status-check is-pending";
            icon.textContent = "!";
            text.textContent = "Credenciales modificadas — Pulse 'Test Connectivity' para validar contra el servidor AD";
          }
        });
      });

      containerEl.querySelectorAll(".bind-type-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const bindVal = btn.getAttribute("data-bind");
          const current = getAuthConnectionConfigurations(targetConfigCompany?.id);
          current.ldap.bindType = bindVal;
          current.ldap.statusState = "PENDING";
          current.ldap.connectionStatus = `Bind Type cambiado a ${bindVal} — Pulse Test Connectivity`;
          saveAuthConnectionConfigurations(current, targetConfigCompany?.id);
          renderContent();
        });
      });

      const browseDnBtn = containerEl.querySelector("#btn-ldap-browse-dn");
      if (browseDnBtn) {
        browseDnBtn.addEventListener("click", () => {
          const dnInput = containerEl.querySelector("#ldap-dn");
          if (dnInput) {
            const suggestions = [
              "dc=laantillana,dc=local",
              "OU=Usuarios,dc=laantillana,dc=local",
              "OU=Contabilidad,dc=laantillana,dc=local"
            ];
            const idx = suggestions.indexOf(dnInput.value);
            dnInput.value = suggestions[(idx + 1) % suggestions.length];
          }
        });
      }

      const changeLdapPwdBtn = containerEl.querySelector("#btn-ldap-change-pwd");
      if (changeLdapPwdBtn) {
        changeLdapPwdBtn.addEventListener("click", () => {
          const pwdInput = containerEl.querySelector("#ldap-password");
          if (pwdInput) {
            pwdInput.type = pwdInput.type === "password" ? "text" : "password";
            pwdInput.focus();
          }
        });
      }

      const collectCurrentLdapFormValues = () => ({
        name: containerEl.querySelector("#ldap-name")?.value.trim() || "DC01",
        serverIpName: containerEl.querySelector("#ldap-server-ip")?.value.trim() || "172.16.4.2",
        serverPort: containerEl.querySelector("#ldap-port")?.value.trim() || "389",
        commonNameIdentifier: containerEl.querySelector("#ldap-cn-id")?.value.trim() || "sAMAccountName",
        distinguishedName: containerEl.querySelector("#ldap-dn")?.value.trim() || "dc=laantillana,dc=local",
        exchangeServer: Boolean(containerEl.querySelector("#ldap-exchange")?.checked),
        bindType: connConfigs.ldap.bindType || "Regular",
        username: containerEl.querySelector("#ldap-username")?.value.trim() || "laantillana\\nps",
        password: containerEl.querySelector("#ldap-password")?.value || "",
        secureConnection: Boolean(containerEl.querySelector("#ldap-secure")?.checked)
      });

      const runRealLdapConnectivityCheck = async () => {
        const draftLdap = collectCurrentLdapFormValues();
        const verifyOutcome = await verifyRealLdapCredentialsWithGateway(draftLdap);
        draftLdap.connectionStatus = verifyOutcome.statusText;
        draftLdap.statusState = verifyOutcome.statusState;
        saveAuthConnectionConfigurations(
          { windowsConnectorEnabled: true, activeProtocol: "LDAP", ldap: draftLdap },
          targetConfigCompany?.id
        );
        syncCompanyAuthTelemetryToShell();

        dispatchEnterpriseToast({
          title: verifyOutcome.success
            ? `LDAP Bind Successful (${targetConfigCompany?.nombreComercial || "Empresa"})`
            : verifyOutcome.statusText,
          message: verifyOutcome.detail,
          variant: verifyOutcome.success ? "success" : "danger"
        });
        renderContent();
      };

      containerEl.querySelector("#btn-ldap-test-connectivity")?.addEventListener("click", runRealLdapConnectivityCheck);
      containerEl.querySelector("#form-ldap-config")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        await runRealLdapConnectivityCheck();
      });

      containerEl.querySelector("#btn-ldap-open-test-user-drawer")?.addEventListener("click", () => {
        isLdapTestCredentialsDrawerOpen = true;
        ldapDrawerFeedback = null;
        renderContent();
      });

      containerEl.querySelector("#btn-close-ldap-drawer")?.addEventListener("click", () => {
        isLdapTestCredentialsDrawerOpen = false;
        renderContent();
      });

      const testUserCredsForm = containerEl.querySelector("#form-ldap-test-user-creds");
      if (testUserCredsForm) {
        testUserCredsForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const testUsername = containerEl.querySelector("#test-ldap-user-input").value.trim();
          const testPassword = containerEl.querySelector("#test-ldap-pass-input").value;
          const permGroupId = containerEl.querySelector("#test-ldap-perm-group").value;

          const fetchResult = await fetchAndAuthenticateUserFromLdapGateway({
            serverIpName: connConfigs.ldap.serverIpName,
            serverPort: connConfigs.ldap.serverPort,
            secureConnection: connConfigs.ldap.secureConnection,
            bindUsername: connConfigs.ldap.username,
            bindPassword: connConfigs.ldap.password,
            distinguishedName: connConfigs.ldap.distinguishedName,
            targetUsername: testUsername,
            userPasswordToAuthenticate: testPassword
          });

          ldapDrawerFeedback = {
            success: fetchResult.success,
            title: fetchResult.statusText,
            detail: fetchResult.detail
          };

          if (fetchResult.success && fetchResult.userProfile) {
            const registeredUser = await registerFetchedAdOrRadiusUserWithPermissions({
              userProfile: fetchResult.userProfile,
              permissionGroupId: permGroupId
            });
            selectedUserForPermId = registeredUser.id;

            await registerUserCompanyEntry({
              usernameOrEmail: registeredUser.username,
              fullName: `${registeredUser.fullName} [${registeredUser.assignedPermissionGroupName}]`,
              authMethod: "LDAP_AD_VERIFIED",
              code16Used: registeredUser.assignedPermissionGroupId,
              companyRecord: activeCompany
            });

            dispatchEnterpriseToast({
              title: "Usuario Autenticado y Permisos Asignados",
              message: `${registeredUser.username} ahora usa los permisos de '${registeredUser.assignedPermissionGroupName}'.`,
              variant: "success"
            });
          } else {
            dispatchEnterpriseToast({
              title: "Error de Autenticación LDAP",
              message: `${fetchResult.statusText} — ${fetchResult.detail}`,
              variant: "danger"
            });
          }

          renderContent();
        });
      }

      // ====================================================================
      // EVENTOS 3: TRAER Y AUTENTICAR USUARIO DESDE LDAP O RADIUS
      // ====================================================================
      const fetchAdRadiusForm = containerEl.querySelector("#form-fetch-ad-radius-user");
      if (fetchAdRadiusForm) {
        fetchAdRadiusForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const sourceProtocol = containerEl.querySelector("#fetch-protocol-select").value;
          const targetUsername = containerEl.querySelector("#fetch-username-input").value.trim();
          const userPassword = containerEl.querySelector("#fetch-user-password-input").value;
          const permGroupId = containerEl.querySelector("#fetch-assign-perm-group-select").value;

          let fetchOutcome;
          if (sourceProtocol === "LDAP") {
            fetchOutcome = await fetchAndAuthenticateUserFromLdapGateway({
              serverIpName: connConfigs.ldap.serverIpName,
              serverPort: connConfigs.ldap.serverPort,
              secureConnection: connConfigs.ldap.secureConnection,
              bindUsername: connConfigs.ldap.username,
              bindPassword: connConfigs.ldap.password,
              distinguishedName: connConfigs.ldap.distinguishedName,
              targetUsername,
              userPasswordToAuthenticate: userPassword
            });
          } else {
            fetchOutcome = await fetchAndAuthenticateUserFromRadiusGateway({
              radiusIp: connConfigs.radius.ipAddress,
              radiusPort: connConfigs.radius.authPort,
              sharedKey: connConfigs.radius.sharedKey,
              nasIpAddress: connConfigs.radius.nasIpAddress,
              nasIdentifier: connConfigs.radius.nasIdentifier,
              ldapIp: connConfigs.ldap.serverIpName,
              ldapPort: connConfigs.ldap.serverPort,
              bindUsername: connConfigs.ldap.username,
              bindPassword: connConfigs.ldap.password,
              distinguishedName: connConfigs.ldap.distinguishedName,
              targetUsername,
              userPasswordToAuthenticate: userPassword
            });
          }

          fetchedUserFeedback = {
            success: fetchOutcome.success,
            title: fetchOutcome.statusText,
            detail: fetchOutcome.detail
          };

          if (fetchOutcome.success && fetchOutcome.userProfile) {
            const savedUser = await registerFetchedAdOrRadiusUserWithPermissions({
              userProfile: fetchOutcome.userProfile,
              permissionGroupId: permGroupId
            });
            selectedUserForPermId = savedUser.id;

            await registerUserCompanyEntry({
              usernameOrEmail: savedUser.username,
              fullName: `${savedUser.fullName} (${savedUser.assignedPermissionGroupName})`,
              authMethod: sourceProtocol === "LDAP" ? "LDAP_USER_PULLED" : "RADIUS_USER_PULLED",
              code16Used: savedUser.assignedPermissionGroupId,
              companyRecord: activeCompany
            });

            dispatchEnterpriseToast({
              title: `Usuario Traído desde ${sourceProtocol}`,
              message: `${savedUser.username} (${savedUser.fullName}) configurado con los permisos de '${savedUser.assignedPermissionGroupName}'.`,
              variant: "success"
            });
          } else {
            dispatchEnterpriseToast({
              title: fetchOutcome.statusText || "Error al traer usuario",
              message: fetchOutcome.detail || "Verifique las credenciales y la conexión al servidor.",
              variant: "danger"
            });
          }

          renderContent();
        });
      }

      containerEl.querySelectorAll(".fetched-user-row").forEach((row) => {
        row.addEventListener("click", (e) => {
          if (e.target.closest(".btn-activate-fetched-user")) {
            return;
          }
          selectedUserForPermId = row.getAttribute("data-sel-uid");
          activeRibbonItem = "ASIGNAR_USUARIO";
          renderContent();
        });
      });

      containerEl.querySelectorAll(".btn-activate-fetched-user").forEach((btn) => {
        btn.addEventListener("click", () => {
          const uid = btn.getAttribute("data-act-uid");
          const usr = allAdUsers.find((u) => u.id === uid);
          if (usr) {
            switchActiveUserSecuritySession(usr);
            const headerUserEl = document.getElementById("header-active-ad-user");
            if (headerUserEl) {
              headerUserEl.textContent = `${usr.username} (${usr.assignedPermissionGroupName || usr.erpRole})`;
            }
            dispatchEnterpriseToast({
              title: `Sesión Activa: ${usr.username}`,
              message: `Operando con los permisos de '${usr.assignedPermissionGroupName || usr.erpRole}' [${usr.assignedDepartmentName || "TI"}].`,
              variant: "info"
            });
            renderContent();
          }
        });
      });

      // ====================================================================
      // EVENTOS 4: LOCAL Y OAUTH CORREO
      // ====================================================================
      const localUserForm = containerEl.querySelector("#form-create-local-user");
      if (localUserForm) {
        localUserForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const samAccount = containerEl.querySelector("#loc-usr-account").value.trim();
          const fullName = containerEl.querySelector("#loc-usr-fullname").value.trim();
          const email = containerEl.querySelector("#loc-usr-email").value.trim();
          const permGroupId = containerEl.querySelector("#loc-usr-perm-group").value;

          const createdUser = await registerFetchedAdOrRadiusUserWithPermissions({
            userProfile: {
              samAccount,
              username: `LOCAL\\${samAccount}`,
              fullName,
              email,
              distinguishedName: "LOCAL_DB",
              authProtocol: "LOCAL_MANUAL"
            },
            permissionGroupId: permGroupId
          });
          selectedUserForPermId = createdUser.id;

          await registerUserCompanyEntry({
            usernameOrEmail: createdUser.username,
            fullName: `${createdUser.fullName} (${createdUser.assignedPermissionGroupName})`,
            authMethod: "LOCAL_MANUAL",
            code16Used: createdUser.assignedPermissionGroupId,
            companyRecord: activeCompany
          });

          dispatchEnterpriseToast({
            title: "Usuario Local Creado con Permisos",
            message: `${createdUser.username} usa los permisos de '${createdUser.assignedPermissionGroupName}'.`,
            variant: "success"
          });
          renderContent();
        });
      }

      containerEl.querySelector("#btn-regenerate-16-code")?.addEventListener("click", () => {
        generated16Code = generateSixteenCharacterAccessCode();
        renderContent();
      });

      containerEl.querySelector("#btn-copy-16-code")?.addEventListener("click", () => {
        const codeInput = containerEl.querySelector("#oauth-code16-input");
        if (codeInput) {
          codeInput.value = generated16Code;
        }
      });

      const oauthForm = containerEl.querySelector("#form-oauth-email-verify");
      if (oauthForm) {
        oauthForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const email = containerEl.querySelector("#oauth-email-input").value.trim();
          const fullName = containerEl.querySelector("#oauth-fullname-input").value.trim();
          const code16 = containerEl.querySelector("#oauth-code16-input").value.trim().toUpperCase();
          const permGroupId = containerEl.querySelector("#oauth-perm-group-select").value;

          if (code16.length !== 16) {
            dispatchEnterpriseToast({
              title: "Código de 16 Caracteres Inválido",
              message: "El código debe tener exactamente 16 caracteres.",
              variant: "danger"
            });
            return;
          }

          const createdUser = await registerFetchedAdOrRadiusUserWithPermissions({
            userProfile: {
              samAccount: email.split("@")[0],
              username: email,
              fullName,
              email,
              distinguishedName: "OAUTH_EMAIL_16CHAR",
              authProtocol: "OAUTH_CORREO_16"
            },
            permissionGroupId: permGroupId
          });
          selectedUserForPermId = createdUser.id;

          await registerUserCompanyEntry({
            usernameOrEmail: email,
            fullName: `${fullName} (${createdUser.assignedPermissionGroupName})`,
            authMethod: "OAUTH_CORREO_16",
            code16Used: code16,
            companyRecord: activeCompany
          });

          generated16Code = generateSixteenCharacterAccessCode();
          dispatchEnterpriseToast({
            title: "Acceso OAuth Registrado con Permisos",
            message: `${email} usa los permisos de '${createdUser.assignedPermissionGroupName}'.`,
            variant: "success"
          });
          renderContent();
        });
      }

      // ====================================================================
      // EVENTOS 4.1: SERVICIO DE WINDOWS (GATEWAY AD/RADIUS)
      // ====================================================================
      containerEl.querySelector("#btn-check-gateway-status-live")?.addEventListener("click", async () => {
        const statusRes = await checkGatewayServiceStatus();
        const pill = containerEl.querySelector("#gateway-service-live-status-pill");
        if (pill) {
          pill.className = `badge-pill ${statusRes.online ? "badge-success" : "badge-danger"}`;
          pill.textContent = statusRes.online
            ? `ONLINE (${statusRes.latencyMs}ms — ${statusRes.service})`
            : "OFFLINE (Puerto 3890 no responde)";
        }
        dispatchEnterpriseToast({
          title: statusRes.online ? "Servicio de Windows ONLINE" : "Servicio de Windows OFFLINE",
          message: statusRes.online
            ? `El servicio ContabilidadDbaseGateway respondió en ${statusRes.latencyMs}ms en http://127.0.0.1:${statusRes.port}.`
            : "El servicio no está en ejecución. Ejecute 'npm run service:start' o 'install-windows-service.bat'.",
          variant: statusRes.online ? "success" : "danger"
        });
      });

      containerEl.querySelectorAll(".btn-copy-cmd-text").forEach((btn) => {
        btn.addEventListener("click", () => {
          const val = btn.getAttribute("data-copy-val");
          if (val && navigator.clipboard) {
            navigator.clipboard.writeText(val);
            dispatchEnterpriseToast({
              title: "Comando Copiado",
              message: `'${val}' copiado al portapapeles. Péguelo en su PowerShell o CMD con privilegios de Administrador.`,
              variant: "info"
            });
          }
        });
      });

      containerEl.querySelectorAll(".btn-jump-assign-perm").forEach((btn) => {
        btn.addEventListener("click", () => {
          const logUser = btn.getAttribute("data-log-user") || "";
          const found = allAdUsers.find((u) => u.username.toLowerCase() === logUser.toLowerCase());
          if (found) {
            selectedUserForPermId = found.id;
          }
          activeRibbonItem = "ASIGNAR_USUARIO";
          renderContent();
        });
      });

      // ====================================================================
      // EVENTOS 5: PERMISOS Y DEPARTAMENTOS (ASIGNAR GRUPO A USUARIO, CREAR DEPTO, MATRIZ)
      // ====================================================================
      const assignUserSelect = containerEl.querySelector("#assign-select-user");
      if (assignUserSelect) {
        assignUserSelect.addEventListener("change", (e) => {
          selectedUserForPermId = e.target.value;
          renderContent();
        });
      }

      const assignFilterDept = containerEl.querySelector("#assign-filter-dept");
      if (assignFilterDept) {
        assignFilterDept.addEventListener("change", (e) => {
          filterDeptForUserSelect = e.target.value;
          renderContent();
        });
      }

      containerEl.querySelectorAll(".user-perm-select-row").forEach((row) => {
        row.addEventListener("click", () => {
          selectedUserForPermId = row.getAttribute("data-uid");
          renderContent();
        });
      });

      const assignPermForm = containerEl.querySelector("#form-assign-group-permissions-to-user");
      if (assignPermForm) {
        assignPermForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const userId = containerEl.querySelector("#assign-select-user").value;
          const permGroupId = containerEl.querySelector("#assign-select-perm-group").value;

          const updatedUser = await assignPermissionGroupToUser({
            userId,
            permissionGroupId: permGroupId
          });

          if (updatedUser) {
            // Si el usuario actualizado es el que está activo en sesión, actualizar su sesión en caliente
            if (activeUserSession.username.toLowerCase() === updatedUser.username.toLowerCase()) {
              switchActiveUserSecuritySession(updatedUser);
              const headerUserEl = document.getElementById("header-active-ad-user");
              if (headerUserEl) {
                headerUserEl.textContent = `${updatedUser.username} (${updatedUser.assignedPermissionGroupName})`;
              }
            }

            dispatchEnterpriseToast({
              title: "Permisos de Grupo Asignados al Usuario",
              message: `Al usuario ${updatedUser.username} se le indicó usar los permisos de '${updatedUser.assignedPermissionGroupName}' (${updatedUser.assignedDepartmentName}).`,
              variant: "success"
            });
            renderContent();
          }
        });
      }

      containerEl.querySelector("#btn-activate-selected-user-session")?.addEventListener("click", () => {
        const targetUser = allAdUsers.find((u) => u.id === selectedUserForPermId);
        if (targetUser) {
          switchActiveUserSecuritySession(targetUser);
          const headerUserEl = document.getElementById("header-active-ad-user");
          if (headerUserEl) {
            headerUserEl.textContent = `${targetUser.username} (${targetUser.assignedPermissionGroupName || targetUser.erpRole})`;
          }
          dispatchEnterpriseToast({
            title: `Sesión Cambiada a ${targetUser.username}`,
            message: `Usando permisos de: ${targetUser.assignedPermissionGroupName || targetUser.erpRole}.`,
            variant: "info"
          });
          renderContent();
        }
      });

      // Crear Departamento
      const createDeptForm = containerEl.querySelector("#form-create-department");
      if (createDeptForm) {
        createDeptForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const code = containerEl.querySelector("#dept-code-input").value.trim();
          const name = containerEl.querySelector("#dept-name-input").value.trim();
          const manager = containerEl.querySelector("#dept-manager-input").value.trim();
          const description = containerEl.querySelector("#dept-desc-input").value.trim();

          const newDept = await createOrUpdateDepartment({ code, name, manager, description });
          dispatchEnterpriseToast({
            title: "Departamento Creado",
            message: `${newDept.name} (${newDept.code}) listo para alojar grupos de permisos.`,
            variant: "success"
          });
          renderContent();
        });
      }

      containerEl.querySelectorAll(".btn-edit-perm-group").forEach((btn) => {
        btn.addEventListener("click", () => {
          selectedPermGroupId = btn.getAttribute("data-grp-id");
          activeRibbonItem = "MATRIZ_PERMISOS";
          renderContent();
        });
      });

      // Matriz de Grupos de Permisos Modulares
      const selectExistingGrp = containerEl.querySelector("#perm-grp-select-existing");
      if (selectExistingGrp) {
        selectExistingGrp.addEventListener("change", (e) => {
          const val = e.target.value;
          if (val === "__NEW__") {
            const nameInput = containerEl.querySelector("#perm-grp-name-input");
            const descInput = containerEl.querySelector("#perm-grp-desc-input");
            if (nameInput) {
              nameInput.value = "";
              nameInput.focus();
            }
            if (descInput) {
              descInput.value = "Grupo de permisos personalizado por departamento";
            }
          } else {
            selectedPermGroupId = val;
            renderContent();
          }
        });
      }

      containerEl.querySelectorAll(".perm-mod-enabled-chk").forEach((chk) => {
        chk.addEventListener("change", (e) => {
          const modId = e.target.getAttribute("data-mod-id");
          const isChecked = e.target.checked;
          containerEl.querySelectorAll(`.perm-mod-action-chk[data-mod-id="${modId}"]`).forEach((actChk) => {
            actChk.checked = isChecked;
          });
        });
      });

      containerEl.querySelector("#btn-perm-check-all")?.addEventListener("click", () => {
        containerEl.querySelectorAll(".perm-mod-enabled-chk, .perm-mod-action-chk").forEach((c) => {
          c.checked = true;
        });
      });

      containerEl.querySelector("#btn-perm-uncheck-all")?.addEventListener("click", () => {
        containerEl.querySelectorAll(".perm-mod-enabled-chk, .perm-mod-action-chk").forEach((c) => {
          c.checked = false;
        });
      });

      const savePermGroupForm = containerEl.querySelector("#form-save-permission-group");
      if (savePermGroupForm) {
        savePermGroupForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const selectVal = containerEl.querySelector("#perm-grp-select-existing").value;
          const isNew = selectVal === "__NEW__";
          const name = containerEl.querySelector("#perm-grp-name-input").value.trim();
          const departmentId = containerEl.querySelector("#perm-grp-dept-select").value;
          const description = containerEl.querySelector("#perm-grp-desc-input").value.trim();

          const modulesAccess = {};
          PLATFORM_MODULAR_PERMISSIONS_CATALOG.forEach((mod) => {
            const enabledChk = containerEl.querySelector(`.perm-mod-enabled-chk[data-mod-id="${mod.moduleId}"]`);
            const modEntry = {
              enabled: Boolean(enabledChk?.checked)
            };
            GRANULAR_FUNCTION_ACTIONS.forEach((act) => {
              const actChk = containerEl.querySelector(
                `.perm-mod-action-chk[data-mod-id="${mod.moduleId}"][data-act-key="${act.key}"]`
              );
              modEntry[act.key] = Boolean(actChk?.checked);
            });
            modulesAccess[mod.moduleId] = modEntry;
          });

          const savedGrp = await createOrUpdatePermissionGroup({
            id: isNew ? null : selectedPermGroupId,
            name,
            departmentId,
            description,
            modulesAccess
          });

          selectedPermGroupId = savedGrp.id;
          dispatchEnterpriseToast({
            title: "Grupo de Permisos Modulares Guardado",
            message: `'${savedGrp.name}' guardado en ${savedGrp.departmentName} (${countEnabledModulesInGroup(savedGrp)}/13 módulos).`,
            variant: "success"
          });
          renderContent();
        });
      }

      // ====================================================================
      // EVENTOS 6: TEMAS (OSCURO, CLARO, AZUL) Y CREADOR DE PERFIL DE COLORES
      // ====================================================================
      containerEl.querySelectorAll(".theme-selector-card").forEach((card) => {
        card.addEventListener("click", () => {
          const themeId = card.getAttribute("data-theme-id");
          const paletteKey = card.getAttribute("data-theme-palette");
          const themeName = card.getAttribute("data-theme-name");
          const matchedTheme = savedThemes.find((t) => t.id === themeId || t.name === themeName);

          applyThemePaletteToDocument(
            paletteKey,
            themeName,
            matchedTheme?.customColors || null
          );

          dispatchEnterpriseToast({
            title: `Tema Aplicado: ${themeName}`,
            message: "Los colores de toda la plataforma se actualizaron instantáneamente.",
            variant: "info"
          });
          renderContent();
        });
      });

      const themeForm = containerEl.querySelector("#form-create-named-theme");
      const themeNameInput = containerEl.querySelector("#custom-theme-name-input");
      if (themeNameInput) {
        themeNameInput.addEventListener("input", (e) => {
          const typedName = e.target.value.trim();
          if (typedName.length >= 2) {
            const previewPalette = derivePaletteFromThemeName(typedName);
            applyThemePaletteToDocument(previewPalette, typedName);
          }
        });
      }
      if (themeForm) {
        themeForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const customName = themeNameInput.value.trim();
          if (!customName) {
            return;
          }
          const createdTheme = await createAndApplyNamedTheme(customName);
          dispatchEnterpriseToast({
            title: `Tema "${createdTheme.name}" Aplicado`,
            message: createdTheme.description,
            variant: "success"
          });
          renderContent();
        });
      }

      // Eventos del Creador de Perfil de Colores Personalizado
      containerEl.querySelectorAll("[data-preset-seed]").forEach((seedBtn) => {
        seedBtn.addEventListener("click", () => {
          const seedKey = seedBtn.getAttribute("data-preset-seed");
          applyThemePaletteToDocument(seedKey, seedKey.replace("palette-", "").toUpperCase());
          const updatedMeta = getActiveThemeMetadata();
          draftColorProfile = {
            ...draftColorProfile,
            ...updatedMeta.activeColors
          };
          renderContent();
        });
      });

      containerEl.querySelectorAll(".live-color-picker-input").forEach((picker) => {
        picker.addEventListener("input", (e) => {
          const colorKey = e.target.getAttribute("data-color-key");
          const hexValue = e.target.value;
          draftColorProfile[colorKey] = hexValue;
          const labelEl = containerEl.querySelector(`#hex-label-${colorKey}`);
          if (labelEl) {
            labelEl.textContent = hexValue;
          }
          const nameInput = containerEl.querySelector("#color-profile-name-input");
          if (nameInput && nameInput.value.trim()) {
            draftColorProfile.name = nameInput.value.trim();
          }
          previewCustomColorsLive(draftColorProfile, draftColorProfile.name);
        });
      });

      containerEl.querySelector("#btn-go-back-themes")?.addEventListener("click", () => {
        activeRibbonItem = "TEMAS_SISTEMA";
        renderContent();
      });

      const saveColorProfileForm = containerEl.querySelector("#form-save-color-profile");
      if (saveColorProfileForm) {
        saveColorProfileForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const profileName = containerEl.querySelector("#color-profile-name-input").value.trim();
          draftColorProfile.name = profileName;

          const savedProfile = await createAndApplyCustomColorProfile({
            name: profileName,
            colors: draftColorProfile
          });

          dispatchEnterpriseToast({
            title: `Perfil de Colores "${savedProfile.name}" Guardado y Activo`,
            message: "Los colores personalizados han sido aplicados a toda la plataforma.",
            variant: "success"
          });
          renderContent();
        });
      }

      // ====================================================================
      // EVENTOS 7: SAP LOGON 800 Y CREACIÓN DE EMPRESAS (RNC ###-#####-#)
      // ====================================================================
      const sapFilterInput = containerEl.querySelector("#sap-filter-elements-input");
      if (sapFilterInput) {
        sapFilterInput.addEventListener("input", (e) => {
          localFilter = e.target.value;
          renderContent();
        });
      }

      containerEl.querySelectorAll(".sap-tree-node").forEach((node) => {
        node.addEventListener("click", () => {
          activeWorkspaceArea = node.getAttribute("data-area") || "Local";
          renderContent();
        });
      });

      containerEl.querySelectorAll(".sap-connection-row").forEach((row) => {
        row.addEventListener("click", () => {
          const compId = row.getAttribute("data-comp-id");
          selectedCompany = allCompanies.find((c) => c.id === compId) || selectedCompany;
          renderContent();
        });
        row.addEventListener("dblclick", () => {
          const compId = row.getAttribute("data-comp-id");
          const found = allCompanies.find((c) => c.id === compId);
          if (found) {
            selectedCompany = found;
            activateCompanySession(found);
          }
        });
      });

      containerEl.querySelector("#btn-sap-access-system")?.addEventListener("click", () => {
        activateCompanySession(selectedCompany);
      });

      containerEl.querySelector("#btn-sap-new-company")?.addEventListener("click", () => {
        editingCompanyId = null;
        draftCompanyLogoUrl = DEFAULT_COMPANY_LOGO_PATH;
        activeRibbonItem = "CREAR_EMPRESA";
        renderContent();
      });

      containerEl.querySelector("#btn-sap-edit-company")?.addEventListener("click", () => {
        if (selectedCompany) {
          editingCompanyId = selectedCompany.id;
          draftCompanyLogoUrl = selectedCompany.logoUrl || DEFAULT_COMPANY_LOGO_PATH;
          activeRibbonItem = "CREAR_EMPRESA";
          renderContent();
        }
      });

      const selectExistingCompToEdit = containerEl.querySelector("#comp-select-existing-to-edit");
      if (selectExistingCompToEdit) {
        selectExistingCompToEdit.addEventListener("change", (e) => {
          const val = e.target.value;
          if (val === "__NEW__") {
            editingCompanyId = null;
            draftCompanyLogoUrl = DEFAULT_COMPANY_LOGO_PATH;
          } else {
            editingCompanyId = val;
            const foundComp = allCompanies.find((c) => c.id === val);
            if (foundComp) {
              selectedCompany = foundComp;
              draftCompanyLogoUrl = foundComp.logoUrl || DEFAULT_COMPANY_LOGO_PATH;
            }
          }
          renderContent();
        });
      }

      containerEl.querySelectorAll(".btn-quick-edit-company-logo").forEach((btn) => {
        btn.addEventListener("click", () => {
          const compId = btn.getAttribute("data-edit-comp-id");
          const foundComp = allCompanies.find((c) => c.id === compId);
          if (foundComp) {
            editingCompanyId = foundComp.id;
            selectedCompany = foundComp;
            draftCompanyLogoUrl = foundComp.logoUrl || DEFAULT_COMPANY_LOGO_PATH;
            renderContent();
          }
        });
      });

      const logoFileInput = containerEl.querySelector("#comp-input-logo-file");
      if (logoFileInput) {
        logoFileInput.addEventListener("change", (e) => {
          const file = e.target.files?.[0];
          if (!file) {
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const rawDataUrl = String(reader.result || "");
            const img = new Image();
            img.onload = () => {
              const maxDim = 220;
              let w = img.width || maxDim;
              let h = img.height || maxDim;
              if (w > maxDim || h > maxDim) {
                const ratio = Math.min(maxDim / w, maxDim / h);
                w = Math.max(1, Math.round(w * ratio));
                h = Math.max(1, Math.round(h * ratio));
              }
              const canvas = document.createElement("canvas");
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(img, 0, 0, w, h);
                draftCompanyLogoUrl = canvas.toDataURL("image/png");
              } else {
                draftCompanyLogoUrl = rawDataUrl;
              }
              const previewImg = containerEl.querySelector("#comp-logo-preview-img");
              if (previewImg) {
                previewImg.src = draftCompanyLogoUrl;
              }
              dispatchEnterpriseToast({
                title: "Logo de Empresa Cargado",
                message: "Vista previa actualizada. Pulse 'Guardar' para asociar el logo a la empresa.",
                variant: "info"
              });
            };
            img.onerror = () => {
              draftCompanyLogoUrl = rawDataUrl;
              const previewImg = containerEl.querySelector("#comp-logo-preview-img");
              if (previewImg) {
                previewImg.src = draftCompanyLogoUrl;
              }
            };
            img.src = rawDataUrl;
          };
          reader.readAsDataURL(file);
        });
      }

      const logoUrlInput = containerEl.querySelector("#comp-input-logo-url");
      if (logoUrlInput) {
        logoUrlInput.addEventListener("input", (e) => {
          const typedUrl = e.target.value.trim();
          if (typedUrl) {
            draftCompanyLogoUrl = typedUrl;
            const previewImg = containerEl.querySelector("#comp-logo-preview-img");
            if (previewImg) {
              previewImg.src = typedUrl;
            }
          }
        });
      }

      containerEl.querySelector("#btn-reset-company-logo")?.addEventListener("click", () => {
        draftCompanyLogoUrl = DEFAULT_COMPANY_LOGO_PATH;
        const previewImg = containerEl.querySelector("#comp-logo-preview-img");
        if (previewImg) {
          previewImg.src = DEFAULT_COMPANY_LOGO_PATH;
        }
        if (logoUrlInput) {
          logoUrlInput.value = DEFAULT_COMPANY_LOGO_PATH;
        }
      });

      const rncInput = containerEl.querySelector("#comp-input-rnc");
      const cedulaRncInput = containerEl.querySelector("#comp-input-cedula-rnc");
      if (rncInput) {
        rncInput.addEventListener("input", (e) => {
          const masked = applyRncMaskFormat(e.target.value);
          e.target.value = masked;
          if (cedulaRncInput && (!cedulaRncInput.value || cedulaRncInput.value.length <= 11)) {
            cedulaRncInput.value = masked;
          }
        });
      }

      const companyForm = containerEl.querySelector("#form-create-edit-company");
      if (companyForm) {
        companyForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const rncVal = applyRncMaskFormat(containerEl.querySelector("#comp-input-rnc").value);
          if (!validateRncMaskFormat(rncVal)) {
            dispatchEnterpriseToast({
              title: "Formato de RNC Inválido",
              message: "El RNC debe ser numérico de 9 dígitos con la máscara exacta ###-#####-# (ej. 101-88921-2).",
              variant: "danger"
            });
            return;
          }

          const nombreComercial = containerEl.querySelector("#comp-input-nombre-comercial").value.trim().toUpperCase();
          const razonSocial = containerEl.querySelector("#comp-input-razon-social").value.trim().toUpperCase();
          const resolvedLogoUrl = draftCompanyLogoUrl || companyToEdit?.logoUrl || DEFAULT_COMPANY_LOGO_PATH;

          const companyRecord = {
            id: editingCompanyId || `COMP-${Date.now()}`,
            rnc: rncVal,
            cedulaRnc: containerEl.querySelector("#comp-input-cedula-rnc").value.trim() || rncVal,
            razonSocial,
            nombreComercial,
            logoUrl: resolvedLogoUrl,
            categoria: containerEl.querySelector("#comp-input-categoria").value,
            regimenPagos: containerEl.querySelector("#comp-input-regimen").value,
            estado: containerEl.querySelector("#comp-input-estado").value,
            actividadEconomica: containerEl.querySelector("#comp-input-actividad").value.trim().toUpperCase(),
            administracionLocal: containerEl.querySelector("#comp-input-adm-local").value.trim().toUpperCase(),
            facturadorElectronico: containerEl.querySelector("#comp-input-facturador").value,
            licenciasVhm: containerEl.querySelector("#comp-input-vhm").value.trim().toUpperCase(),
            areaTrabajo: "Local",
            idSistema: nombreComercial.replace(/[^A-Z]/g, "").slice(0, 3).padEnd(3, "X"),
            grupoServidor: containerEl.querySelector("#comp-input-servidor").value.trim() || "172.16.4.15",
            numeroSistema: "00",
            servidorMensaje: "erp.easydata.local"
          };

          await insertOrUpdateCollectionRecord("companies", companyRecord);
          selectedCompany = companyRecord;
          editingCompanyId = null;
          draftCompanyLogoUrl = "";
          activeRibbonItem = "SAP800";
          activateCompanySession(companyRecord);
        });
      }

      // ====================================================================
      // EVENTOS DE OPCIONES DEL SISTEMA (PREFERENCIAS, CONTRASEÑAS LOCALES Y SERVICIO)
      // ====================================================================
      containerEl.querySelector("#chk-opt-sidebar-autohide")?.addEventListener("change", (e) => {
        const val = Boolean(e.target.checked);
        localStorage.setItem("EDA_SIDEBAR_AUTOHIDE_V1", val ? "true" : "false");
        dispatchEnterpriseToast({
          title: val ? "Auto-ocultar menú principal activado" : "Auto-ocultar menú principal desactivado",
          message: val ? "El menú lateral se contraerá automáticamente a la izquierda al navegar." : "El menú lateral permanecerá expandido.",
          variant: "info"
        });
      });

      containerEl.querySelector("#chk-opt-cinta-autohide")?.addEventListener("change", (e) => {
        isCintaAutoHide = Boolean(e.target.checked);
        localStorage.setItem("EDA_CINTA_RAIL_AUTOHIDE_V1", isCintaAutoHide ? "true" : "false");
        dispatchEnterpriseToast({
          title: isCintaAutoHide ? "Auto-ocultar cinta activado" : "Auto-ocultar cinta desactivado",
          message: isCintaAutoHide ? "La cinta vertical se contraerá a solo iconos tras elegir una opción." : "La cinta vertical permanecerá expandida.",
          variant: "info"
        });
      });

      containerEl.querySelector("#btn-opt-test-service")?.addEventListener("click", async () => {
        const status = await checkGatewayServiceStatus();
        if (status.isOnline) {
          dispatchEnterpriseToast({
            title: "Servicio Windows Gateway Online ✓",
            message: `El servicio de autenticación autónomo responde en http://127.0.0.1:3890 (PID: ${status.pid || "Daemon"}).`,
            variant: "success"
          });
        } else {
          dispatchEnterpriseToast({
            title: "Servicio Windows Gateway Fuera de Línea",
            message: "No se pudo conectar a http://127.0.0.1:3890. El sistema utilizará autenticación con contraseñas locales de respaldo.",
            variant: "warning"
          });
        }
      });

      containerEl.querySelectorAll(".btn-edit-user-local-pass").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const userId = btn.getAttribute("data-user-id");
          const username = btn.getAttribute("data-username");
          const currentEmail = btn.getAttribute("data-email");
          const newEmail = window.prompt(`Correo corporativo para el usuario ${username}:`, currentEmail || `${username.split("\\").pop()}@empresa.com`);
          if (newEmail === null) return;
          const newPass = window.prompt(`Nueva contraseña local de respaldo web para ${username} (mínimo 6 caracteres):`, "laantillana2026*");
          if (newPass === null) return;
          if (newPass.length < 6) {
            dispatchEnterpriseToast({
              title: "Contraseña muy corta",
              message: "La contraseña local debe tener al menos 6 caracteres.",
              variant: "warning"
            });
            return;
          }
          const updated = await updateUserLocalCredentials({
            userId,
            email: newEmail.trim(),
            localPassword: newPass
          });
          if (updated) {
            dispatchEnterpriseToast({
              title: "Credenciales de Respaldo Actualizadas",
              message: `El usuario ${username} ahora puede acceder offline y vía web con su contraseña local asignada.`,
              variant: "success"
            });
            renderContent();
          }
        });
      });
    };

    renderContent();
  }
};
