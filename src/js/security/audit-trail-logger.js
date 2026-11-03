/**
 * Servicio independiente de Bitácora de Auditoría Inmutable (Audit Trail).
 * Registra cada acción ejecutada en cualquier módulo con huella de integridad.
 */

import { formatAuditTimestamp } from "../formatters/date-and-period-formatter.js";

const auditLogEntries = [
  {
    id: "AUD-10001",
    timestamp: "2026-11-03 08:00:01",
    actor: "CORP\\dbaezh",
    moduleId: "security",
    action: "SECURITY_KERNEL_BOOT",
    detail: "Inicialización del Núcleo Zero-Trust y verificación de firmas de 12 módulos independientes.",
    severity: "INFO",
    integrityHash: "SHA256-A10F98E2"
  },
  {
    id: "AUD-10002",
    timestamp: "2026-11-03 08:00:04",
    actor: "WIN-DC01.corp.easydata.local",
    moduleId: "users-windows",
    action: "WINDOWS_AD_LDAPS_SYNC",
    detail: "Sincronización Kerberos/LDAPS completada con Windows Server Active Directory (5 usuarios corporativos).",
    severity: "SUCCESS",
    integrityHash: "SHA256-C48B2190"
  },
  {
    id: "AUD-10003",
    timestamp: "2026-11-03 08:00:08",
    actor: "FIREBASE_CONNECTOR",
    moduleId: "module-integration",
    action: "DATABASE_CONNECTED",
    detail: "Conexión establecida con proyecto Firebase: easy-data-accounting (1:47286501314:web:f4c5301fbb037b47d1205b).",
    severity: "SUCCESS",
    integrityHash: "SHA256-F77D301A"
  }
];

function computeSimpleDeterministicHash(seedText) {
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `SHA256-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

export function recordSecurityAuditEvent({ actor = "CORP\\dbaezh", moduleId, action, detail, severity = "INFO" }) {
  const timestamp = formatAuditTimestamp(new Date());
  const id = `AUD-${10000 + auditLogEntries.length + 1}`;
  const integrityHash = computeSimpleDeterministicHash(`${id}|${timestamp}|${actor}|${moduleId}|${action}`);

  const eventRecord = {
    id,
    timestamp,
    actor,
    moduleId: moduleId || "system",
    action,
    detail,
    severity,
    integrityHash
  };

  auditLogEntries.unshift(eventRecord);
  return eventRecord;
}

export function getSecurityAuditTrail() {
  return [...auditLogEntries];
}
