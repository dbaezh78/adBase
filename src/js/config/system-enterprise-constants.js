/**
 * Constantes globales del sistema ERP EasyDataAccounting, definición de módulos independientes,
 * códigos de transacción rápida (T-Codes) y naturalezas contables NIIF/IFRS.
 */

export const SYSTEM_METADATA = {
  systemName: "Contabilidad dBase",
  productTitleAboveVersion: "Accounting dBase",
  version: "5.0.0-ENTERPRISE",
  subtitleBelowVersion: "Base de datos para Contabilidad",
  architecture: "Micro-Kernel Modular Desacoplado",
  securityStandard: "Zero-Trust RBAC + Windows Server AD/LDAP & RADIUS Ready",
  defaultCurrency: "USD",
  fiscalYear: 2026
};

export const ACCOUNT_NATURES = {
  DEUDORA: "DEUDORA",
  ACREEDORA: "ACREEDORA"
};

export const ACCOUNT_TYPES = {
  ACTIVO: "ACTIVO",
  PASIVO: "PASIVO",
  PATRIMONIO: "PATRIMONIO",
  INGRESO: "INGRESO",
  COSTO: "COSTO",
  GASTO: "GASTO"
};

export const MODULE_DEFINITIONS = [
  {
    id: "settings",
    tCode: "CFG01",
    name: "Configuración y Empresas",
    category: "GOBIERNO Y SEGURIDAD",
    templatePath: "./src/html/modules/settings-and-companies-view.html",
    requiredPermission: "SYS_SETTINGS_VIEW",
    description: "Selección de empresa (SAP Logon 800), creación de empresa (RNC ###-#####-#) y temas por nombre."
  },
  {
    id: "security",
    tCode: "SEC01",
    name: "Seguridad y Gobierno",
    category: "GOBIERNO Y SEGURIDAD",
    templatePath: "./src/html/modules/security-governance-view.html",
    requiredPermission: "SEC_GOVERNANCE_VIEW",
    description: "Núcleo donde cada módulo y función se registra, autoriza y audita."
  },
  {
    id: "users-windows",
    tCode: "USR01",
    name: "Usuarios y Windows AD",
    category: "GOBIERNO Y SEGURIDAD",
    templatePath: "./src/html/modules/users-windows-ad-view.html",
    requiredPermission: "USR_WINDOWS_AD_VIEW",
    description: "Gestión de usuarios e integración con servidores Windows Active Directory / LDAP."
  },
  {
    id: "chart-of-accounts",
    tCode: "COA01",
    name: "Catálogo de Cuentas",
    category: "CONTABILIDAD CORE",
    templatePath: "./src/html/modules/chart-of-accounts-view.html",
    requiredPermission: "ACC_COA_VIEW",
    description: "Plan jerárquico de cuentas NIIF, naturalezas y saldos en tiempo real."
  },
  {
    id: "journal-entries",
    tCode: "FB50",
    name: "Registro de Asientos",
    category: "CONTABILIDAD CORE",
    templatePath: "./src/html/modules/journal-entries-view.html",
    requiredPermission: "ACC_JOURNAL_VIEW",
    description: "Registro de pólizas y asientos de partida doble con validación instantánea."
  },
  {
    id: "official-books",
    tCode: "LIB01",
    name: "Libros Oficiales",
    category: "CONTABILIDAD CORE",
    templatePath: "./src/html/modules/official-books-view.html",
    requiredPermission: "ACC_BOOKS_VIEW",
    description: "Libro Diario General, Libro Mayor y Balance de Comprobación de Sumas y Saldos."
  },
  {
    id: "bank-reconciliation",
    tCode: "BNK01",
    name: "Conciliación Bancaria",
    category: "TESORERÍA Y CIERRE",
    templatePath: "./src/html/modules/bank-reconciliation-view.html",
    requiredPermission: "ACC_BANK_RECON_VIEW",
    description: "Cruce automático y manual entre extractos bancarios y el Libro Mayor."
  },
  {
    id: "period-closing",
    tCode: "PER01",
    name: "Cierre de Periodos",
    category: "TESORERÍA Y CIERRE",
    templatePath: "./src/html/modules/period-closing-view.html",
    requiredPermission: "ACC_PERIOD_CLOSE_VIEW",
    description: "Control de periodos fiscales, validaciones pre-cierre y refundición de resultados."
  },
  {
    id: "financial-statements",
    tCode: "FIN01",
    name: "Estados Financieros",
    category: "TESORERÍA Y CIERRE",
    templatePath: "./src/html/modules/financial-statements-view.html",
    requiredPermission: "ACC_FIN_STATEMENTS_VIEW",
    description: "Balance General, Estado de Resultados (P&L) y Ratios Financieros."
  },
  {
    id: "point-of-sale",
    tCode: "POS01",
    name: "Punto de Venta (POS)",
    category: "MÓDULOS OPERATIVOS",
    templatePath: "./src/html/modules/point-of-sale-view.html",
    requiredPermission: "OPS_POS_TERMINAL_VIEW",
    description: "Terminal independiente de facturación rápida, inventario y arqueo de caja."
  },
  {
    id: "payroll",
    tCode: "NOM01",
    name: "Nómina y RRHH",
    category: "MÓDULOS OPERATIVOS",
    templatePath: "./src/html/modules/payroll-management-view.html",
    requiredPermission: "OPS_PAYROLL_VIEW",
    description: "Cálculo independiente de salarios, retenciones de ley y cargas patronales."
  },
  {
    id: "module-integration",
    tCode: "INT01",
    name: "Integración de Módulos",
    category: "INTEGRACIÓN Y BI",
    templatePath: "./src/html/modules/module-integration-hub-view.html",
    requiredPermission: "SYS_INTEGRATION_VIEW",
    description: "Motor de reglas de acoplamiento contable y migración de bases de datos."
  },
  {
    id: "reports",
    tCode: "REP01",
    name: "Muestra de Reportes",
    category: "INTEGRACIÓN Y BI",
    templatePath: "./src/html/modules/enterprise-reports-view.html",
    requiredPermission: "SYS_REPORTS_VIEW",
    description: "Centro ejecutivo de reportes dinámicos, estadísticas y exportación."
  }
];
