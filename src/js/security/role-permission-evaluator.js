/**
 * Evaluador de Roles y Permisos Granulares (RBAC) integrado con Grupos de Windows Active Directory.
 */

const ROLE_PERMISSION_MATRIX = {
  SUPER_ADMIN_SEGURIDAD: ["*"],
  CONTRALOR_FINANCIERO: [
    "SYS_SETTINGS_VIEW",
    "SEC_GOVERNANCE_VIEW",
    "ACC_COA_VIEW",
    "ACC_COA_CREATE",
    "ACC_JOURNAL_VIEW",
    "ACC_JOURNAL_CREATE",
    "ACC_BOOKS_VIEW",
    "ACC_BANK_RECON_VIEW",
    "ACC_BANK_RECON_EXECUTE",
    "ACC_PERIOD_CLOSE_VIEW",
    "ACC_PERIOD_CLOSE_EXECUTE",
    "ACC_FIN_STATEMENTS_VIEW",
    "SYS_INTEGRATION_VIEW",
    "SYS_REPORTS_VIEW"
  ],
  ESPECIALISTA_NOMINA: [
    "SYS_SETTINGS_VIEW",
    "OPS_PAYROLL_VIEW",
    "OPS_PAYROLL_EXECUTE",
    "USR_WINDOWS_AD_VIEW",
    "SYS_REPORTS_VIEW"
  ],
  AUDITOR_SEGURIDAD_AD: [
    "SYS_SETTINGS_VIEW",
    "SEC_GOVERNANCE_VIEW",
    "USR_WINDOWS_AD_VIEW",
    "USR_WINDOWS_AD_SYNC",
    "ACC_BOOKS_VIEW",
    "ACC_FIN_STATEMENTS_VIEW",
    "SYS_REPORTS_VIEW"
  ],
  OPERADOR_POS: [
    "SYS_SETTINGS_VIEW",
    "OPS_POS_TERMINAL_VIEW",
    "OPS_POS_SALE_CREATE",
    "SYS_REPORTS_VIEW"
  ]
};

let currentAuthenticatedSession = {
  username: "laantillana\\dbaezh",
  fullName: "Daniel Báez H.",
  adGroup: "AD_ERP_SUPER_ADMINS",
  erpRole: "SUPER_ADMIN_SEGURIDAD",
  assignedPermissionGroupId: "GRP-ADMIN",
  assignedPermissionGroupName: "Grupo Admin (Acceso Total Plataforma)",
  assignedDepartmentName: "Departamento de Tecnología y Sistemas (TI)",
  modularPermissionsSnapshot: null,
  domainController: "172.16.4.2 (DC01)"
};

export function evaluatePermissionForCurrentUser(requiredPermission, moduleId = "") {
  if (!requiredPermission) {
    return true;
  }

  // Si el usuario tiene asignado un Grupo de Permisos Modular, evaluar el acceso del módulo en ese grupo
  if (moduleId && currentAuthenticatedSession.modularPermissionsSnapshot) {
    if (moduleId === "settings" || moduleId === "security") {
      return true;
    }
    const modRule = currentAuthenticatedSession.modularPermissionsSnapshot[moduleId];
    if (modRule) {
      return Boolean(modRule.enabled && modRule.ver !== false);
    }
  }

  const rolePermissions = ROLE_PERMISSION_MATRIX[currentAuthenticatedSession.erpRole] || [];
  if (rolePermissions.includes("*")) {
    return true;
  }
  return rolePermissions.includes(requiredPermission);
}

export function getActiveUserSecuritySession() {
  return { ...currentAuthenticatedSession };
}

export function switchActiveUserSecuritySession(userRecord) {
  currentAuthenticatedSession = {
    username: userRecord.username,
    fullName: userRecord.fullName,
    adGroup: userRecord.adGroup || userRecord.assignedPermissionGroupName || "AD_USERS",
    erpRole: userRecord.erpRole || "CONTRALOR_FINANCIERO",
    assignedPermissionGroupId: userRecord.assignedPermissionGroupId || "GRP-ADMIN",
    assignedPermissionGroupName: userRecord.assignedPermissionGroupName || "Grupo Admin (Acceso Total Plataforma)",
    assignedDepartmentName: userRecord.assignedDepartmentName || "Departamento de Tecnología y Sistemas (TI)",
    modularPermissionsSnapshot: userRecord.modularPermissionsSnapshot || null,
    domainController: "172.16.4.2 (DC01)"
  };
  return getActiveUserSecuritySession();
}

export function getAllRoleDefinitions() {
  return Object.entries(ROLE_PERMISSION_MATRIX).map(([roleName, permissions]) => ({
    roleName,
    permissionsCount: permissions.includes("*") ? "ACCESO TOTAL (*)" : `${permissions.length} permisos`,
    permissions
  }));
}
