/**
 * Registro Maestro de Módulos Independientes.
 * Acopla cada módulo autónomo a la estructura del sistema verificando siempre
 * su autorización en el Módulo Central de Seguridad.
 */

import {
  registerModuleInSecurityKernel,
  verifyAndAuthorizeModuleAccess
} from "../security/security-kernel-gatekeeper.js";
import { loadHtmlTemplateView } from "./html-template-loader.js";
import { dispatchEnterpriseToast } from "./ui-notification-dispatcher.js";

const coupledModulesCatalog = new Map();
let activeRenderedModuleId = null;

export function registerIndependentModule(moduleContract) {
  if (!moduleContract || !moduleContract.id || typeof moduleContract.renderModuleWorkspace !== "function") {
    throw new Error("Contrato de módulo inválido: Debe ser autónomo y exponer renderModuleWorkspace.");
  }

  // Obligatorio: Integrar el módulo desde el Núcleo de Seguridad
  registerModuleInSecurityKernel(moduleContract);
  coupledModulesCatalog.set(moduleContract.id, moduleContract);
}

export async function mountAndRenderIndependentModule(moduleId, initialSearchQuery = "") {
  const securityCheck = verifyAndAuthorizeModuleAccess(moduleId);
  const workspaceContainer = document.getElementById("erp-dynamic-module-viewport");

  if (!securityCheck.allowed) {
    dispatchEnterpriseToast({
      title: "Acceso Bloqueado por Módulo de Seguridad",
      message: securityCheck.reason,
      variant: "danger"
    });
    if (workspaceContainer) {
      workspaceContainer.innerHTML = `
        <section class="enterprise-panel">
          <div class="enterprise-panel-header">
            <h2 class="enterprise-panel-title">Acceso Restringido por el Módulo de Seguridad</h2>
            <span class="badge-pill badge-danger">ZERO-TRUST GUARD</span>
          </div>
          <div class="enterprise-panel-body">
            <p class="module-description">${securityCheck.reason}</p>
          </div>
        </section>
      `;
    }
    return false;
  }

  const moduleContract = coupledModulesCatalog.get(moduleId);
  if (!moduleContract || !workspaceContainer) {
    return false;
  }

  activeRenderedModuleId = moduleId;

  const templateHtml = await loadHtmlTemplateView(moduleContract.templatePath, moduleId);
  workspaceContainer.innerHTML = templateHtml;

  const slotElement = document.getElementById(`${moduleId}-module-dynamic-slot`) || workspaceContainer;
  await moduleContract.renderModuleWorkspace(slotElement, { searchQuery: initialSearchQuery });

  // Actualizar botón activo en la barra lateral
  document.querySelectorAll(".sidebar-module-btn").forEach((btn) => {
    const isMatch = btn.getAttribute("data-module-id") === moduleId;
    btn.classList.toggle("is-active", isMatch);
  });

  const statusModuleEl = document.getElementById("statusbar-active-module");
  if (statusModuleEl) {
    statusModuleEl.textContent = `${moduleContract.name} (${moduleContract.tCode})`;
  }

  return true;
}

export function getActiveRenderedModuleId() {
  return activeRenderedModuleId;
}

export function getCoupledModuleById(moduleId) {
  return coupledModulesCatalog.get(moduleId) || null;
}
