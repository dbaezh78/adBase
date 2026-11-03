/**
 * Orquestador Maestro de Arranque del Sistema Contabilidad dBase (Accounting dBase).
 * Optimizado para carga instantánea (< 20ms), acoplando los 13 módulos independientes
 * a través del Módulo de Seguridad, barra lateral estilo Microsoft 365 Admin Center (Imagen 1 y 2),
 * inicializando Temas, Empresas (SAP Logon) y Conector Windows Server segmentado por empresa.
 */

import { MODULE_DEFINITIONS } from "../config/system-enterprise-constants.js";
import {
  initializeDatabaseProvider,
  getActiveCompanyRecord
} from "../database/database-provider-adapter.js";
import {
  registerIndependentModule,
  mountAndRenderIndependentModule
} from "./independent-module-registry.js";
import { initializeSavedThemeOnBoot } from "./theme-customization-engine.js";
import {
  M365_HAMBURGER_TOGGLE_SVG,
  M365_CHEVRON_DOWN_SVG,
  getMicrosoft365NavIconSvg
} from "./microsoft365-navigation-icons.js";
import { syncCompanyAuthTelemetryToShell } from "../security/connection-auth-providers-service.js";
import {
  renderPopulatedSearchHub,
  jumpToSelectedSearchModule
} from "../search/search-content-populator.js";
import { executeUniversalSearch } from "../search/universal-search-engine.js";
import { dispatchEnterpriseToast } from "./ui-notification-dispatcher.js";
import { LoginGateManager } from "./application-login-gate-manager.js";
import { switchActiveUserSecuritySession } from "../security/role-permission-evaluator.js";

// Importación de los 13 Módulos Independientes
import { SettingsAndCompaniesModule } from "../modules/settings/settings-and-companies-module.js";
import { SecurityGovernanceModule } from "../modules/security/security-governance-module.js";
import { UsersWindowsAdModule } from "../modules/users-windows/users-windows-ad-module.js";
import { ChartOfAccountsModule } from "../modules/chart-of-accounts/chart-of-accounts-module.js";
import { JournalEntriesModule } from "../modules/journal-entries/journal-entries-module.js";
import { OfficialBooksModule } from "../modules/official-books/official-books-module.js";
import { BankReconciliationModule } from "../modules/bank-reconciliation/bank-reconciliation-module.js";
import { PeriodClosingModule } from "../modules/period-closing/period-closing-module.js";
import { FinancialStatementsModule } from "../modules/financial-statements/financial-statements-module.js";
import { PointOfSaleModule } from "../modules/point-of-sale/point-of-sale-module.js";
import { PayrollManagementModule } from "../modules/payroll/payroll-management-module.js";
import {
  ModuleIntegrationHubModule,
  initializeModuleIntegrationEventListeners
} from "../modules/module-integration/module-integration-hub-module.js";
import { EnterpriseReportsModule } from "../modules/reports/enterprise-reports-module.js";

const ALL_INDEPENDENT_MODULES = [
  SettingsAndCompaniesModule,
  SecurityGovernanceModule,
  UsersWindowsAdModule,
  ChartOfAccountsModule,
  JournalEntriesModule,
  OfficialBooksModule,
  BankReconciliationModule,
  PeriodClosingModule,
  FinancialStatementsModule,
  PointOfSaleModule,
  PayrollManagementModule,
  ModuleIntegrationHubModule,
  EnterpriseReportsModule
];

const SIDEBAR_AUTOHIDE_STORAGE_KEY = "EDA_M365_SIDEBAR_AUTOHIDE_V1";

function renderSidebarNavigationMenu() {
  const sidebarEl = document.getElementById("erp-sidebar-navigation");
  if (!sidebarEl) {
    return;
  }

  let autoHideEnabled = localStorage.getItem(SIDEBAR_AUTOHIDE_STORAGE_KEY) !== "false";

  const groupedCategories = new Map();
  MODULE_DEFINITIONS.forEach((mod) => {
    if (!groupedCategories.has(mod.category)) {
      groupedCategories.set(mod.category, []);
    }
    groupedCategories.get(mod.category).push(mod);
  });

  const collapsedSidebarCategories = new Set(["SISTEMA DBASE"]);

  let html = `
    <div class="m365-rail-header">
      <button
        type="button"
        id="btn-m365-sidebar-toggle"
        class="m365-hamburger-btn"
        title="Contraer o expandir menú lateral a la izquierda (Estilo Microsoft 365 - Mostrar solo iconos)"
      >
        ${M365_HAMBURGER_TOGGLE_SVG}
      </button>
    </div>
  `;

  groupedCategories.forEach((modules, categoryTitle) => {
    const isCollapsed = collapsedSidebarCategories.has(categoryTitle);
    html += `
      <div class="sidebar-section-group ${isCollapsed ? "is-collapsed" : ""}" data-sidebar-category="${categoryTitle}">
        <button type="button" class="sidebar-section-title" data-toggle-sidebar-cat="${categoryTitle}" title="Click para contraer o expandir ${categoryTitle}">
          <span>${categoryTitle}</span>
          <span class="sidebar-section-chevron">${M365_CHEVRON_DOWN_SVG}</span>
        </button>
        <div class="sidebar-section-items">
          ${modules.map((mod) => `
            <button type="button" class="sidebar-module-btn" data-module-id="${mod.id}" title="${mod.name} (${mod.tCode}) — ${mod.description}">
              <span class="sidebar-module-label-group">
                <span class="m365-nav-icon-box">${getMicrosoft365NavIconSvg(mod.id)}</span>
                <span class="sidebar-module-text">${mod.name}</span>
              </span>
              <span class="sidebar-tcode-badge">${mod.tCode}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `;
  });

  // Sección contraíble "Sistema dBase" con los módulos "Sobre / About" y "Opciones del sistema"
  html += `
    <div class="sidebar-section-group is-collapsed" data-sidebar-category="SISTEMA DBASE">
      <button type="button" class="sidebar-section-title" data-toggle-sidebar-cat="SISTEMA DBASE" title="Click para expandir Sistema dBase">
        <span>Sistema dBase</span>
        <span class="sidebar-section-chevron">${M365_CHEVRON_DOWN_SVG}</span>
      </button>
      <div class="sidebar-section-items">
        <button type="button" id="btn-sidebar-open-sobre-about" class="sidebar-module-btn" title="Sobre / About — Accounting dBase (Base de datos para Contabilidad)">
          <span class="sidebar-module-label-group">
            <span class="m365-nav-icon-box">${getMicrosoft365NavIconSvg("sobre-about")}</span>
            <span class="sidebar-module-text">Sobre / About</span>
          </span>
          <span class="sidebar-tcode-badge">VER</span>
        </button>
        <button type="button" id="btn-sidebar-open-opciones-sistema" class="sidebar-module-btn" title="Opciones del sistema — Preferencias de auto-ocultar, credenciales de respaldo y servicio">
          <span class="sidebar-module-label-group">
            <span class="m365-nav-icon-box">${getMicrosoft365NavIconSvg("opciones-sistema")}</span>
            <span class="sidebar-module-text">Opciones del sistema</span>
          </span>
          <span class="sidebar-tcode-badge">OPT</span>
        </button>
      </div>
    </div>
  `;

  sidebarEl.innerHTML = html;

  const toggleRailBtn = sidebarEl.querySelector("#btn-m365-sidebar-toggle");
  if (toggleRailBtn) {
    toggleRailBtn.addEventListener("click", () => {
      sidebarEl.classList.toggle("is-rail-collapsed");
    });
  }

  // Ocultar a la izquierda mostrando solo iconos cuando se está en otra ventana o se interactúa en el área principal
  window.addEventListener("blur", () => {
    if (autoHideEnabled) {
      sidebarEl.classList.add("is-rail-collapsed");
    }
  });

  const mainViewportEl = document.getElementById("erp-dynamic-module-viewport");
  if (mainViewportEl) {
    mainViewportEl.addEventListener("mousedown", () => {
      if (autoHideEnabled && !sidebarEl.classList.contains("is-rail-collapsed")) {
        sidebarEl.classList.add("is-rail-collapsed");
      }
    });
  }

  sidebarEl.querySelectorAll("[data-toggle-sidebar-cat]").forEach((headerBtn) => {
    headerBtn.addEventListener("click", () => {
      const groupEl = headerBtn.closest(".sidebar-section-group");
      const catName = headerBtn.getAttribute("data-toggle-sidebar-cat");
      if (groupEl) {
        groupEl.classList.toggle("is-collapsed");
        if (groupEl.classList.contains("is-collapsed")) {
          collapsedSidebarCategories.add(catName);
        } else {
          collapsedSidebarCategories.delete(catName);
        }
      }
    });
  });

  sidebarEl.querySelectorAll(".sidebar-module-btn[data-module-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetModuleId = btn.getAttribute("data-module-id");
      await mountAndRenderIndependentModule(targetModuleId);
      if (autoHideEnabled) {
        sidebarEl.classList.add("is-rail-collapsed");
      }
    });
  });

  const sobreAboutSidebarBtn = sidebarEl.querySelector("#btn-sidebar-open-sobre-about");
  if (sobreAboutSidebarBtn) {
    sobreAboutSidebarBtn.addEventListener("click", async () => {
      window.__EDA_TARGET_SETTINGS_SUBVIEW = "SOBRE_ABOUT";
      await mountAndRenderIndependentModule("settings");
      if (autoHideEnabled) {
        sidebarEl.classList.add("is-rail-collapsed");
      }
    });
  }

  const opcionesSidebarBtn = sidebarEl.querySelector("#btn-sidebar-open-opciones-sistema");
  if (opcionesSidebarBtn) {
    opcionesSidebarBtn.addEventListener("click", async () => {
      window.__EDA_TARGET_SETTINGS_SUBVIEW = "OPCIONES_SISTEMA";
      await mountAndRenderIndependentModule("settings");
      if (autoHideEnabled) {
        sidebarEl.classList.add("is-rail-collapsed");
      }
    });
  }
}

function bindGlobalOmniboxSearchEvents() {
  const omniboxInput = document.getElementById("global-omnibox-search-input");
  const scopeSelect = document.getElementById("global-omnibox-scope-select");
  const clearBtn = document.getElementById("btn-clear-omnibox-search");
  const closeHubBtn = document.getElementById("btn-close-search-intelligence");
  const jumpBtn = document.getElementById("btn-jump-to-source-module");
  const panelEl = document.getElementById("global-search-intelligence-panel");

  if (!omniboxInput) {
    return;
  }

  const triggerLiveSearch = () => {
    const query = omniboxInput.value;
    const scope = scopeSelect ? scopeSelect.value : "ALL";
    renderPopulatedSearchHub(query, scope);
  };

  omniboxInput.addEventListener("input", triggerLiveSearch);
  if (scopeSelect) {
    scopeSelect.addEventListener("change", triggerLiveSearch);
  }

  omniboxInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const query = omniboxInput.value.trim();
      const check = executeUniversalSearch(query, "ALL");
      if (check.matchedTCodeModule) {
        panelEl?.classList.add("is-hidden");
        await mountAndRenderIndependentModule(check.matchedTCodeModule.id);
        dispatchEnterpriseToast({
          title: `Comando Rápido ${check.matchedTCodeModule.tCode}`,
          message: `Módulo ${check.matchedTCodeModule.name} cargado directamente.`,
          variant: "info"
        });
      }
    } else if (e.key === "Escape") {
      panelEl?.classList.add("is-hidden");
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      omniboxInput.value = "";
      panelEl?.classList.add("is-hidden");
      omniboxInput.focus();
    });
  }

  if (closeHubBtn) {
    closeHubBtn.addEventListener("click", () => {
      panelEl?.classList.add("is-hidden");
    });
  }

  if (jumpBtn) {
    jumpBtn.addEventListener("click", async () => {
      panelEl?.classList.add("is-hidden");
      await jumpToSelectedSearchModule();
    });
  }

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      omniboxInput.focus();
      omniboxInput.select();
    }
  });
}

function bindHeaderQuickSettingsButtons() {
  const companyBtn = document.getElementById("btn-header-open-company-selector");
  const themeBtn = document.getElementById("btn-header-open-settings");
  const logoutBtn = document.getElementById("btn-header-logout");

  if (companyBtn) {
    companyBtn.addEventListener("click", async () => {
      window.__EDA_TARGET_SETTINGS_SUBVIEW = "EMPRESAS_SAP800";
      await mountAndRenderIndependentModule("settings");
    });
  }
  if (themeBtn) {
    themeBtn.addEventListener("click", async () => {
      window.__EDA_TARGET_SETTINGS_SUBVIEW = "TEMA_COLORES";
      await mountAndRenderIndependentModule("settings");
    });
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      LoginGateManager.logout(() => {
        window.location.reload();
      });
    });
  }
}

async function bootstrapEasyDataAccountingSystem() {
  const bootStartPerf = performance.now();

  // 1. Aplicar tema visual guardado inmediatamente (0ms)
  initializeSavedThemeOnBoot();

  // 2. Inicializar Base de Datos de forma síncrona/no bloqueante (< 5ms)
  const dbStatus = initializeDatabaseProvider();

  // 3. Registrar y acoplar cada módulo independiente desde el Módulo de Seguridad
  ALL_INDEPENDENT_MODULES.forEach((independentMod) => {
    registerIndependentModule(independentMod);
  });

  // 4. Activar listeners desacoplados del Bus de Integración
  initializeModuleIntegrationEventListeners();

  // 5. Mostrar empresa activa, su logo y su estado de autenticación segmentado en cabecera
  const activeCompany = getActiveCompanyRecord();
  const headerCompanyEl = document.getElementById("header-active-company-label");
  if (headerCompanyEl && activeCompany) {
    headerCompanyEl.textContent = `${activeCompany.nombreComercial} (${activeCompany.rnc})`;
  }
  const headerCompanyLogoEl = document.getElementById("header-active-company-logo");
  if (headerCompanyLogoEl && activeCompany) {
    headerCompanyLogoEl.src = activeCompany.logoUrl || "./src/img/logos/easy-data-accounting-brand-logo.jpg";
  }
  syncCompanyAuthTelemetryToShell();

  // 6. Construir navegación Microsoft 365, atajos de configuración y buscador inteligente
  renderSidebarNavigationMenu();
  bindGlobalOmniboxSearchEvents();
  bindHeaderQuickSettingsButtons();

  // 6.1 Control de Acceso Web y Pantalla de Login Gate
  LoginGateManager.init(async (session) => {
    if (session?.user) {
      switchActiveUserSecuritySession(session.user);
    }
    if (session?.company) {
      const liveCompanyEl = document.getElementById("header-active-company-label");
      if (liveCompanyEl) {
        liveCompanyEl.textContent = `${session.company.nombreComercial} (${session.company.rnc})`;
      }
      const liveLogoEl = document.getElementById("header-active-company-logo");
      if (liveLogoEl) {
        liveLogoEl.src = session.company.logoUrl || "./src/img/logos/easy-data-accounting-brand-logo.jpg";
      }
      syncCompanyAuthTelemetryToShell();
    }
  });

  // 7. Montar el módulo inicial (Catálogo de Cuentas)
  await mountAndRenderIndependentModule("chart-of-accounts");

  const bootElapsedMs = Math.max(1, Math.round(performance.now() - bootStartPerf));
  const bootTimeEl = document.getElementById("statusbar-boot-time");
  if (bootTimeEl) {
    bootTimeEl.textContent = `${bootElapsedMs} ms`;
  }

  dispatchEnterpriseToast({
    title: `Carga Instantánea Completada (${bootElapsedMs} ms)`,
    message: `Empresa: ${activeCompany?.nombreComercial || "Activa"} | ${dbStatus.provider.projectId}`,
    variant: "success"
  });
}

document.addEventListener("DOMContentLoaded", bootstrapEasyDataAccountingSystem);
