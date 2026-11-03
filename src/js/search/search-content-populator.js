/**
 * Poblador de Información, Visualizador de Contenido Detallado y Estadísticas de Búsqueda.
 * Cumple la premisa central: "cuando busquemos, tiene que popular la información,
 * mostrar el contenido, y tiene que tener estadísticas".
 */

import { executeUniversalSearch } from "./universal-search-engine.js";
import {
  calculateDatasetStatistics,
  buildSearchStatisticsKpis,
  renderStatisticsKpiCardsHtml
} from "../statistics/real-time-statistics-calculator.js";
import { formatCurrencyAmount } from "../formatters/currency-and-number-formatter.js";
import {
  sanitizeTextString,
  highlightSearchMatchSafe
} from "../validators/security-input-sanitizer.js";
import { mountAndRenderIndependentModule } from "../core/independent-module-registry.js";

let currentlySelectedSearchItem = null;

export function renderPopulatedSearchHub(rawQuery, scopeModuleId = "ALL") {
  const panelEl = document.getElementById("global-search-intelligence-panel");
  const queryLabelEl = document.getElementById("search-active-query-label");
  const countLabelEl = document.getElementById("search-active-count-label");
  const statsContainerEl = document.getElementById("search-live-statistics-cards");
  const listContainerEl = document.getElementById("search-populated-records-container");
  const inspectorContainerEl = document.getElementById("search-record-content-inspector");

  if (!panelEl || !listContainerEl || !inspectorContainerEl || !statsContainerEl) {
    return;
  }

  const cleanQuery = String(rawQuery || "").trim();
  if (!cleanQuery) {
    panelEl.classList.add("is-hidden");
    return;
  }

  const searchOutcome = executeUniversalSearch(cleanQuery, scopeModuleId);
  panelEl.classList.remove("is-hidden");

  if (queryLabelEl) {
    queryLabelEl.textContent = `Búsqueda: "${cleanQuery}"`;
  }
  if (countLabelEl) {
    countLabelEl.textContent = `${searchOutcome.results.length} registros poblados`;
  }

  // 1. Calcular y poblar Estadísticas en Tiempo Real de lo buscado
  const stats = calculateDatasetStatistics(searchOutcome.results, "amount", "moduleName");
  const kpiCardsData = buildSearchStatisticsKpis(stats, searchOutcome.totalUniverseCount);
  statsContainerEl.innerHTML = renderStatisticsKpiCardsHtml(kpiCardsData);

  // 2. Poblar lista de resultados
  if (searchOutcome.results.length === 0) {
    currentlySelectedSearchItem = null;
    listContainerEl.innerHTML = `
      <div class="search-result-card">
        <div class="search-result-meta">
          <span class="search-result-title">No se encontraron registros para "${sanitizeTextString(cleanQuery)}"</span>
          <span class="search-result-subtitle">Intente buscar por cuenta (1.1.02), módulo, usuario (dbaezh), concepto o monto.</span>
        </div>
      </div>
    `;
    inspectorContainerEl.innerHTML = `
      <p class="module-description">Sin contenido para inspeccionar en esta consulta.</p>
    `;
    return;
  }

  currentlySelectedSearchItem = searchOutcome.results[0];

  listContainerEl.innerHTML = searchOutcome.results
    .slice(0, 35)
    .map((item, idx) => `
      <div class="search-result-card ${idx === 0 ? "is-selected" : ""}" data-search-uid="${sanitizeTextString(item.uid)}">
        <div class="search-result-meta">
          <span class="search-result-title">${highlightSearchMatchSafe(item.title, cleanQuery)}</span>
          <span class="search-result-subtitle">${highlightSearchMatchSafe(item.subtitle, cleanQuery)}</span>
        </div>
        <div class="module-toolbar-actions">
          <span class="badge-pill badge-info">${sanitizeTextString(item.moduleName)}</span>
          <span class="font-mono col-positive">${item.amount > 0 ? formatCurrencyAmount(item.amount) : sanitizeTextString(item.status)}</span>
        </div>
      </div>
    `)
    .join("");

  renderSelectedRecordContentInspector(currentlySelectedSearchItem, cleanQuery);

  // Eventos de selección para inspeccionar contenido al instante
  listContainerEl.querySelectorAll(".search-result-card").forEach((cardEl) => {
    cardEl.addEventListener("click", () => {
      const uid = cardEl.getAttribute("data-search-uid");
      const found = searchOutcome.results.find((r) => r.uid === uid);
      if (found) {
        currentlySelectedSearchItem = found;
        listContainerEl.querySelectorAll(".search-result-card").forEach((c) => c.classList.remove("is-selected"));
        cardEl.classList.add("is-selected");
        renderSelectedRecordContentInspector(found, cleanQuery);
      }
    });
  });
}

function renderSelectedRecordContentInspector(item, searchTerm = "") {
  const inspectorContainerEl = document.getElementById("search-record-content-inspector");
  if (!inspectorContainerEl || !item) {
    return;
  }

  const rawEntries = Object.entries(item.rawContent || {}).filter(
    ([key]) => !Array.isArray(item.rawContent[key])
  );

  const fieldsHtml = rawEntries
    .map(([key, val]) => `
      <div class="inspector-field-item">
        <span class="inspector-field-label">${sanitizeTextString(key)}</span>
        <span class="inspector-field-value">${highlightSearchMatchSafe(String(val ?? "-"), searchTerm)}</span>
      </div>
    `)
    .join("");

  // Si el registro tiene líneas contables (ej. Asiento Contable), mostrarlas también
  const nestedLines = Array.isArray(item.rawContent?.lines) ? item.rawContent.lines : [];
  const nestedLinesHtml = nestedLines.length > 0
    ? `
      <div class="table-scroll-container">
        <table class="accounting-table">
          <thead>
            <tr>
              <th>Cuenta</th>
              <th>Nombre</th>
              <th class="col-numeric">Débito</th>
              <th class="col-numeric">Crédito</th>
            </tr>
          </thead>
          <tbody>
            ${nestedLines.map((line) => `
              <tr>
                <td class="font-mono">${sanitizeTextString(line.accountCode)}</td>
                <td>${sanitizeTextString(line.accountName)}</td>
                <td class="col-numeric col-debit">${formatCurrencyAmount(line.debit)}</td>
                <td class="col-numeric col-credit">${formatCurrencyAmount(line.credit)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `
    : "";

  inspectorContainerEl.innerHTML = `
    <div class="inspector-header">
      <div>
        <span class="badge-pill badge-success">${sanitizeTextString(item.moduleName)}</span>
        <strong class="font-mono">${sanitizeTextString(item.code)}</strong>
      </div>
      <span class="badge-pill badge-info">${sanitizeTextString(item.status)}</span>
    </div>
    <div class="inspector-field-grid">
      ${fieldsHtml}
    </div>
    ${nestedLinesHtml}
  `;
}

export async function jumpToSelectedSearchModule() {
  if (!currentlySelectedSearchItem) {
    return;
  }
  await mountAndRenderIndependentModule(
    currentlySelectedSearchItem.moduleId,
    currentlySelectedSearchItem.code
  );
}
