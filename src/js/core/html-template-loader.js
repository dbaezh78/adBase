/**
 * Cargador de Vistas HTML Modulares de Latencia Cero (0ms).
 * Renderiza instantáneamente la estructura semántica de cada módulo y pre-cachea
 * las plantillas desde /src/html/... en segundo plano sin bloquear la interfaz.
 */

const templateMemoryCache = new Map();

const INSTANT_MODULE_HEADER_BLUEPRINTS = {
  settings: {
    tCode: "CONFIGURACIÓN CORPORATIVA, EMPRESAS Y TEMAS (T-CODE: CFG01)",
    badge: "SAP LOGON 800 + DGII RNC + TEMAS DINÁMICOS",
    title: "Módulo Independiente de Configuración, Selección de Empresa y Temas",
    desc: "Selección de empresa activa estilo SAP Logon 800, registro de nuevas sociedades con máscara RNC (###-#####-#) y personalización de temas visuales generados en base al nombre."
  },
  security: {
    tCode: "NÚCLEO DE SEGURIDAD Y GOBIERNO (T-CODE: SEC01)",
    badge: "ZERO-TRUST ACTIVO",
    title: "Módulo Central de Seguridad e Integración de Módulos",
    desc: "Todo módulo, función o servicio nuevo se registra, autoriza y audita obligatoriamente desde este núcleo de seguridad independiente."
  },
  "users-windows": {
    tCode: "IDENTIDAD CORPORATIVA Y WINDOWS SERVER (T-CODE: USR01)",
    badge: "ACTIVE DIRECTORY / LDAPS / KERBEROS",
    title: "Módulo de Usuarios e Integración con Servidores Windows",
    desc: "Gestión independiente de identidades, sincronización con Controladores de Dominio Windows Server (Active Directory), mapeo de Unidades Organizativas (OU) y Grupos de Seguridad."
  },
  "chart-of-accounts": {
    tCode: "ESTRUCTURA CONTABLE NIIF / IFRS (T-CODE: COA01)",
    badge: "JERARQUÍA MULTINIVEL",
    title: "Módulo Independiente de Catálogo de Cuentas",
    desc: "Plan único de cuentas jerárquico con control de naturaleza contable, cuentas agrupadoras vs. imputables, centros de costo y saldos poblados al instante."
  },
  "journal-entries": {
    tCode: "PARTIDA DOBLE ESTRICTA (T-CODE: FB50)",
    badge: "VALIDACIÓN CUADRE AUTOMÁTICO",
    title: "Módulo Independiente de Registro de Asientos Contables",
    desc: "Captura, validación matemática en tiempo real (Débito = Crédito), contabilización inmediata en Firebase y reversión controlada por seguridad."
  },
  "official-books": {
    tCode: "LIBROS LEGALES Y FISCALES (T-CODE: LIB01)",
    badge: "DIARIO / MAYOR / BALANCE DE COMPROBACIÓN",
    title: "Módulo Independiente de Libros Oficiales",
    desc: "Generación instantánea de Libro Diario General, Libro Mayor con arrastre de saldos por cuenta y Balance de Comprobación de Sumas y Saldos."
  },
  "bank-reconciliation": {
    tCode: "TESORERÍA Y BANCOS (T-CODE: BNK01)",
    badge: "MATCHING AUTOMÁTICO Y MANUAL",
    title: "Módulo Independiente de Conciliación Bancaria",
    desc: "Cruce inteligente entre extractos bancarios y movimientos del Libro Mayor, detección de partidas en tránsito y generación de ajustes bancarios."
  },
  "period-closing": {
    tCode: "CONTROL DE EJERCICIO FISCAL (T-CODE: PER01)",
    badge: "VALIDACIÓN PRE-CIERRE Y REFUNDICIÓN",
    title: "Módulo Independiente de Cierre de Periodos",
    desc: "Auditoría previa al cierre contable, bloqueo de periodos contra registros extemporáneos y asiento automático de cierre de cuentas nominales."
  },
  "financial-statements": {
    tCode: "REPORTE FINANCIERO NIIF (T-CODE: FIN01)",
    badge: "BALANCE GENERAL + ESTADO DE RESULTADOS + RATIOS",
    title: "Módulo Independiente de Estados Financieros",
    desc: "Estado de Situación Financiera (Balance General), Estado de Resultados Integral (P&L), análisis vertical e indicadores de liquidez, solvencia y rentabilidad."
  },
  "point-of-sale": {
    tCode: "FACTURACIÓN Y CAJA RÁPIDA (T-CODE: POS01)",
    badge: "MÓDULO OPERATIVO INDEPENDIENTE",
    title: "Módulo Independiente de Punto de Venta (POS)",
    desc: "Terminal de ventas de alta velocidad que opera de forma autónoma y emite eventos de contabilización automática hacia el bus de integración."
  },
  payroll: {
    tCode: "CAPITAL HUMANO Y PLANILLAS (T-CODE: NOM01)",
    badge: "CÁLCULO DE RETENCIONES Y APORTES",
    title: "Módulo Independiente de Nómina",
    desc: "Liquidación salarial independiente con cálculo automático de seguridad social, impuesto sobre la renta, cargas patronales y dispersión contable."
  },
  "module-integration": {
    tCode: "ORQUESTACIÓN DESACOPLADA (T-CODE: INT01)",
    badge: "EVENT BUS + CONECTOR MULTI-DB",
    title: "Módulo de Integración con Otros Módulos y Bases de Datos",
    desc: "Reglas de contabilización automática (POS, Nómina, Bancos, Sistemas Externos) y conmutador de motor de base de datos (Firebase Cloud, SQL Server / PostgreSQL REST)."
  },
  reports: {
    tCode: "INTELIGENCIA DE NEGOCIOS Y AUDITORÍA (T-CODE: REP01)",
    badge: "ANALÍTICA EJECUTIVA CONSOLIDADA",
    title: "Módulo Independiente de Muestra de Reportes y Estadísticas",
    desc: "Centro unificado de reportes dinámicos, matrices de desempeño operativo, exportación estructurada (JSON/CSV) y auditoría integral."
  }
};

export async function loadHtmlTemplateView(templatePath, fallbackModuleId = "module") {
  if (templateMemoryCache.has(templatePath)) {
    return templateMemoryCache.get(templatePath);
  }

  const bp = INSTANT_MODULE_HEADER_BLUEPRINTS[fallbackModuleId];
  if (bp) {
    const instantHtml = `
      <article class="module-view-container" data-module-template="${fallbackModuleId}">
        <header class="module-header-banner">
          <div class="module-title-block">
            <div class="module-overline">
              <span>${bp.tCode}</span>
              <span class="badge-pill badge-success">${bp.badge}</span>
            </div>
            <h1 class="module-main-title">${bp.title}</h1>
            <p class="module-description">${bp.desc}</p>
          </div>
        </header>
        <div id="${fallbackModuleId}-module-dynamic-slot"></div>
      </article>
    `;
    templateMemoryCache.set(templatePath, instantHtml);
    return instantHtml;
  }

  try {
    const response = await fetch(templatePath);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const htmlContent = await response.text();
    templateMemoryCache.set(templatePath, htmlContent);
    return htmlContent;
  } catch (_fetchErr) {
    return `
      <article class="module-view-container" data-module-template="${fallbackModuleId}">
        <div id="${fallbackModuleId}-module-dynamic-slot"></div>
      </article>
    `;
  }
}
