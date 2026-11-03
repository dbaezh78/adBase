/**
 * Servicio Modular de Departamentos, Grupos de Permisos e Identidades (RBAC Modular).
 * - Permite crear Departamentos Corporativos donde se alojan los Grupos de Permisos.
 * - Permite crear Grupos de Permisos 100% modulares (configurando acceso por cada uno de los 13 módulos
 *   y sus funciones independientes: Ver, Buscar/Popular, Crear, Editar, Eliminar/Anular, Contabilizar, Exportar).
 * - Permite indicarle directamente a cualquier usuario (traído desde LDAP, RADIUS, Local u OAuth):
 *   "Los permisos que usarás son los del Grupo Admin / Grupo Administrativo / Grupo del Departamento X".
 */

import {
  getCollectionRecords,
  insertOrUpdateCollectionRecord,
  deleteRecordFromCollection
} from "../database/database-provider-adapter.js";
import { recordSecurityAuditEvent } from "./audit-trail-logger.js";

const DEPARTMENTS_STORAGE_KEY = "EDA_DEPARTMENTS_REGISTRY_V6";
const PERMISSION_GROUPS_STORAGE_KEY = "EDA_PERMISSION_GROUPS_REGISTRY_V6";

export const PLATFORM_MODULAR_PERMISSIONS_CATALOG = [
  {
    moduleId: "settings",
    tCode: "CFG01",
    moduleName: "Configuración, Empresas, Conexiones y Temas",
    category: "GOBIERNO Y SEGURIDAD",
    requiredPermission: "SYS_SETTINGS_VIEW"
  },
  {
    moduleId: "security",
    tCode: "SEC01",
    moduleName: "Seguridad y Gobierno",
    category: "GOBIERNO Y SEGURIDAD",
    requiredPermission: "SEC_GOVERNANCE_VIEW"
  },
  {
    moduleId: "users-windows",
    tCode: "USR01",
    moduleName: "Usuarios y Windows AD / RADIUS",
    category: "GOBIERNO Y SEGURIDAD",
    requiredPermission: "USR_WINDOWS_AD_VIEW"
  },
  {
    moduleId: "chart-of-accounts",
    tCode: "COA01",
    moduleName: "Catálogo de Cuentas NIIF",
    category: "CONTABILIDAD CORE",
    requiredPermission: "ACC_COA_VIEW"
  },
  {
    moduleId: "journal-entries",
    tCode: "FB50",
    moduleName: "Registro de Asientos Contables",
    category: "CONTABILIDAD CORE",
    requiredPermission: "ACC_JOURNAL_VIEW"
  },
  {
    moduleId: "official-books",
    tCode: "LIB01",
    moduleName: "Libros Oficiales (Diario, Mayor, Balance)",
    category: "CONTABILIDAD CORE",
    requiredPermission: "ACC_BOOKS_VIEW"
  },
  {
    moduleId: "bank-reconciliation",
    tCode: "BNK01",
    moduleName: "Conciliación Bancaria",
    category: "TESORERÍA Y CIERRE",
    requiredPermission: "ACC_BANK_RECON_VIEW"
  },
  {
    moduleId: "period-closing",
    tCode: "PER01",
    moduleName: "Cierre de Periodos Contables",
    category: "TESORERÍA Y CIERRE",
    requiredPermission: "ACC_PERIOD_CLOSE_VIEW"
  },
  {
    moduleId: "financial-statements",
    tCode: "FIN01",
    moduleName: "Estados Financieros NIIF",
    category: "TESORERÍA Y CIERRE",
    requiredPermission: "ACC_FIN_STATEMENTS_VIEW"
  },
  {
    moduleId: "point-of-sale",
    tCode: "POS01",
    moduleName: "Punto de Venta (POS)",
    category: "MÓDULOS OPERATIVOS",
    requiredPermission: "OPS_POS_TERMINAL_VIEW"
  },
  {
    moduleId: "payroll",
    tCode: "NOM01",
    moduleName: "Nómina y Recursos Humanos",
    category: "MÓDULOS OPERATIVOS",
    requiredPermission: "OPS_PAYROLL_VIEW"
  },
  {
    moduleId: "module-integration",
    tCode: "INT01",
    moduleName: "Integración de Módulos",
    category: "INTEGRACIÓN Y BI",
    requiredPermission: "SYS_INTEGRATION_VIEW"
  },
  {
    moduleId: "reports",
    tCode: "REP01",
    moduleName: "Muestra de Reportes y Analítica",
    category: "INTEGRACIÓN Y BI",
    requiredPermission: "SYS_REPORTS_VIEW"
  }
];

export const GRANULAR_FUNCTION_ACTIONS = [
  { key: "ver", label: "Ver Módulo" },
  { key: "buscarPopular", label: "Buscar y Popular" },
  { key: "crear", label: "Crear Registro" },
  { key: "editar", label: "Editar / Modificar" },
  { key: "eliminarAnular", label: "Eliminar / Anular" },
  { key: "aprobarContabilizar", label: "Aprobar / Contabilizar" },
  { key: "exportar", label: "Exportar Reportes" }
];

function buildModulePermissionsMap(allowedModuleIds = ["*"], fullActions = true) {
  const map = {};
  const allowAll = allowedModuleIds.includes("*");
  PLATFORM_MODULAR_PERMISSIONS_CATALOG.forEach((mod) => {
    const enabled = allowAll || allowedModuleIds.includes(mod.moduleId);
    map[mod.moduleId] = {
      enabled,
      ver: enabled,
      buscarPopular: enabled,
      crear: enabled && fullActions,
      editar: enabled && fullActions,
      eliminarAnular: enabled && allowAll,
      aprobarContabilizar: enabled && fullActions,
      exportar: enabled
    };
  });
  return map;
}

const DEFAULT_DEPARTMENTS = [
  {
    id: "DEPT-TI",
    code: "TI-AD",
    name: "Departamento de Tecnología y Sistemas (TI)",
    manager: "Gerencia de Infraestructura y Seguridad AD",
    description: "Administración de servidores Windows AD, LDAP, RADIUS, Seguridad y Plataforma ERP.",
    status: "ACTIVO"
  },
  {
    id: "DEPT-ADMIN",
    code: "ADM-GER",
    name: "Departamento Administrativo y Gerencia",
    manager: "Dirección Administrativa y Financiera",
    description: "Gestión administrativa general, sociedades, supervisión contable, reportes y operaciones.",
    status: "ACTIVO"
  },
  {
    id: "DEPT-CONT",
    code: "CONT-NIIF",
    name: "Departamento de Contabilidad General",
    manager: "Contraloría General NIIF",
    description: "Catálogo de cuentas, asientos de partida doble, libros oficiales, cierres y estados financieros.",
    status: "ACTIVO"
  },
  {
    id: "DEPT-TES",
    code: "TES-BNK",
    name: "Departamento de Tesorería y Bancos",
    manager: "Jefatura de Tesorería Corporativa",
    description: "Conciliación bancaria automática, flujo de caja y ajustes de tesorería.",
    status: "ACTIVO"
  },
  {
    id: "DEPT-POS",
    code: "OPS-POS",
    name: "Departamento de Operaciones y Punto de Venta (POS)",
    manager: "Supervisión Comercial y Cajas",
    description: "Facturación en terminales POS, cobros y cierres de lote con integración contable.",
    status: "ACTIVO"
  },
  {
    id: "DEPT-RRHH",
    code: "RRHH-NOM",
    name: "Departamento de Nómina y Recursos Humanos",
    manager: "Gerencia de Capital Humano",
    description: "Liquidación de nómina, TSS, ISR y provisiones laborales.",
    status: "ACTIVO"
  },
  {
    id: "DEPT-AUD",
    code: "AUD-INT",
    name: "Departamento de Auditoría y Cumplimiento",
    manager: "Auditoría Interna Corporativa",
    description: "Inspección de bitácoras de seguridad, libros oficiales y estados financieros.",
    status: "ACTIVO"
  }
];

const DEFAULT_PERMISSION_GROUPS = [
  {
    id: "GRP-ADMIN",
    code: "GRUPO_ADMIN",
    name: "Grupo Admin (Acceso Total Plataforma)",
    departmentId: "DEPT-TI",
    departmentName: "Departamento de Tecnología y Sistemas (TI)",
    erpRoleEquivalent: "SUPER_ADMIN_SEGURIDAD",
    description: "Permisos absolutos sobre los 13 módulos independientes, seguridad, LDAP, RADIUS, empresas y contabilidad.",
    modulesAccess: buildModulePermissionsMap(["*"], true)
  },
  {
    id: "GRP-ADMINISTRATIVO",
    code: "GRUPO_ADMINISTRATIVO",
    name: "Grupo Administrativo (Gestión Empresarial)",
    departmentId: "DEPT-ADMIN",
    departmentName: "Departamento Administrativo y Gerencia",
    erpRoleEquivalent: "CONTRALOR_FINANCIERO",
    description: "Permisos administrativos amplios sobre empresas, contabilidad, bancos, estados financieros, POS, nómina y reportes.",
    modulesAccess: buildModulePermissionsMap(
      [
        "settings",
        "chart-of-accounts",
        "journal-entries",
        "official-books",
        "bank-reconciliation",
        "period-closing",
        "financial-statements",
        "point-of-sale",
        "payroll",
        "module-integration",
        "reports"
      ],
      true
    )
  },
  {
    id: "GRP-CONTABILIDAD",
    code: "GRUPO_CONTABILIDAD",
    name: "Grupo Contabilidad Core (NIIF)",
    departmentId: "DEPT-CONT",
    departmentName: "Departamento de Contabilidad General",
    erpRoleEquivalent: "CONTRALOR_FINANCIERO",
    description: "Permisos completos para Catálogo de Cuentas, Registro de Asientos, Libros Oficiales, Cierre y Estados Financieros.",
    modulesAccess: buildModulePermissionsMap(
      [
        "chart-of-accounts",
        "journal-entries",
        "official-books",
        "period-closing",
        "financial-statements",
        "reports"
      ],
      true
    )
  },
  {
    id: "GRP-TESORERIA",
    code: "GRUPO_TESORERIA",
    name: "Grupo Tesorería y Conciliación Bancaria",
    departmentId: "DEPT-TES",
    departmentName: "Departamento de Tesorería y Bancos",
    erpRoleEquivalent: "CONTRALOR_FINANCIERO",
    description: "Permisos focalizados en Conciliación Bancaria, Asientos de Ajuste, Estados Financieros y Reportes.",
    modulesAccess: buildModulePermissionsMap(
      [
        "bank-reconciliation",
        "journal-entries",
        "financial-statements",
        "reports"
      ],
      true
    )
  },
  {
    id: "GRP-OPERADORES-POS",
    code: "GRUPO_POS",
    name: "Grupo Punto de Venta y Facturación (POS)",
    departmentId: "DEPT-POS",
    departmentName: "Departamento de Operaciones y Punto de Venta (POS)",
    erpRoleEquivalent: "OPERADOR_POS",
    description: "Permisos operativos para facturar en Punto de Venta (POS01), cerrar lotes y consultar reportes de caja.",
    modulesAccess: buildModulePermissionsMap(
      ["point-of-sale", "reports"],
      true
    )
  },
  {
    id: "GRP-NOMINA-RRHH",
    code: "GRUPO_NOMINA",
    name: "Grupo Especialistas de Nómina y RRHH",
    departmentId: "DEPT-RRHH",
    departmentName: "Departamento de Nómina y Recursos Humanos",
    erpRoleEquivalent: "ESPECIALISTA_NOMINA",
    description: "Permisos para gestión de empleados, cálculo y contabilización de Nómina (NOM01) y reportes.",
    modulesAccess: buildModulePermissionsMap(
      ["payroll", "reports"],
      true
    )
  },
  {
    id: "GRP-AUDITORIA",
    code: "GRUPO_AUDITORIA",
    name: "Grupo Auditoría y Fiscalización",
    departmentId: "DEPT-AUD",
    departmentName: "Departamento de Auditoría y Cumplimiento",
    erpRoleEquivalent: "AUDITOR_SEGURIDAD_AD",
    description: "Permisos de supervisión y lectura sobre Seguridad, Usuarios AD, Libros Oficiales, Estados Financieros y Reportes.",
    modulesAccess: buildModulePermissionsMap(
      ["security", "users-windows", "official-books", "financial-statements", "reports"],
      false
    )
  }
];

export function getDepartmentsList() {
  try {
    const raw = localStorage.getItem(DEPARTMENTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (_e) {
    // Fallback
  }
  localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(DEFAULT_DEPARTMENTS));
  return JSON.parse(JSON.stringify(DEFAULT_DEPARTMENTS));
}

export function saveDepartmentsList(departments) {
  try {
    localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(departments));
  } catch (_e) {
    // Ignorar
  }
  return departments;
}

export async function createOrUpdateDepartment({ id, code, name, manager, description }) {
  const list = getDepartmentsList();
  const cleanName = String(name || "").trim();
  const cleanCode = String(code || cleanName.slice(0, 6)).trim().toUpperCase();
  const deptRecord = {
    id: id || `DEPT-${Date.now()}`,
    code: cleanCode,
    name: cleanName,
    manager: String(manager || "Gerencia de Área").trim(),
    description: String(description || "Departamento corporativo con grupos de permisos modulares.").trim(),
    status: "ACTIVO"
  };

  const existingIdx = list.findIndex((d) => d.id === deptRecord.id);
  if (existingIdx >= 0) {
    list[existingIdx] = deptRecord;
  } else {
    list.push(deptRecord);
  }

  saveDepartmentsList(list);
  await insertOrUpdateCollectionRecord("departments", deptRecord);

  recordSecurityAuditEvent({
    moduleId: "security",
    action: "DEPARTMENT_SAVED",
    detail: `Departamento '${deptRecord.name}' (${deptRecord.code}) guardado exitosamente.`,
    severity: "SUCCESS"
  });

  return deptRecord;
}

export function getPermissionGroupsList() {
  try {
    const raw = localStorage.getItem(PERMISSION_GROUPS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (_e) {
    // Fallback
  }
  localStorage.setItem(PERMISSION_GROUPS_STORAGE_KEY, JSON.stringify(DEFAULT_PERMISSION_GROUPS));
  return JSON.parse(JSON.stringify(DEFAULT_PERMISSION_GROUPS));
}

export function savePermissionGroupsList(groups) {
  try {
    localStorage.setItem(PERMISSION_GROUPS_STORAGE_KEY, JSON.stringify(groups));
  } catch (_e) {
    // Ignorar
  }
  return groups;
}

export function getPermissionGroupById(groupId) {
  const groups = getPermissionGroupsList();
  return groups.find((g) => g.id === groupId) || groups[0];
}

export async function createOrUpdatePermissionGroup({
  id,
  name,
  code,
  departmentId,
  description,
  modulesAccess
}) {
  const departments = getDepartmentsList();
  const targetDept = departments.find((d) => d.id === departmentId) || departments[0];
  const groups = getPermissionGroupsList();

  const cleanName = String(name || "").trim();
  const cleanCode = String(code || cleanName.toUpperCase().replace(/[^A-Z0-9]/g, "_")).slice(0, 24);

  const groupRecord = {
    id: id || `GRP-${Date.now()}`,
    code: cleanCode,
    name: cleanName,
    departmentId: targetDept.id,
    departmentName: targetDept.name,
    erpRoleEquivalent: "CONTRALOR_FINANCIERO",
    description: String(description || `Grupo de permisos modulares del ${targetDept.name}`).trim(),
    modulesAccess: modulesAccess || buildModulePermissionsMap(["settings", "chart-of-accounts", "reports"], true)
  };

  const idx = groups.findIndex((g) => g.id === groupRecord.id);
  if (idx >= 0) {
    groups[idx] = groupRecord;
  } else {
    groups.push(groupRecord);
  }

  savePermissionGroupsList(groups);
  await insertOrUpdateCollectionRecord("permissionGroups", groupRecord);

  recordSecurityAuditEvent({
    moduleId: "security",
    action: "PERMISSION_GROUP_SAVED",
    detail: `Grupo de permisos '${groupRecord.name}' guardado en '${groupRecord.departmentName}'.`,
    severity: "SUCCESS"
  });

  return groupRecord;
}

/**
 * Le dice a un usuario específico: "Los permisos que usarás son los del grupo seleccionado"
 * (ej. Grupo Admin, Grupo Administrativo o cualquier grupo de permisos de los departamentos).
 */
export async function assignPermissionGroupToUser({
  userId,
  permissionGroupId
}) {
  const users = getCollectionRecords("windowsAdUsers");
  const targetUser = users.find((u) => u.id === userId);
  const permGroup = getPermissionGroupById(permissionGroupId);

  if (!targetUser || !permGroup) {
    return null;
  }

  const updatedUser = {
    ...targetUser,
    assignedPermissionGroupId: permGroup.id,
    assignedPermissionGroupName: permGroup.name,
    assignedDepartmentId: permGroup.departmentId,
    assignedDepartmentName: permGroup.departmentName,
    erpRole: permGroup.erpRoleEquivalent || targetUser.erpRole || "CONTRALOR_FINANCIERO",
    modularPermissionsSnapshot: JSON.parse(JSON.stringify(permGroup.modulesAccess))
  };

  await insertOrUpdateCollectionRecord("windowsAdUsers", updatedUser);

  recordSecurityAuditEvent({
    actor: updatedUser.username,
    moduleId: "security",
    action: "USER_PERMISSION_GROUP_ASSIGNED",
    detail: `Al usuario '${updatedUser.username}' (${updatedUser.fullName}) se le asignó usar los permisos de '${permGroup.name}' [${permGroup.departmentName}].`,
    severity: "SUCCESS"
  });

  return updatedUser;
}

/**
 * Registra o actualiza en el directorio de usuarios del ERP un usuario traído en vivo
 * desde LDAP (172.16.4.2:389) o RADIUS (172.16.4.3:1812) y le asigna el grupo de permisos indicado.
 */
export async function registerFetchedAdOrRadiusUserWithPermissions({
  userProfile,
  permissionGroupId = "GRP-ADMINISTRATIVO"
}) {
  const existingUsers = getCollectionRecords("windowsAdUsers");
  const permGroup = getPermissionGroupById(permissionGroupId);

  const cleanUsername = String(userProfile.username || `laantillana\\${userProfile.samAccount}`).trim();
  const existing = existingUsers.find(
    (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
  );

  const cleanSam = String(userProfile.samAccount || cleanUsername.replace(/^.*\\/, "")).trim();
  const cleanEmail = userProfile.email || existing?.email || `${cleanSam}@laantillana.com`;
  const resolvedLocalPassword = userProfile.localPassword || userProfile.password || existing?.localPassword || "laantillana2026*";

  const userRecord = {
    id: existing ? existing.id : `AD-USR-${Date.now()}`,
    username: cleanUsername,
    samAccount: cleanSam,
    fullName: userProfile.fullName || cleanUsername,
    email: cleanEmail,
    localPassword: resolvedLocalPassword,
    organizationalUnit: userProfile.distinguishedName || "OU=Usuarios,dc=laantillana,dc=local",
    adGroup: Array.isArray(userProfile.adGroups) && userProfile.adGroups.length > 0
      ? String(userProfile.adGroups[0]).split(",")[0].replace(/^CN=/i, "")
      : permGroup.code,
    erpRole: permGroup.erpRoleEquivalent || "CONTRALOR_FINANCIERO",
    assignedPermissionGroupId: permGroup.id,
    assignedPermissionGroupName: permGroup.name,
    assignedDepartmentId: permGroup.departmentId,
    assignedDepartmentName: permGroup.departmentName,
    modularPermissionsSnapshot: JSON.parse(JSON.stringify(permGroup.modulesAccess)),
    mfaEnabled: true,
    authProtocol: userProfile.authProtocol || "LDAP (172.16.4.2:389)",
    lastLogon: new Date().toISOString().replace("T", " ").slice(0, 19),
    status: "ACTIVO"
  };

  await insertOrUpdateCollectionRecord("windowsAdUsers", userRecord);

  recordSecurityAuditEvent({
    actor: userRecord.username,
    moduleId: "users-windows",
    action: "USER_PULLED_AND_PERMISSIONS_ASSIGNED",
    detail: `Usuario '${userRecord.username}' (${userRecord.email}) traído desde ${userRecord.authProtocol} con contraseña local de respaldo y configurado para usar los permisos de '${permGroup.name}' (${permGroup.departmentName}).`,
    severity: "SUCCESS"
  });

  return userRecord;
}

/**
 * Actualiza o restablece la contraseña local y el correo de respaldo de un usuario
 * para que pueda ingresar desde la web cuando el dominio esté inaccesible o fuera.
 */
export async function updateUserLocalCredentials({
  userId,
  email,
  localPassword
}) {
  const users = getCollectionRecords("windowsAdUsers");
  const targetUser = users.find((u) => u.id === userId);
  if (!targetUser) {
    return null;
  }

  const updatedUser = {
    ...targetUser,
    email: email ? String(email).trim() : targetUser.email,
    localPassword: localPassword ? String(localPassword) : targetUser.localPassword
  };

  await insertOrUpdateCollectionRecord("windowsAdUsers", updatedUser);

  recordSecurityAuditEvent({
    actor: updatedUser.username,
    moduleId: "users-windows",
    action: "USER_LOCAL_CREDENTIALS_UPDATED",
    detail: `Credenciales locales de respaldo actualizadas para '${updatedUser.username}' (Correo: ${updatedUser.email}).`,
    severity: "SUCCESS"
  });

  return updatedUser;
}

export function countEnabledModulesInGroup(group) {
  if (!group || !group.modulesAccess) {
    return 0;
  }
  return Object.values(group.modulesAccess).filter((m) => m && m.enabled).length;
}
