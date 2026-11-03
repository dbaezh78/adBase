/**
 * NÚCLEO DE SEGURIDAD Y GOBIERNO (Security Gatekeeper Kernel).
 * Regla de oro arquitectónica: Cualquier módulo, submódulo o función que se agregue
 * al sistema TIENE que ser registrado, autorizado y acoplado desde este núcleo de seguridad.
 */

import { evaluatePermissionForCurrentUser, getActiveUserSecuritySession } from "./role-permission-evaluator.js";
import { recordSecurityAuditEvent } from "./audit-trail-logger.js";

const registeredSecuredModules = new Map();
const registeredSecuredFunctions = new Map();

export function registerModuleInSecurityKernel(moduleDescriptor) {
  if (!moduleDescriptor || !moduleDescriptor.id) {
    throw new Error("Seguridad rechaza el módulo: Falta identificador único de módulo.");
  }

  const securityRegistration = {
    id: moduleDescriptor.id,
    tCode: moduleDescriptor.tCode || "GEN00",
    name: moduleDescriptor.name,
    category: moduleDescriptor.category || "EXTENSIÓN",
    requiredPermission: moduleDescriptor.requiredPermission || "SEC_GOVERNANCE_VIEW",
    isolationMode: "INDEPENDIENTE_AUTONOMO",
    securityStatus: "AUTORIZADO_POR_SEGURIDAD",
    registeredAt: new Date().toISOString().replace("T", " ").slice(0, 19),
    invocationsCount: 0,
    registeredFunctionsCount: Array.isArray(moduleDescriptor.exportedFunctions)
      ? moduleDescriptor.exportedFunctions.length
      : 4
  };

  registeredSecuredModules.set(moduleDescriptor.id, securityRegistration);

  (moduleDescriptor.exportedFunctions || []).forEach((fnName) => {
    registerFunctionInSecurityKernel({
      moduleId: moduleDescriptor.id,
      functionName: fnName,
      requiredPermission: moduleDescriptor.requiredPermission
    });
  });

  return securityRegistration;
}

export function registerFunctionInSecurityKernel({ moduleId, functionName, requiredPermission }) {
  const key = `${moduleId}::${functionName}`;
  const record = {
    key,
    moduleId,
    functionName,
    requiredPermission: requiredPermission || "SEC_GOVERNANCE_VIEW",
    authorized: true,
    callsCount: 0
  };
  registeredSecuredFunctions.set(key, record);
  return record;
}

export function verifyAndAuthorizeModuleAccess(moduleId) {
  const reg = registeredSecuredModules.get(moduleId);
  if (!reg) {
    recordSecurityAuditEvent({
      moduleId,
      action: "UNREGISTERED_MODULE_BLOCKED",
      detail: `Intento de acceso a módulo '${moduleId}' no integrado en el Núcleo de Seguridad.`,
      severity: "DANGER"
    });
    return { allowed: false, reason: "El módulo no ha sido integrado desde el Módulo de Seguridad." };
  }

  if (reg.securityStatus !== "AUTORIZADO_POR_SEGURIDAD") {
    return { allowed: false, reason: `El módulo ${reg.name} está suspendido por política de seguridad.` };
  }

  const hasPermission = evaluatePermissionForCurrentUser(reg.requiredPermission, moduleId);
  if (!hasPermission) {
    const session = getActiveUserSecuritySession();
    recordSecurityAuditEvent({
      actor: session.username,
      moduleId,
      action: "RBAC_ACCESS_DENIED",
      detail: `Acceso denegado a ${reg.name}. Grupo de Permisos actual (${session.assignedPermissionGroupName || session.erpRole}) no autoriza el módulo ${reg.tCode}.`,
      severity: "WARNING"
    });
    return {
      allowed: false,
      reason: `El usuario ${session.username} usa los permisos de '${session.assignedPermissionGroupName || session.erpRole}', el cual no tiene habilitado el módulo '${reg.name} (${reg.tCode})'.`
    };
  }

  reg.invocationsCount += 1;
  return { allowed: true, registration: reg };
}

export function toggleModuleSecurityAuthorization(moduleId) {
  const reg = registeredSecuredModules.get(moduleId);
  if (!reg || moduleId === "security") {
    return null;
  }
  reg.securityStatus = reg.securityStatus === "AUTORIZADO_POR_SEGURIDAD"
    ? "BLOQUEADO_POR_SEGURIDAD"
    : "AUTORIZADO_POR_SEGURIDAD";

  recordSecurityAuditEvent({
    moduleId: "security",
    action: "MODULE_POLICY_CHANGED",
    detail: `Estado de seguridad del módulo '${reg.name}' cambiado a ${reg.securityStatus}.`,
    severity: reg.securityStatus === "AUTORIZADO_POR_SEGURIDAD" ? "SUCCESS" : "WARNING"
  });

  return { ...reg };
}

export function getAllSecuredRegisteredModules() {
  return Array.from(registeredSecuredModules.values());
}

export function getAllSecuredRegisteredFunctions() {
  return Array.from(registeredSecuredFunctions.values());
}
