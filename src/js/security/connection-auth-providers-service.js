/**
 * Servicio Independiente de Configuración de Conexiones y Proveedores de Autenticación SEGMENTADO POR EMPRESA:
 * - Cada empresa (Multi-Tenant / SaaS) posee su propia configuración aislada de conexión:
 *   1. Empresas con Conector Windows Server habilitado (ej. LA ANTILLANA - COMP-001): LDAP y RADIUS propios.
 *   2. Empresas que compran o alquilan la aplicación sin servidor Windows (ej. clientes SaaS): operan con
 *      autenticación LOCAL o OAuth Correo (16 caracteres) sin requerir ni exponer LDAP ni RADIUS.
 */

import {
  getCollectionRecords,
  insertOrUpdateCollectionRecord,
  getActiveCompanyRecord
} from "../database/database-provider-adapter.js";
import { recordSecurityAuditEvent } from "./audit-trail-logger.js";

const LEGACY_STORAGE_KEY_V6 = "EDA_AUTH_CONNECTION_CONFIG_V6";
const COMPANY_AUTH_MAP_STORAGE_KEY = "EDA_COMPANY_AUTH_CONFIG_MAP_V7";
const LOCAL_AD_GATEWAY_URL = "http://127.0.0.1:3890";

function createDefaultAntillanaWindowsConfig() {
  return {
    companyId: "COMP-001",
    windowsConnectorEnabled: true,
    activeProtocol: "LDAP",
    radius: {
      profileName: "AC_TIC",
      radSec: false,
      ipAddress: "172.16.4.3",
      authPort: "1812",
      accountingPort: "1813",
      sharedKey: "",
      retypeKey: "",
      timeoutSec: "5",
      retryCount: "3",
      dynamicAuthorization: false,
      statusServerAuth: true,
      statusServerAccounting: true,
      nasIpAddress: "172.16.10.11",
      nasIdentifier: "AC_TIC",
      connectionStatus: "Successful (Servidor RADIUS y Shared Key verificados en NPS)",
      statusState: "SUCCESS"
    },
    ldap: {
      name: "DC01",
      serverIpName: "172.16.4.2",
      serverPort: "389",
      commonNameIdentifier: "sAMAccountName",
      distinguishedName: "dc=laantillana,dc=local",
      exchangeServer: false,
      bindType: "Regular",
      username: "laantillana\\nps",
      password: "",
      secureConnection: false,
      connectionStatus: "Successful",
      statusState: "SUCCESS"
    }
  };
}

function createDefaultStandaloneCompanyConfig(companyId) {
  return {
    companyId,
    windowsConnectorEnabled: false,
    activeProtocol: "LOCAL",
    radius: {
      profileName: "RADIUS_EMPRESA",
      radSec: false,
      ipAddress: "",
      authPort: "1812",
      accountingPort: "1813",
      sharedKey: "",
      retypeKey: "",
      timeoutSec: "5",
      retryCount: "3",
      dynamicAuthorization: false,
      statusServerAuth: true,
      statusServerAccounting: true,
      nasIpAddress: "",
      nasIdentifier: "",
      connectionStatus: "Deshabilitado en esta empresa (Modo Independiente Local / OAuth)",
      statusState: "PENDING"
    },
    ldap: {
      name: "AD_EMPRESA",
      serverIpName: "",
      serverPort: "389",
      commonNameIdentifier: "sAMAccountName",
      distinguishedName: "",
      exchangeServer: false,
      bindType: "Regular",
      username: "",
      password: "",
      secureConnection: false,
      connectionStatus: "Deshabilitado en esta empresa (Modo Independiente Local / OAuth)",
      statusState: "PENDING"
    }
  };
}

function loadAllCompanyConfigsMap() {
  let map = {};
  try {
    const rawMap = localStorage.getItem(COMPANY_AUTH_MAP_STORAGE_KEY);
    if (rawMap) {
      map = JSON.parse(rawMap) || {};
    } else {
      // Migrar configuración previa V6 exclusivamente a COMP-001 (La Antillana)
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY_V6);
      if (legacyRaw) {
        const legacyParsed = JSON.parse(legacyRaw);
        const antillanaBase = createDefaultAntillanaWindowsConfig();
        map["COMP-001"] = {
          companyId: "COMP-001",
          windowsConnectorEnabled: true,
          activeProtocol: legacyParsed.activeProtocol || "LDAP",
          radius: { ...antillanaBase.radius, ...(legacyParsed.radius || {}) },
          ldap: { ...antillanaBase.ldap, ...(legacyParsed.ldap || {}) }
        };
        localStorage.setItem(COMPANY_AUTH_MAP_STORAGE_KEY, JSON.stringify(map));
      }
    }
  } catch (_e) {
    map = {};
  }
  return map;
}

export function getAuthConnectionConfigurations(targetCompanyId = null) {
  const activeComp = getActiveCompanyRecord();
  const resolvedCompanyId = targetCompanyId || activeComp?.id || "COMP-001";
  const allConfigsMap = loadAllCompanyConfigsMap();

  const baseDefault = resolvedCompanyId === "COMP-001"
    ? createDefaultAntillanaWindowsConfig()
    : createDefaultStandaloneCompanyConfig(resolvedCompanyId);

  const savedForCompany = allConfigsMap[resolvedCompanyId];
  if (savedForCompany) {
    const winEnabled = typeof savedForCompany.windowsConnectorEnabled === "boolean"
      ? savedForCompany.windowsConnectorEnabled
      : baseDefault.windowsConnectorEnabled;

    let effectiveProtocol = savedForCompany.activeProtocol || baseDefault.activeProtocol;
    if (!winEnabled && (effectiveProtocol === "LDAP" || effectiveProtocol === "RADIUS")) {
      effectiveProtocol = "LOCAL";
    }

    return {
      companyId: resolvedCompanyId,
      windowsConnectorEnabled: winEnabled,
      activeProtocol: effectiveProtocol,
      radius: { ...baseDefault.radius, ...(savedForCompany.radius || {}) },
      ldap: { ...baseDefault.ldap, ...(savedForCompany.ldap || {}) }
    };
  }

  return baseDefault;
}

export function saveAuthConnectionConfigurations(updatedConfig, targetCompanyId = null) {
  const activeComp = getActiveCompanyRecord();
  const resolvedCompanyId = targetCompanyId || updatedConfig?.companyId || activeComp?.id || "COMP-001";
  const current = getAuthConnectionConfigurations(resolvedCompanyId);
  const allConfigsMap = loadAllCompanyConfigsMap();

  const winEnabled = typeof updatedConfig.windowsConnectorEnabled === "boolean"
    ? updatedConfig.windowsConnectorEnabled
    : current.windowsConnectorEnabled;

  let nextProtocol = updatedConfig.activeProtocol || current.activeProtocol;
  if (!winEnabled && (nextProtocol === "LDAP" || nextProtocol === "RADIUS")) {
    nextProtocol = "LOCAL";
  }

  const merged = {
    companyId: resolvedCompanyId,
    windowsConnectorEnabled: winEnabled,
    activeProtocol: nextProtocol,
    radius: { ...current.radius, ...(updatedConfig.radius || {}) },
    ldap: { ...current.ldap, ...(updatedConfig.ldap || {}) }
  };

  allConfigsMap[resolvedCompanyId] = merged;

  try {
    localStorage.setItem(COMPANY_AUTH_MAP_STORAGE_KEY, JSON.stringify(allConfigsMap));
  } catch (_e) {
    // Ignorar
  }

  syncCompanyAuthTelemetryToShell();
  return merged;
}

/**
 * Actualiza los indicadores del encabezado y barra de estado según si la empresa activa
 * tiene o no habilitado el conector Windows Server (LDAP / RADIUS).
 */
export function syncCompanyAuthTelemetryToShell() {
  const activeComp = getActiveCompanyRecord();
  if (!activeComp) {
    return;
  }
  const compAuthCfg = getAuthConnectionConfigurations(activeComp.id);
  const headerAdUserEl = document.getElementById("header-active-ad-user");
  const statusbarAdEl = document.getElementById("statusbar-ad-server-label");

  if (compAuthCfg.windowsConnectorEnabled) {
    const serverHost = compAuthCfg.activeProtocol === "RADIUS"
      ? `${compAuthCfg.radius.ipAddress || "172.16.4.3"}:${compAuthCfg.radius.authPort || "1812"}`
      : `${compAuthCfg.ldap.serverIpName || "172.16.4.2"}:${compAuthCfg.ldap.serverPort || "389"}`;
    if (statusbarAdEl) {
      statusbarAdEl.innerHTML = `<strong>Conector Windows (${activeComp.nombreComercial}):</strong> ${compAuthCfg.activeProtocol} ${serverHost}`;
    }
  } else {
    if (headerAdUserEl && headerAdUserEl.textContent.includes("CORP\\")) {
      headerAdUserEl.textContent = `LOCAL\\admin (${activeComp.nombreComercial})`;
    }
    if (statusbarAdEl) {
      statusbarAdEl.innerHTML = `<strong>Autenticación (${activeComp.nombreComercial}):</strong> Modo Independiente Local / OAuth (Sin Windows AD)`;
    }
  }
}

export async function verifyRealLdapCredentialsWithGateway(ldapPayload) {
  try {
    const response = await fetch(`${LOCAL_AD_GATEWAY_URL}/api/ldap/bind`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ldapPayload)
    });

    const result = await response.json();

    recordSecurityAuditEvent({
      actor: ldapPayload.username || "ANONYMOUS",
      moduleId: "settings",
      action: result.success ? "LDAP_BIND_SUCCESS" : "LDAP_BIND_REJECTED",
      detail: `${ldapPayload.serverIpName}:${ldapPayload.serverPort} -> ${result.statusText} (${result.detail || ""})`,
      severity: result.success ? "SUCCESS" : "DANGER"
    });

    return {
      success: Boolean(result.success),
      resultCode: result.resultCode,
      statusState: result.success ? "SUCCESS" : "FAILED",
      statusText: result.statusText || (result.success ? "Successful" : "Failed"),
      detail: result.detail || ""
    };
  } catch (networkErr) {
    recordSecurityAuditEvent({
      actor: ldapPayload.username || "SYSTEM",
      moduleId: "settings",
      action: "LDAP_GATEWAY_UNREACHABLE",
      detail: `No se pudo contactar el puente LDAP local en ${LOCAL_AD_GATEWAY_URL}: ${networkErr.message}`,
      severity: "WARNING"
    });

    return {
      success: false,
      resultCode: -1,
      statusState: "FAILED",
      statusText: "Failed: Puente AD Local (127.0.0.1:3890) no detectado o bloqueado",
      detail: "Asegúrese de que el servicio puente (node src/js/server/windows-ad-ldap-radius-gateway.js) esté corriendo en este equipo."
    };
  }
}

export async function verifyRealRadiusWithGateway(radiusPayload) {
  try {
    const response = await fetch(`${LOCAL_AD_GATEWAY_URL}/api/radius/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(radiusPayload)
    });
    const result = await response.json();
    return {
      success: Boolean(result.success),
      statusState: result.success ? "SUCCESS" : "FAILED",
      statusText: result.statusText,
      detail: result.detail
    };
  } catch (err) {
    return {
      success: false,
      statusState: "FAILED",
      statusText: "Failed: Puente RADIUS Local (127.0.0.1:3890) desconectado",
      detail: err.message
    };
  }
}

export async function fetchAndAuthenticateUserFromLdapGateway(payload = {}) {
  try {
    const compCfg = getAuthConnectionConfigurations(payload.companyId);
    const mergedPayload = {
      serverIpName: payload.serverIpName || compCfg.ldap.serverIpName || "172.16.4.2",
      serverPort: payload.serverPort || compCfg.ldap.serverPort || "389",
      secureConnection: Boolean(payload.secureConnection ?? compCfg.ldap.secureConnection),
      bindUsername: payload.bindUsername || compCfg.ldap.username || "laantillana\\nps",
      bindPassword: payload.bindPassword || compCfg.ldap.password || "",
      distinguishedName: payload.distinguishedName || compCfg.ldap.distinguishedName || "dc=laantillana,dc=local",
      targetUsername: payload.targetUsername || "",
      userPasswordToAuthenticate: payload.userPasswordToAuthenticate ?? payload.targetPassword ?? ""
    };

    const response = await fetch(`${LOCAL_AD_GATEWAY_URL}/api/ldap/fetch-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mergedPayload)
    });
    const res = await response.json();
    return {
      ...res,
      ok: Boolean(res.success),
      message: res.statusText || res.detail || "",
      user: res.userProfile || null
    };
  } catch (err) {
    return {
      success: false,
      ok: false,
      statusText: "Failed: Puente LDAP Local (127.0.0.1:3890) desconectado",
      message: `Puente LDAP Local desconectado: ${err.message}`,
      detail: err.message
    };
  }
}

export async function fetchAndAuthenticateUserFromRadiusGateway(payload = {}) {
  try {
    const compCfg = getAuthConnectionConfigurations(payload.companyId);
    const mergedPayload = {
      radiusIp: payload.radiusIp || compCfg.radius.ipAddress || "172.16.4.3",
      radiusPort: payload.radiusPort || compCfg.radius.authPort || "1812",
      sharedKey: payload.sharedKey || compCfg.radius.sharedKey || "",
      nasIpAddress: payload.nasIpAddress || compCfg.radius.nasIpAddress || "172.16.10.11",
      nasIdentifier: payload.nasIdentifier || compCfg.radius.nasIdentifier || "AC_TIC",
      ldapIp: payload.ldapIp || compCfg.ldap.serverIpName || "172.16.4.2",
      ldapPort: payload.ldapPort || compCfg.ldap.serverPort || "389",
      bindUsername: payload.bindUsername || compCfg.ldap.username || "laantillana\\nps",
      bindPassword: payload.bindPassword || compCfg.ldap.password || "",
      distinguishedName: payload.distinguishedName || compCfg.ldap.distinguishedName || "dc=laantillana,dc=local",
      targetUsername: payload.targetUsername || "",
      userPasswordToAuthenticate: payload.userPasswordToAuthenticate ?? payload.targetPassword ?? ""
    };

    const response = await fetch(`${LOCAL_AD_GATEWAY_URL}/api/radius/fetch-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mergedPayload)
    });
    const res = await response.json();
    return {
      ...res,
      ok: Boolean(res.success),
      message: res.statusText || res.detail || "",
      user: res.userProfile || null
    };
  } catch (err) {
    return {
      success: false,
      ok: false,
      statusText: "Failed: Puente RADIUS Local (127.0.0.1:3890) desconectado",
      message: `Puente RADIUS Local desconectado: ${err.message}`,
      detail: err.message
    };
  }
}

export function generateSixteenCharacterAccessCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const randomBytes = new Uint8Array(16);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let code16 = "";
  for (let i = 0; i < 16; i += 1) {
    code16 += alphabet[randomBytes[i] % alphabet.length];
  }
  return code16;
}

export async function registerUserCompanyEntry({
  usernameOrEmail,
  fullName,
  authMethod,
  code16Used = "N/A",
  companyRecord
}) {
  const activeComp = companyRecord || getActiveCompanyRecord();
  const entryId = `ACC-ENT-${Date.now()}`;
  const entryPayload = {
    id: entryId,
    usernameOrEmail: String(usernameOrEmail || "").trim(),
    fullName: String(fullName || usernameOrEmail || "Usuario Corporativo").trim(),
    authMethod: authMethod || "OAUTH_CORREO_16",
    code16: String(code16Used || "N/A"),
    companyId: activeComp?.id || "COMP-001",
    companyName: activeComp?.nombreComercial || "LA ANTILLANA ERP PRODUCCION",
    companyRnc: activeComp?.rnc || "101-88921-2",
    enteredAt: new Date().toISOString().replace("T", " ").slice(0, 19),
    status: "ACCESO_REGISTRADO"
  };

  await insertOrUpdateCollectionRecord("companyUserAccessLog", entryPayload);

  recordSecurityAuditEvent({
    actor: entryPayload.usernameOrEmail,
    moduleId: "settings",
    action: `COMPANY_LOGIN_${entryPayload.authMethod}`,
    detail: `Usuario ${entryPayload.usernameOrEmail} ingresó a la empresa ${entryPayload.companyName} (${entryPayload.companyRnc}) vía ${entryPayload.authMethod} [Código: ${entryPayload.code16}].`,
    severity: "SUCCESS"
  });

  return entryPayload;
}

export function getCompanyUserAccessRegistry(filterCompanyId = null) {
  const existing = getCollectionRecords("companyUserAccessLog");
  const baseList = existing.length > 0
    ? existing
    : [
        {
          id: "ACC-ENT-1001",
          usernameOrEmail: "dbaezh@laantillana.com",
          fullName: "Daniel Báez H.",
          authMethod: "OAUTH_CORREO_16",
          code16: "K9M4P8X2W7R5Q3N6",
          companyId: "COMP-001",
          companyName: "LA ANTILLANA ERP PRODUCCION",
          companyRnc: "101-88921-2",
          enteredAt: "2026-11-03 10:15:00",
          status: "ACCESO_REGISTRADO"
        }
      ];

  if (filterCompanyId) {
    return baseList.filter((item) => !item.companyId || item.companyId === filterCompanyId);
  }
  return baseList;
}

/**
 * Consulta el estado en tiempo real del servicio Gateway Windows AD (127.0.0.1:3890)
 */
export async function checkGatewayServiceStatus() {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch("http://127.0.0.1:3890/api/health", {
      method: "GET",
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    if (res.ok) {
      const data = await res.json();
      return {
        online: true,
        latencyMs,
        service: data.service || "EasyDataAccounting AD/LDAP/RADIUS Gateway",
        port: data.port || 3890,
        statusText: "ONLINE (Servicio activo respondiendo solicitudes)"
      };
    }
    return {
      online: false,
      latencyMs,
      statusText: `OFFLINE (HTTP ${res.status})`
    };
  } catch (err) {
    return {
      online: false,
      latencyMs: Date.now() - startTime,
      statusText: `OFFLINE (Puente local 127.0.0.1:3890 no responde)`
    };
  }
}

