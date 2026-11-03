/**
 * Adaptador de Base de Datos Desacoplado (Patrón Repository / Adapter).
 * Optimizado para carga instantánea (< 15ms) con hidratación local inmediata
 * y sincronización asíncrona no bloqueante hacia Firebase (easy-data-accounting).
 */

import { databaseTargetsConfig } from "../config/firebase-connection-config.js";
import {
  initializeFirebaseServicesNonBlocking,
  syncCollectionDocumentToFirebase,
  fetchCollectionFromFirebaseInBackground,
  getFirebaseTelemetryStatus
} from "./firebase-sdk-initializer.js";
import { INITIAL_ENTERPRISE_SEED_DATA } from "./initial-enterprise-seed-data.js";

const STORAGE_CACHE_KEY = "EDA_ENTERPRISE_DB_STATE_V5";
const ACTIVE_COMPANY_KEY = "EDA_ACTIVE_COMPANY_ID_V5";

let internalDatabaseStore = null;
let activeDatabaseProviderId = databaseTargetsConfig.activeProviderId;
let activeCompanyId = localStorage.getItem(ACTIVE_COMPANY_KEY) || "COMP-001";

function cloneDeepData(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function initializeDatabaseProvider() {
  const savedLocalState = localStorage.getItem(STORAGE_CACHE_KEY);
  if (savedLocalState) {
    try {
      const parsed = JSON.parse(savedLocalState);
      internalDatabaseStore = {
        ...cloneDeepData(INITIAL_ENTERPRISE_SEED_DATA),
        ...parsed
      };
      if (!Array.isArray(internalDatabaseStore.companies) || internalDatabaseStore.companies.length === 0) {
        internalDatabaseStore.companies = cloneDeepData(INITIAL_ENTERPRISE_SEED_DATA.companies);
      }
      if (!Array.isArray(internalDatabaseStore.savedThemes) || internalDatabaseStore.savedThemes.length === 0) {
        internalDatabaseStore.savedThemes = cloneDeepData(INITIAL_ENTERPRISE_SEED_DATA.savedThemes);
      }
    } catch (_err) {
      internalDatabaseStore = cloneDeepData(INITIAL_ENTERPRISE_SEED_DATA);
    }
  } else {
    internalDatabaseStore = cloneDeepData(INITIAL_ENTERPRISE_SEED_DATA);
  }

  // Inicializar SDK de Firebase sin bloquear el hilo principal ni esperar red
  const firebaseInitResult = initializeFirebaseServicesNonBlocking();

  recalculateChartOfAccountsBalances();
  persistLocalMirror();

  // Sincronización en segundo plano no bloqueante (0ms de espera para el usuario)
  if (firebaseInitResult.state.initialized) {
    setTimeout(async () => {
      try {
        const remoteJournalEntries = await fetchCollectionFromFirebaseInBackground("journalEntries");
        if (Array.isArray(remoteJournalEntries) && remoteJournalEntries.length > 0) {
          const existingIds = new Set(internalDatabaseStore.journalEntries.map((item) => item.id));
          let added = false;
          remoteJournalEntries.forEach((remoteEntry) => {
            if (!existingIds.has(remoteEntry.id)) {
              internalDatabaseStore.journalEntries.push(remoteEntry);
              added = true;
            }
          });
          if (added) {
            recalculateChartOfAccountsBalances();
            persistLocalMirror();
          }
        }
      } catch (_bgErr) {
        // Continúa transparente en modo híbrido
      }
    }, 50);
  }

  return {
    provider: getActiveDatabaseProviderMetadata(),
    firebaseStatus: getFirebaseTelemetryStatus()
  };
}

function persistLocalMirror() {
  try {
    localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(internalDatabaseStore));
  } catch (_err) {
    // Almacenamiento local restringido
  }
}

export function recalculateChartOfAccountsBalances() {
  if (!internalDatabaseStore) {
    return;
  }

  const accounts = internalDatabaseStore.chartOfAccounts || [];
  const entries = internalDatabaseStore.journalEntries || [];

  const movementMap = new Map();
  entries.forEach((entry) => {
    if (entry.status === "ANULADO") {
      return;
    }
    (entry.lines || []).forEach((line) => {
      const current = movementMap.get(line.accountCode) || { debit: 0, credit: 0 };
      current.debit += Number(line.debit) || 0;
      current.credit += Number(line.credit) || 0;
      movementMap.set(line.accountCode, current);
    });
  });

  accounts.forEach((account) => {
    if (account.imputable) {
      const mov = movementMap.get(account.code);
      if (mov) {
        account.debitTotal = Math.round(mov.debit * 100) / 100;
        account.creditTotal = Math.round(mov.credit * 100) / 100;
      }
    }
  });
}

export function getCollectionRecords(collectionName) {
  if (!internalDatabaseStore || !internalDatabaseStore[collectionName]) {
    return [];
  }
  return cloneDeepData(internalDatabaseStore[collectionName]);
}

export function getSingleConfigurationObject(configKey) {
  if (!internalDatabaseStore || !internalDatabaseStore[configKey]) {
    return {};
  }
  return cloneDeepData(internalDatabaseStore[configKey]);
}

export async function insertOrUpdateCollectionRecord(collectionName, recordObject) {
  if (!internalDatabaseStore[collectionName]) {
    internalDatabaseStore[collectionName] = [];
  }

  const list = internalDatabaseStore[collectionName];
  const recordId = recordObject.id || `${collectionName.toUpperCase()}-${Date.now()}`;
  const normalizedRecord = { ...recordObject, id: recordId };

  const existingIndex = list.findIndex((item) => item.id === recordId);
  if (existingIndex >= 0) {
    list[existingIndex] = normalizedRecord;
  } else {
    list.unshift(normalizedRecord);
  }

  recalculateChartOfAccountsBalances();
  persistLocalMirror();

  // Sincronizar con Firebase en segundo plano sin bloquear la respuesta de la interfaz
  if (activeDatabaseProviderId === "firebase-cloud") {
    syncCollectionDocumentToFirebase(collectionName, recordId, normalizedRecord);
  }

  return {
    record: cloneDeepData(normalizedRecord),
    providerId: activeDatabaseProviderId
  };
}

export function deleteRecordFromCollection(collectionName, recordId) {
  if (!internalDatabaseStore || !Array.isArray(internalDatabaseStore[collectionName])) {
    return false;
  }
  const initialLen = internalDatabaseStore[collectionName].length;
  internalDatabaseStore[collectionName] = internalDatabaseStore[collectionName].filter(
    (item) => item.id !== recordId
  );
  persistLocalMirror();
  return internalDatabaseStore[collectionName].length < initialLen;
}

export function getActiveCompanyRecord() {
  const companies = getCollectionRecords("companies");
  return companies.find((c) => c.id === activeCompanyId) || companies[0] || null;
}

export function setActiveCompanyRecord(companyId) {
  const companies = getCollectionRecords("companies");
  const found = companies.find((c) => c.id === companyId);
  if (found) {
    activeCompanyId = found.id;
    try {
      localStorage.setItem(ACTIVE_COMPANY_KEY, activeCompanyId);
    } catch (_e) {
      // Ignorar
    }
  }
  return getActiveCompanyRecord();
}

export function switchActiveDatabaseProvider(targetProviderId, customEndpoint = null) {
  const providerFound = databaseTargetsConfig.availableProviders.find((p) => p.id === targetProviderId);
  if (!providerFound) {
    throw new Error(`El proveedor de base de datos ${targetProviderId} no está registrado.`);
  }
  activeDatabaseProviderId = targetProviderId;
  if (customEndpoint) {
    providerFound.endpoint = customEndpoint;
  }
  return getActiveDatabaseProviderMetadata();
}

export function getActiveDatabaseProviderMetadata() {
  const found = databaseTargetsConfig.availableProviders.find((p) => p.id === activeDatabaseProviderId);
  return {
    ...found,
    allProviders: cloneDeepData(databaseTargetsConfig.availableProviders),
    firebaseTelemetry: getFirebaseTelemetryStatus()
  };
}
