/**
 * Configuración oficial de conexión a Firebase y arquitectura de migración multi-base de datos.
 * Permite operar con Firebase Cloud como motor principal y migrar o apuntar a otro servidor
 * (PostgreSQL, SQL Server, Oracle o API REST On-Premise en Windows Server) sin tocar los módulos.
 */

export const firebaseConfig = {
  apiKey: "AIzaSyDrjavsV0qCnQuc_G7C3M27RUFzaBUDv8Y",
  authDomain: "easy-data-accounting.firebaseapp.com",
  projectId: "easy-data-accounting",
  storageBucket: "easy-data-accounting.firebasestorage.app",
  messagingSenderId: "47286501314",
  appId: "1:47286501314:web:f4c5301fbb037b47d1205b",
  measurementId: "G-N1R4DST63K"
};

export const databaseTargetsConfig = {
  activeProviderId: "firebase-cloud",
  availableProviders: [
    {
      id: "firebase-cloud",
      name: "Google Firebase Cloud (easy-data-accounting)",
      type: "NoSQL Document / Real-Time Sync",
      endpoint: "https://easy-data-accounting.firebaseapp.com",
      projectId: "easy-data-accounting",
      encryption: "TLS 1.3 + AES-256 At-Rest"
    },
    {
      id: "windows-sql-server",
      name: "Windows Server SQL Server Enterprise (Conector Híbrido)",
      type: "Relational RDBMS / TDS Gateway",
      endpoint: "https://sql-gateway.corp.easydata.local/api/v1",
      projectId: "EDA_PROD_SQL",
      encryption: "Kerberos + TLS 1.3 Mutual Auth"
    },
    {
      id: "postgres-enterprise-api",
      name: "PostgreSQL Cloud / On-Premise Cluster",
      type: "Relational ACID Cluster",
      endpoint: "https://pg-cluster.easydata.internal/v2",
      projectId: "eda_financial_core",
      encryption: "SSL Strict Verify-Full"
    }
  ]
};
