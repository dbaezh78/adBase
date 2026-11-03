/**
 * Datos empresariales semilla (NIIF / IFRS) matemáticamente cuadrados para inicializar
 * la base de datos y poblar búsquedas, contenido, empresas (SAP Logon) y estadísticas en < 5ms.
 */

export const INITIAL_ENTERPRISE_SEED_DATA = {
  companies: [
    {
      id: "COMP-001",
      rnc: "101-88921-2",
      cedulaRnc: "101-88921-2",
      razonSocial: "LA ANTILLANA COMERCIAL S.A.",
      nombreComercial: "LA ANTILLANA ERP PRODUCCION",
      logoUrl: "./src/img/logos/easy-data-accounting-brand-logo.jpg",
      categoria: "GRAN CONTRIBUYENTE NACIONAL",
      regimenPagos: "RÉGIMEN ORDINARIO DE TRIBUTACIÓN",
      estado: "ACTIVO",
      actividadEconomica: "IMPORTACIÓN, COMERCIALIZACIÓN Y SERVICIOS CORPORATIVOS",
      administracionLocal: "ADM LOCAL GRANDES CONTRIBUYENTES",
      facturadorElectronico: "SÍ - AUTORIZADO E-CF (SERIE E)",
      licenciasVhm: "LICENCIA COMERCIALIZACIÓN VHM ACTIVA #VHM-901",
      areaTrabajo: "Local",
      idSistema: "ACP",
      grupoServidor: "172.16.4.13",
      numeroSistema: "00",
      servidorMensaje: "sap-prod.laantillana.local"
    },
    {
      id: "COMP-002",
      rnc: "130-44510-9",
      cedulaRnc: "130-44510-9",
      razonSocial: "EASY DATA ACCOUNTING DESARROLLO S.R.L.",
      nombreComercial: "DESARROLLO",
      logoUrl: "./src/img/logos/easy-data-accounting-brand-logo.jpg",
      categoria: "MEDIANO CONTRIBUYENTE",
      regimenPagos: "RÉGIMEN ORDINARIO DE TRIBUTACIÓN",
      estado: "ACTIVO",
      actividadEconomica: "DESARROLLO DE SOFTWARE FINANCIERO Y CONSULTORÍA ERP",
      administracionLocal: "ADM LOCAL ABRAHAM LINCOLN",
      facturadorElectronico: "SÍ - AUTORIZADO E-CF (SERIE E)",
      licenciasVhm: "NO APLICA",
      areaTrabajo: "Local",
      idSistema: "ACD",
      grupoServidor: "172.16.4.12",
      numeroSistema: "00",
      servidorMensaje: "erp-dev.easydata.local"
    },
    {
      id: "COMP-003",
      rnc: "131-90211-1",
      cedulaRnc: "131-90211-1",
      razonSocial: "CONSORCIO DE CALIDAD Y AUDITORIA QA S.A.",
      nombreComercial: "SAP QA",
      logoUrl: "./src/img/logos/easy-data-accounting-brand-logo.jpg",
      categoria: "GRAN CONTRIBUYENTE NACIONAL",
      regimenPagos: "RÉGIMEN ORDINARIO DE TRIBUTACIÓN",
      estado: "ACTIVO",
      actividadEconomica: "AUDITORÍA FINANCIERA Y CONTROL DE CALIDAD NIIF",
      administracionLocal: "ADM LOCAL SANTO DOMINGO ESTE",
      facturadorElectronico: "EN CERTIFICACIÓN E-CF",
      licenciasVhm: "LICENCIA VHM CORPORATIVA #VHM-308",
      areaTrabajo: "Local",
      idSistema: "ACQ",
      grupoServidor: "172.16.4.11",
      numeroSistema: "00",
      servidorMensaje: "erp-qa.easydata.local"
    },
    {
      id: "COMP-004",
      rnc: "132-77450-1",
      cedulaRnc: "132-77450-1",
      razonSocial: "LABORATORIO DE PRUEBAS FISCALES TEST S.R.L.",
      nombreComercial: "TEST",
      logoUrl: "./src/img/logos/easy-data-accounting-brand-logo.jpg",
      categoria: "MIPYMES / CONTRIBUYENTE ESPECIAL",
      regimenPagos: "RST - RÉGIMEN SIMPLIFICADO DE TRIBUTACIÓN",
      estado: "ACTIVO",
      actividadEconomica: "ENSAYOS DE INTEGRACIÓN Y MOTORES CONTABLES",
      administracionLocal: "ADM LOCAL SANTIAGO",
      facturadorElectronico: "SÍ - AUTORIZADO E-CF (SERIE E)",
      licenciasVhm: "EN TRÁMITE",
      areaTrabajo: "Local",
      idSistema: "ACT",
      grupoServidor: "172.16.4.23",
      numeroSistema: "00",
      servidorMensaje: "erp-test.easydata.local"
    }
  ],

  savedThemes: [
    {
      id: "theme-oscuro",
      name: "Oscuro (Original Enterprise)",
      baseKey: "oscuro",
      paletteKey: "palette-oscuro",
      description: "Tema oscuro de alto contraste financiero (por defecto).",
      isPreset: true
    },
    {
      id: "theme-claro",
      name: "Claro (Ejecutivo Luminoso)",
      baseKey: "claro",
      paletteKey: "palette-claro",
      description: "Tema claro corporativo para entornos de oficina iluminados.",
      isPreset: true
    },
    {
      id: "theme-azul",
      name: "Azul (SAP Logon Horizon)",
      baseKey: "azul",
      paletteKey: "palette-azul",
      description: "Tema azul profundo inspirado en SAP GUI 800 y Fiori.",
      isPreset: true
    }
  ],

  chartOfAccounts: [
    { id: "COA-1000", code: "1", name: "ACTIVOS", type: "ACTIVO", nature: "DEUDORA", level: 1, imputable: false, parentCode: null, costCenter: "CORP", balance: 485200.00, status: "ACTIVA" },
    { id: "COA-1100", code: "1.1", name: "ACTIVO CORRIENTE", type: "ACTIVO", nature: "DEUDORA", level: 2, imputable: false, parentCode: "1", costCenter: "CORP", balance: 315200.00, status: "ACTIVA" },
    { id: "COA-1101", code: "1.1.01", name: "Caja General y Efectivo POS", type: "ACTIVO", nature: "DEUDORA", level: 3, imputable: true, parentCode: "1.1", costCenter: "TES-01", balance: 28450.00, status: "ACTIVA" },
    { id: "COA-1102", code: "1.1.02", name: "Banco Corporativo Principal USD", type: "ACTIVO", nature: "DEUDORA", level: 3, imputable: true, parentCode: "1.1", costCenter: "TES-01", balance: 194750.00, status: "ACTIVA" },
    { id: "COA-1103", code: "1.1.03", name: "Cuentas por Cobrar Clientes Comerciales", type: "ACTIVO", nature: "DEUDORA", level: 3, imputable: true, parentCode: "1.1", costCenter: "COM-01", balance: 54000.00, status: "ACTIVA" },
    { id: "COA-1104", code: "1.1.04", name: "Inventario de Mercancías y Productos", type: "ACTIVO", nature: "DEUDORA", level: 3, imputable: true, parentCode: "1.1", costCenter: "ALM-01", balance: 38000.00, status: "ACTIVA" },
    { id: "COA-1200", code: "1.2", name: "ACTIVO NO CORRIENTE (PROPIEDAD, PLANTA Y EQUIPO)", type: "ACTIVO", nature: "DEUDORA", level: 2, imputable: false, parentCode: "1", costCenter: "CORP", balance: 170000.00, status: "ACTIVA" },
    { id: "COA-1201", code: "1.2.01", name: "Servidores Windows DataCenter e Infraestructura TI", type: "ACTIVO", nature: "DEUDORA", level: 3, imputable: true, parentCode: "1.2", costCenter: "TI-AD", balance: 170000.00, status: "ACTIVA" },

    { id: "COA-2000", code: "2", name: "PASIVOS", type: "PASIVO", nature: "ACREEDORA", level: 1, imputable: false, parentCode: null, costCenter: "CORP", balance: 112400.00, status: "ACTIVA" },
    { id: "COA-2100", code: "2.1", name: "PASIVO CORRIENTE", type: "PASIVO", nature: "ACREEDORA", level: 2, imputable: false, parentCode: "2", costCenter: "CORP", balance: 72400.00, status: "ACTIVA" },
    { id: "COA-2101", code: "2.1.01", name: "Cuentas por Pagar Proveedores Locales", type: "PASIVO", nature: "ACREEDORA", level: 3, imputable: true, parentCode: "2.1", costCenter: "COM-02", balance: 41200.00, status: "ACTIVA" },
    { id: "COA-2102", code: "2.1.02", name: "Impuestos e IVA / ITBIS por Pagar", type: "PASIVO", nature: "ACREEDORA", level: 3, imputable: true, parentCode: "2.1", costCenter: "FIS-01", balance: 14800.00, status: "ACTIVA" },
    { id: "COA-2103", code: "2.1.03", name: "Nómina y Retenciones Seguridad Social por Pagar", type: "PASIVO", nature: "ACREEDORA", level: 3, imputable: true, parentCode: "2.1", costCenter: "RRHH-01", balance: 16400.00, status: "ACTIVA" },
    { id: "COA-2200", code: "2.2", name: "PASIVO NO CORRIENTE", type: "PASIVO", nature: "ACREEDORA", level: 2, imputable: false, parentCode: "2", costCenter: "CORP", balance: 40000.00, status: "ACTIVA" },
    { id: "COA-2201", code: "2.2.01", name: "Préstamo Bancario Corporativo Largo Plazo", type: "PASIVO", nature: "ACREEDORA", level: 3, imputable: true, parentCode: "2.2", costCenter: "TES-01", balance: 40000.00, status: "ACTIVA" },

    { id: "COA-3000", code: "3", name: "PATRIMONIO NETO", type: "PATRIMONIO", nature: "ACREEDORA", level: 1, imputable: false, parentCode: null, costCenter: "CORP", balance: 280000.00, status: "ACTIVA" },
    { id: "COA-3101", code: "3.1.01", name: "Capital Social Suscrito y Pagado", type: "PATRIMONIO", nature: "ACREEDORA", level: 3, imputable: true, parentCode: "3", costCenter: "CORP", balance: 235000.00, status: "ACTIVA" },
    { id: "COA-3102", code: "3.1.02", name: "Utilidades Retenidas de Ejercicios Anteriores", type: "PATRIMONIO", nature: "ACREEDORA", level: 3, imputable: true, parentCode: "3", costCenter: "CORP", balance: 45000.00, status: "ACTIVA" },

    { id: "COA-4000", code: "4", name: "INGRESOS OPERACIONALES", type: "INGRESO", nature: "ACREEDORA", level: 1, imputable: false, parentCode: null, costCenter: "COM-01", balance: 186500.00, status: "ACTIVA" },
    { id: "COA-4101", code: "4.1.01", name: "Ventas de Mercancías y Licencias Empresariales", type: "INGRESO", nature: "ACREEDORA", level: 3, imputable: true, parentCode: "4", costCenter: "COM-01", balance: 148000.00, status: "ACTIVA" },
    { id: "COA-4102", code: "4.1.02", name: "Ingresos por Ventas en Terminal POS", type: "INGRESO", nature: "ACREEDORA", level: 3, imputable: true, parentCode: "4", costCenter: "POS-01", balance: 38500.00, status: "ACTIVA" },

    { id: "COA-5000", code: "5", name: "COSTOS Y GASTOS OPERATIVOS", type: "GASTO", nature: "DEUDORA", level: 1, imputable: false, parentCode: null, costCenter: "OPER", balance: 93700.00, status: "ACTIVA" },
    { id: "COA-5101", code: "5.1.01", name: "Costo de Ventas de Mercancías", type: "COSTO", nature: "DEUDORA", level: 3, imputable: true, parentCode: "5", costCenter: "ALM-01", balance: 42200.00, status: "ACTIVA" },
    { id: "COA-5201", code: "5.2.01", name: "Gastos de Sueldos, Salarios y Cargas de Nómina", type: "GASTO", nature: "DEUDORA", level: 3, imputable: true, parentCode: "5", costCenter: "RRHH-01", balance: 39800.00, status: "ACTIVA" },
    { id: "COA-5202", code: "5.2.02", name: "Gastos de Cloud, Licencias Windows Server y Bancarios", type: "GASTO", nature: "DEUDORA", level: 3, imputable: true, parentCode: "5", costCenter: "TI-AD", balance: 11700.00, status: "ACTIVA" }
  ],

  journalEntries: [
    {
      id: "AST-2026-0001",
      number: "AST-2026-0001",
      date: "2026-11-01",
      period: "2026-11",
      type: "APERTURA",
      sourceModule: "CONTABILIDAD",
      reference: "ACTA-CONST-2026",
      concept: "Asiento de apertura e infraestructura Windows Server DataCenter",
      status: "CONTABILIZADO",
      createdBy: "CORP\\dbaezh",
      totalDebit: 235000.00,
      totalCredit: 235000.00,
      lines: [
        { accountCode: "1.1.02", accountName: "Banco Corporativo Principal USD", costCenter: "TES-01", debit: 65000.00, credit: 0.00 },
        { accountCode: "1.2.01", accountName: "Servidores Windows DataCenter e Infraestructura TI", costCenter: "TI-AD", debit: 170000.00, credit: 0.00 },
        { accountCode: "3.1.01", accountName: "Capital Social Suscrito y Pagado", costCenter: "CORP", debit: 0.00, credit: 235000.00 }
      ]
    },
    {
      id: "AST-2026-0002",
      number: "AST-2026-0002",
      date: "2026-11-02",
      period: "2026-11",
      type: "INGRESO",
      sourceModule: "CONTABILIDAD",
      reference: "FAC-CORP-9081",
      concept: "Facturación corporativa de licencias ERP y consultoría financiera",
      status: "CONTABILIZADO",
      createdBy: "CORP\\mrodriguez",
      totalDebit: 162800.00,
      totalCredit: 162800.00,
      lines: [
        { accountCode: "1.1.02", accountName: "Banco Corporativo Principal USD", costCenter: "TES-01", debit: 108800.00, credit: 0.00 },
        { accountCode: "1.1.03", accountName: "Cuentas por Cobrar Clientes Comerciales", costCenter: "COM-01", debit: 54000.00, credit: 0.00 },
        { accountCode: "4.1.01", accountName: "Ventas de Mercancías y Licencias Empresariales", costCenter: "COM-01", debit: 0.00, credit: 148000.00 },
        { accountCode: "2.1.02", accountName: "Impuestos e IVA / ITBIS por Pagar", costCenter: "FIS-01", debit: 0.00, credit: 14800.00 }
      ]
    },
    {
      id: "AST-2026-0003",
      number: "AST-2026-0003",
      date: "2026-11-02",
      period: "2026-11",
      type: "NOMINA",
      sourceModule: "NOMINA",
      reference: "NOM-2026-11-Q1",
      concept: "Provisión y pago de Nómina Corporativa Quincena 1 integrando retenciones de ley",
      status: "CONTABILIZADO",
      createdBy: "CORP\\alopez",
      totalDebit: 39800.00,
      totalCredit: 39800.00,
      lines: [
        { accountCode: "5.2.01", accountName: "Gastos de Sueldos, Salarios y Cargas de Nómina", costCenter: "RRHH-01", debit: 39800.00, credit: 0.00 },
        { accountCode: "1.1.02", accountName: "Banco Corporativo Principal USD", costCenter: "TES-01", debit: 0.00, credit: 23400.00 },
        { accountCode: "2.1.03", accountName: "Nómina y Retenciones Seguridad Social por Pagar", costCenter: "RRHH-01", debit: 0.00, credit: 16400.00 }
      ]
    },
    {
      id: "AST-2026-0004",
      number: "AST-2026-0004",
      date: "2026-11-03",
      period: "2026-11",
      type: "POS_AUTOMATICO",
      sourceModule: "PUNTO_DE_VENTA",
      reference: "POS-TURNO-104",
      concept: "Contabilización automática de cierre de lote Punto de Venta (POS)",
      status: "CONTABILIZADO",
      createdBy: "CORP\\cajero01",
      totalDebit: 38500.00,
      totalCredit: 38500.00,
      lines: [
        { accountCode: "1.1.01", accountName: "Caja General y Efectivo POS", costCenter: "TES-01", debit: 28450.00, credit: 0.00 },
        { accountCode: "1.1.02", accountName: "Banco Corporativo Principal USD", costCenter: "TES-01", debit: 10050.00, credit: 0.00 },
        { accountCode: "4.1.02", accountName: "Ingresos por Ventas en Terminal POS", costCenter: "POS-01", debit: 0.00, credit: 38500.00 }
      ]
    }
  ],

  bankStatements: [
    { id: "BNK-MOV-01", date: "2026-11-01", bankAccount: "1.1.02", reference: "ACTA-CONST-2026", description: "Depósito Capital Inicial Corporativo", amount: 65000.00, type: "CREDITO_BANCARIO", matchedJournalId: "AST-2026-0001", status: "CONCILIADO" },
    { id: "BNK-MOV-02", date: "2026-11-02", bankAccount: "1.1.02", reference: "FAC-CORP-9081", description: "Transferencia Recibida Clientes Licencias ERP", amount: 108800.00, type: "CREDITO_BANCARIO", matchedJournalId: "AST-2026-0002", status: "CONCILIADO" },
    { id: "BNK-MOV-03", date: "2026-11-02", bankAccount: "1.1.02", reference: "NOM-2026-11-Q1", description: "Dispersión Bancaria Nómina Corporativa", amount: -23400.00, type: "DEBITO_BANCARIO", matchedJournalId: "AST-2026-0003", status: "CONCILIADO" },
    { id: "BNK-MOV-04", date: "2026-11-03", bankAccount: "1.1.02", reference: "POS-TURNO-104", description: "Liquidación Tarjetas POS Lote #104", amount: 10050.00, type: "CREDITO_BANCARIO", matchedJournalId: null, status: "PENDIENTE" },
    { id: "BNK-MOV-05", date: "2026-11-03", bankAccount: "1.1.02", reference: "COM-SWIFT-882", description: "Comisión Mantenimiento Cuenta Corporativa Swift", amount: -145.00, type: "DEBITO_BANCARIO", matchedJournalId: null, status: "EN_TRANSITO" }
  ],

  fiscalPeriods: [
    { id: "PER-2026-09", period: "2026-09", name: "Septiembre 2026", status: "CERRADO", closedBy: "CORP\\dbaezh", closedAt: "2026-10-02 18:10:00", entriesCount: 142, totalVolume: 890400.00, lockHash: "SHA256-9F8A7B1C" },
    { id: "PER-2026-10", period: "2026-10", name: "Octubre 2026", status: "CERRADO", closedBy: "CORP\\dbaezh", closedAt: "2026-11-01 09:00:00", entriesCount: 168, totalVolume: 1120500.00, lockHash: "SHA256-3E4D5F9A" },
    { id: "PER-2026-11", period: "2026-11", name: "Noviembre 2026 (Periodo Actual)", status: "ABIERTO", closedBy: "-", closedAt: "-", entriesCount: 4, totalVolume: 476100.00, lockHash: "PENDIENTE_CIERRE" },
    { id: "PER-2026-12", period: "2026-12", name: "Diciembre 2026 (Cierre Anual)", status: "FUTURO", closedBy: "-", closedAt: "-", entriesCount: 0, totalVolume: 0.00, lockHash: "SIN_APERTURA" }
  ],

  posCatalog: [
    { id: "PRD-001", sku: "ERP-LIC-ENT", name: "Licencia EasyData ERP Enterprise Node", category: "SOFTWARE", price: 1850.00, taxRate: 0.18, stock: 95, revenueAccount: "4.1.02" },
    { id: "PRD-002", sku: "WIN-SRV-2025", name: "Conector Windows Server AD / Kerberos SSO", category: "INFRAESTRUCTURA", price: 950.00, taxRate: 0.18, stock: 120, revenueAccount: "4.1.02" },
    { id: "PRD-003", sku: "AUD-NIIF-PRO", name: "Módulo Auditoría NIIF y Libros Oficiales", category: "CUMPLIMIENTO", price: 1200.00, taxRate: 0.18, stock: 80, revenueAccount: "4.1.02" },
    { id: "PRD-004", sku: "POS-TERM-HW", name: "Terminal Punto de Venta Biométrica Ultra", category: "HARDWARE", price: 680.00, taxRate: 0.18, stock: 42, revenueAccount: "4.1.02" },
    { id: "PRD-005", sku: "DB-SYNC-CLD", name: "Gateway Híbrido Firebase a SQL Server", category: "BASE_DE_DATOS", price: 1450.00, taxRate: 0.18, stock: 60, revenueAccount: "4.1.02" },
    { id: "PRD-006", sku: "SUP-24X7-SLA", name: "Soporte Crítico Empresarial 24/7 Anual", category: "SERVICIOS", price: 2400.00, taxRate: 0.18, stock: 999, revenueAccount: "4.1.02" }
  ],

  posSalesHistory: [
    { id: "POS-VTA-9001", date: "2026-11-03 08:30:10", customer: "Corporación Industrial del Norte S.A.", rncNit: "101-88921-2", itemsCount: 3, subtotal: 4650.00, taxAmount: 837.00, total: 5487.00, paymentMethod: "TARJETA_CORPORATIVA", journalId: "AST-2026-0004", cashier: "CORP\\cajero01", status: "CONTABILIZADO" },
    { id: "POS-VTA-9002", date: "2026-11-03 09:05:44", customer: "Grupo Financiero Atlántico", rncNit: "130-44510-9", itemsCount: 2, subtotal: 3300.00, taxAmount: 594.00, total: 3894.00, paymentMethod: "TRANSFERENCIA_INMEDIATA", journalId: "AST-2026-0004", cashier: "CORP\\cajero01", status: "CONTABILIZADO" },
    { id: "POS-VTA-9003", date: "2026-11-03 09:18:20", customer: "Distribuidora Tecnológica Global", rncNit: "131-90211-1", itemsCount: 1, subtotal: 1850.00, taxAmount: 333.00, total: 2183.00, paymentMethod: "EFECTIVO_CAJA", journalId: "AST-2026-0004", cashier: "CORP\\cajero01", status: "CONTABILIZADO" }
  ],

  payrollEmployees: [
    { id: "EMP-101", code: "EMP-101", fullName: "Daniel Báez H.", adSamAccount: "CORP\\dbaezh", department: "Dirección General & Arquitectura TI", position: "Chief Enterprise Architect", baseSalary: 8500.00, overtimeBonus: 650.00, socialSecurityDeduction: 539.85, incomeTaxDeduction: 1120.00, employerContribution: 1290.15, netPay: 7490.15, status: "ACTIVO" },
    { id: "EMP-102", code: "EMP-102", fullName: "Mariana Rodríguez V.", adSamAccount: "CORP\\mrodriguez", department: "Contraloría y Finanzas NIIF", position: "Contadora General Senior", baseSalary: 6200.00, overtimeBonus: 300.00, socialSecurityDeduction: 384.15, incomeTaxDeduction: 690.00, employerContribution: 915.00, netPay: 5425.85, status: "ACTIVO" },
    { id: "EMP-103", code: "EMP-103", fullName: "Alejandro López M.", adSamAccount: "CORP\\alopez", department: "Capital Humano y Nómina", position: "Gerente de Nómina y Cumplimiento", baseSalary: 4800.00, overtimeBonus: 200.00, socialSecurityDeduction: 295.50, incomeTaxDeduction: 410.00, employerContribution: 705.00, netPay: 4294.50, status: "ACTIVO" },
    { id: "EMP-104", code: "EMP-104", fullName: "Carlos Méndez R.", adSamAccount: "CORP\\cmendez", department: "Infraestructura Windows Server & Seguridad", position: "Administrador Active Directory", baseSalary: 5100.00, overtimeBonus: 400.00, socialSecurityDeduction: 325.05, incomeTaxDeduction: 495.00, employerContribution: 775.00, netPay: 4679.95, status: "ACTIVO" },
    { id: "EMP-105", code: "EMP-105", fullName: "Laura Gómez P.", adSamAccount: "CORP\\cajero01", department: "Operaciones Comerciales & POS", position: "Supervisora de Punto de Venta", baseSalary: 3200.00, overtimeBonus: 250.00, socialSecurityDeduction: 203.90, incomeTaxDeduction: 185.00, employerContribution: 486.00, netPay: 3061.10, status: "ACTIVO" }
  ],

  windowsAdUsers: [
    { id: "USR-AD-01", username: "laantillana\\dbaezh", fullName: "Daniel Báez H.", email: "dbaezh@laantillana.com", localPassword: "laantillana2026*", adDomain: "LAANTILLANA.LOCAL", organizationalUnit: "OU=Usuarios,dc=laantillana,dc=local", adGroup: "GRUPO_ADMIN", erpRole: "SUPER_ADMIN_SEGURIDAD", assignedPermissionGroupId: "GRP-ADMIN", assignedPermissionGroupName: "Grupo Admin (Acceso Total Plataforma)", authProtocol: "LDAP (172.16.4.2:389)", mfaEnabled: true, lastLogin: "2026-11-03 09:20:00", status: "ACTIVO" },
    { id: "USR-AD-02", username: "laantillana\\mrodriguez", fullName: "Mariana Rodríguez V.", email: "mrodriguez@laantillana.com", localPassword: "laantillana2026*", adDomain: "LAANTILLANA.LOCAL", organizationalUnit: "OU=Contabilidad,dc=laantillana,dc=local", adGroup: "GRUPO_CONTABILIDAD", erpRole: "CONTRALOR_FINANCIERO", assignedPermissionGroupId: "GRP-CONTABILIDAD", assignedPermissionGroupName: "Grupo Contabilidad Core (NIIF)", authProtocol: "LDAP (172.16.4.2:389)", mfaEnabled: true, lastLogin: "2026-11-03 08:55:12", status: "ACTIVO" },
    { id: "USR-AD-03", username: "laantillana\\alopez", fullName: "Alejandro López M.", email: "alopez@laantillana.com", localPassword: "laantillana2026*", adDomain: "LAANTILLANA.LOCAL", organizationalUnit: "OU=RecursosHumanos,dc=laantillana,dc=local", adGroup: "GRUPO_ADMINISTRATIVO", erpRole: "ESPECIALISTA_NOMINA", assignedPermissionGroupId: "GRP-ADMINISTRATIVO", assignedPermissionGroupName: "Grupo Administrativo (Gestión Empresarial)", authProtocol: "LDAP (172.16.4.2:389)", mfaEnabled: true, lastLogin: "2026-11-03 08:40:00", status: "ACTIVO" },
    { id: "USR-AD-04", username: "laantillana\\cmendez", fullName: "Carlos Méndez R.", email: "cmendez@laantillana.com", localPassword: "laantillana2026*", adDomain: "LAANTILLANA.LOCAL", organizationalUnit: "OU=SeguridadTI,dc=laantillana,dc=local", adGroup: "GRUPO_ADMIN", erpRole: "AUDITOR_SEGURIDAD_AD", assignedPermissionGroupId: "GRP-ADMIN", assignedPermissionGroupName: "Grupo Admin (Acceso Total Plataforma)", authProtocol: "RADIUS (172.16.4.3:1812)", mfaEnabled: true, lastLogin: "2026-11-03 08:15:30", status: "ACTIVO" },
    { id: "USR-AD-05", username: "laantillana\\cajero01", fullName: "Laura Gómez P.", email: "lgomez@laantillana.com", localPassword: "laantillana2026*", adDomain: "LAANTILLANA.LOCAL", organizationalUnit: "OU=PuntoDeVenta,dc=laantillana,dc=local", adGroup: "GRUPO_ADMINISTRATIVO", erpRole: "OPERADOR_POS", assignedPermissionGroupId: "GRP-ADMINISTRATIVO", assignedPermissionGroupName: "Grupo Administrativo (Gestión Empresarial)", authProtocol: "LOCAL_MANUAL", mfaEnabled: false, lastLogin: "2026-11-03 08:30:00", status: "ACTIVO" }
  ],

  windowsServerConfig: {
    domainName: "CORP.EASYDATA.LOCAL",
    primaryDomainController: "WIN-DC01.corp.easydata.local (10.24.0.10)",
    backupDomainController: "WIN-DC02.corp.easydata.local (10.24.0.11)",
    ldapPort: 636,
    protocol: "LDAPS TLS 1.3 + Kerberos SSO",
    baseDn: "DC=corp,DC=easydata,DC=local",
    syncIntervalMinutes: 5,
    status: "CONECTADO_Y_AUTENTICADO"
  },

  integrationRules: [
    { id: "INT-RULE-01", sourceModule: "PUNTO_DE_VENTA", eventName: "POS_SALE_COMPLETED", debitAccount: "1.1.01", creditAccount: "4.1.02", taxAccount: "2.1.02", autoPostJournal: true, securityVerified: true, status: "ACTIVA", executionsCount: 128 },
    { id: "INT-RULE-02", sourceModule: "NOMINA", eventName: "PAYROLL_RUN_APPROVED", debitAccount: "5.2.01", creditAccount: "1.1.02", liabilityAccount: "2.1.03", autoPostJournal: true, securityVerified: true, status: "ACTIVA", executionsCount: 24 },
    { id: "INT-RULE-03", sourceModule: "CONCILIACION_BANCARIA", eventName: "BANK_FEE_ADJUSTMENT", debitAccount: "5.2.02", creditAccount: "1.1.02", taxAccount: null, autoPostJournal: true, securityVerified: true, status: "ACTIVA", executionsCount: 19 },
    { id: "INT-RULE-04", sourceModule: "CIERRE_PERIODOS", eventName: "FISCAL_PERIOD_CLOSING", debitAccount: "4.1.01", creditAccount: "3.1.02", taxAccount: null, autoPostJournal: true, securityVerified: true, status: "ACTIVA", executionsCount: 10 }
  ]
};
