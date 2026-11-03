/**
 * Motor Universal de Búsqueda e Indexación Empresarial (Superior a SAP T-Codes + Full-Text).
 * Busca instantáneamente en todos los módulos o en el módulo seleccionado, devolviendo
 * registros poblados, su contenido detallado y el universo para cálculo de estadísticas.
 */

import { getCollectionRecords } from "../database/database-provider-adapter.js";
import { getSecurityAuditTrail } from "../security/audit-trail-logger.js";
import { MODULE_DEFINITIONS } from "../config/system-enterprise-constants.js";

export function buildUnifiedSearchIndex() {
  const unifiedIndex = [];

  // 0. Empresas y Conexiones SAP Logon (Configuración)
  getCollectionRecords("companies").forEach((comp) => {
    unifiedIndex.push({
      uid: `COMP-${comp.id}`,
      moduleId: "settings",
      moduleName: "Configuración y Empresas",
      code: comp.rnc,
      title: `${comp.nombreComercial} - ${comp.razonSocial}`,
      subtitle: `RNC: ${comp.rnc} | Categoría: ${comp.categoria} | Adm. Local: ${comp.administracionLocal}`,
      amount: 0,
      status: comp.estado,
      rawContent: comp
    });
  });

  // 1. Catálogo de Cuentas
  getCollectionRecords("chartOfAccounts").forEach((acc) => {
    unifiedIndex.push({
      uid: `COA-${acc.code}`,
      moduleId: "chart-of-accounts",
      moduleName: "Catálogo de Cuentas",
      code: acc.code,
      title: `${acc.code} - ${acc.name}`,
      subtitle: `Tipo: ${acc.type} | Naturaleza: ${acc.nature} | Centro Costo: ${acc.costCenter}`,
      amount: Number(acc.balance) || 0,
      status: acc.imputable ? "IMPUTABLE" : "AGRUPADORA",
      rawContent: acc
    });
  });

  // 2. Asientos Contables
  getCollectionRecords("journalEntries").forEach((entry) => {
    unifiedIndex.push({
      uid: `JRN-${entry.id}`,
      moduleId: "journal-entries",
      moduleName: "Registro de Asientos",
      code: entry.number,
      title: `${entry.number} - ${entry.concept}`,
      subtitle: `Fecha: ${entry.date} | Ref: ${entry.reference} | Usuario: ${entry.createdBy}`,
      amount: Number(entry.totalDebit) || 0,
      status: entry.status,
      rawContent: entry
    });
  });

  // 3. Conciliación Bancaria
  getCollectionRecords("bankStatements").forEach((mov) => {
    unifiedIndex.push({
      uid: `BNK-${mov.id}`,
      moduleId: "bank-reconciliation",
      moduleName: "Conciliación Bancaria",
      code: mov.reference,
      title: `${mov.reference} - ${mov.description}`,
      subtitle: `Fecha: ${mov.date} | Cuenta: ${mov.bankAccount} | Tipo: ${mov.type}`,
      amount: Math.abs(Number(mov.amount) || 0),
      status: mov.status,
      rawContent: mov
    });
  });

  // 4. Punto de Venta (Catálogo y Ventas)
  getCollectionRecords("posCatalog").forEach((prod) => {
    unifiedIndex.push({
      uid: `POS-PRD-${prod.id}`,
      moduleId: "point-of-sale",
      moduleName: "Punto de Venta (POS)",
      code: prod.sku,
      title: `${prod.sku} - ${prod.name}`,
      subtitle: `Categoría: ${prod.category} | Stock: ${prod.stock} uds | Cuenta: ${prod.revenueAccount}`,
      amount: Number(prod.price) || 0,
      status: "CATALOGO_POS",
      rawContent: prod
    });
  });

  getCollectionRecords("posSalesHistory").forEach((sale) => {
    unifiedIndex.push({
      uid: `POS-VTA-${sale.id}`,
      moduleId: "point-of-sale",
      moduleName: "Punto de Venta (POS)",
      code: sale.id,
      title: `${sale.id} - Cliente: ${sale.customer}`,
      subtitle: `NIT/RNC: ${sale.rncNit} | Método: ${sale.paymentMethod} | Asiento: ${sale.journalId}`,
      amount: Number(sale.total) || 0,
      status: sale.status,
      rawContent: sale
    });
  });

  // 5. Nómina de Empleados
  getCollectionRecords("payrollEmployees").forEach((emp) => {
    unifiedIndex.push({
      uid: `NOM-${emp.id}`,
      moduleId: "payroll",
      moduleName: "Nómina y RRHH",
      code: emp.code,
      title: `${emp.fullName} (${emp.position})`,
      subtitle: `Departamento: ${emp.department} | Cuenta Windows AD: ${emp.adSamAccount}`,
      amount: Number(emp.netPay) || 0,
      status: emp.status,
      rawContent: emp
    });
  });

  // 6. Usuarios y Directorio Activo Windows
  getCollectionRecords("windowsAdUsers").forEach((usr) => {
    unifiedIndex.push({
      uid: `USR-${usr.id}`,
      moduleId: "users-windows",
      moduleName: "Usuarios y Windows AD",
      code: usr.username,
      title: `${usr.username} - ${usr.fullName}`,
      subtitle: `Rol ERP: ${usr.erpRole} | Grupo AD: ${usr.adGroup} | Protocolo: ${usr.authProtocol}`,
      amount: 0,
      status: usr.status,
      rawContent: usr
    });
  });

  // 7. Periodos Fiscales
  getCollectionRecords("fiscalPeriods").forEach((per) => {
    unifiedIndex.push({
      uid: `PER-${per.id}`,
      moduleId: "period-closing",
      moduleName: "Cierre de Periodos",
      code: per.period,
      title: `Periodo Fiscal ${per.name}`,
      subtitle: `Asientos: ${per.entriesCount} | Hash Seguridad: ${per.lockHash}`,
      amount: Number(per.totalVolume) || 0,
      status: per.status,
      rawContent: per
    });
  });

  // 8. Auditoría de Seguridad
  getSecurityAuditTrail().slice(0, 25).forEach((aud) => {
    unifiedIndex.push({
      uid: `AUD-${aud.id}`,
      moduleId: "security",
      moduleName: "Seguridad y Gobierno",
      code: aud.action,
      title: `${aud.id} - ${aud.action}`,
      subtitle: `${aud.detail} | Actor: ${aud.actor}`,
      amount: 0,
      status: aud.severity,
      rawContent: aud
    });
  });

  return unifiedIndex;
}

export function executeUniversalSearch(rawQuery = "", scopeModuleId = "ALL") {
  const fullIndex = buildUnifiedSearchIndex();
  const normalizedQuery = String(rawQuery || "").trim().toLowerCase();

  const matchedTCodeModule = MODULE_DEFINITIONS.find(
    (mod) => mod.tCode.toLowerCase() === normalizedQuery
  );

  const scopedIndex = scopeModuleId === "ALL"
    ? fullIndex
    : fullIndex.filter((item) => item.moduleId === scopeModuleId);

  if (!normalizedQuery) {
    return {
      query: "",
      matchedTCodeModule: null,
      results: scopedIndex,
      totalUniverseCount: scopedIndex.length
    };
  }

  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  const filteredResults = scopedIndex.filter((item) => {
    const searchableBlob = `${item.code} ${item.title} ${item.subtitle} ${item.moduleName} ${item.status} ${JSON.stringify(item.rawContent)}`.toLowerCase();
    return terms.every((term) => searchableBlob.includes(term));
  });

  return {
    query: rawQuery,
    matchedTCodeModule,
    results: filteredResults,
    totalUniverseCount: scopedIndex.length
  };
}
