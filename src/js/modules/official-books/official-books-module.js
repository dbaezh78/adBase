/**
 * MÓDULO INDEPENDIENTE 5: LIBROS OFICIALES (T-CODE: LIB01)
 * Libro Diario General, Libro Mayor Analítico y Balance de Comprobación de Sumas y Saldos.
 */

import { getCollectionRecords } from "../../database/database-provider-adapter.js";
import { renderStatisticsKpiCardsHtml } from "../../statistics/real-time-statistics-calculator.js";
import { formatCurrencyAmount } from "../../formatters/currency-and-number-formatter.js";
import { sanitizeTextString, highlightSearchMatchSafe } from "../../validators/security-input-sanitizer.js";

export const OfficialBooksModule = {
  id: "official-books",
  tCode: "LIB01",
  name: "Libros Oficiales",
  category: "CONTABILIDAD CORE",
  templatePath: "./src/html/modules/official-books-view.html",
  requiredPermission: "ACC_BOOKS_VIEW",
  exportedFunctions: [
    "generateOfficialGeneralJournal",
    "generateGeneralLedgerByAccount",
    "generateTrialBalanceReport"
  ],

  async renderModuleWorkspace(containerEl, { searchQuery = "" } = {}) {
    let localSearch = searchQuery;
    let activeBookType = "LIBRO_MAYOR";
    let selectedLedgerRow = null;

    const renderContent = () => {
      const allAccounts = getCollectionRecords("chartOfAccounts").filter((a) => a.imputable);
      const allEntries = getCollectionRecords("journalEntries");
      const cleanSearch = String(localSearch || "").trim().toLowerCase();

      // Aplanar todas las partidas del Libro Diario
      const flatJournalLines = [];
      allEntries.forEach((entry, entryIdx) => {
        (entry.lines || []).forEach((line, lineIdx) => {
          flatJournalLines.push({
            folio: `FOL-${100 + entryIdx}-${lineIdx + 1}`,
            entryNumber: entry.number,
            date: entry.date,
            reference: entry.reference,
            concept: entry.concept,
            accountCode: line.accountCode,
            accountName: line.accountName,
            costCenter: line.costCenter || "CORP",
            debit: Number(line.debit) || 0,
            credit: Number(line.credit) || 0
          });
        });
      });

      const filteredJournalLines = flatJournalLines.filter((row) =>
        !cleanSearch ||
        `${row.folio} ${row.entryNumber} ${row.accountCode} ${row.accountName} ${row.concept} ${row.reference}`.toLowerCase().includes(cleanSearch)
      );

      // Construir Balance de Comprobación / Libro Mayor por cuenta
      const ledgerAccountsSummary = allAccounts
        .map((acc) => {
          const matchingLines = flatJournalLines.filter((l) => l.accountCode === acc.code);
          const sumDebit = matchingLines.reduce((s, l) => s + l.debit, 0);
          const sumCredit = matchingLines.reduce((s, l) => s + l.credit, 0);
          const debtorBalance = acc.nature === "DEUDORA" ? Number(acc.balance) || 0 : 0;
          const creditorBalance = acc.nature === "ACREEDORA" ? Number(acc.balance) || 0 : 0;
          return {
            code: acc.code,
            name: acc.name,
            type: acc.type,
            nature: acc.nature,
            movementsCount: matchingLines.length,
            sumDebit,
            sumCredit,
            debtorBalance,
            creditorBalance,
            lines: matchingLines
          };
        })
        .filter((row) =>
          !cleanSearch ||
          `${row.code} ${row.name} ${row.type} ${row.nature}`.toLowerCase().includes(cleanSearch)
        );

      if (!selectedLedgerRow || !ledgerAccountsSummary.some((r) => r.code === selectedLedgerRow.code)) {
        selectedLedgerRow = ledgerAccountsSummary[0];
      }

      const totalJournalDebits = filteredJournalLines.reduce((s, l) => s + l.debit, 0);
      const totalJournalCredits = filteredJournalLines.reduce((s, l) => s + l.credit, 0);

      const kpisHtml = renderStatisticsKpiCardsHtml([
        {
          label: "Partidas Libro Diario Pobladas",
          value: `${filteredJournalLines.length} / ${flatJournalLines.length}`,
          badge: activeBookType,
          subtitle: `${allEntries.length} pólizas oficializadas`,
          trend: "Foliado Legal",
          accent: "info",
          progressPct: (filteredJournalLines.length / Math.max(1, flatJournalLines.length)) * 100
        },
        {
          label: "Sumas Iguales (Debe)",
          value: formatCurrencyAmount(totalJournalDebits),
          badge: "LIBRO DIARIO",
          subtitle: "Acumulado movimientos Débito",
          trend: "Cuadre Legal",
          accent: "success",
          progressPct: 100
        },
        {
          label: "Sumas Iguales (Haber)",
          value: formatCurrencyAmount(totalJournalCredits),
          badge: "LIBRO DIARIO",
          subtitle: "Acumulado movimientos Crédito",
          trend: `Diferencia: ${formatCurrencyAmount(Math.abs(totalJournalDebits - totalJournalCredits))}`,
          accent: "purple",
          progressPct: 100
        },
        {
          label: "Cuentas en Libro Mayor",
          value: `${ledgerAccountsSummary.length}`,
          badge: "MAYOR GENERAL",
          subtitle: selectedLedgerRow ? `Foco: ${selectedLedgerRow.code}` : "Todas las cuentas",
          trend: "Saldos Arrastrados",
          accent: "warning",
          progressPct: 95
        }
      ]);

      containerEl.innerHTML = `
        <div class="stats-kpi-grid">${kpisHtml}</div>

        <div class="module-filter-bar">
          <div class="filter-input-group">
            <input
              type="search"
              id="lib-local-search-input"
              class="module-search-input"
              placeholder="Buscar en Libros Oficiales por folio, cuenta, asiento, concepto o documento..."
              value="${sanitizeTextString(localSearch)}"
            />
          </div>
          <div class="filter-pills-group">
            <button type="button" class="filter-pill-btn ${activeBookType === "LIBRO_MAYOR" ? "is-active" : ""}" data-book="LIBRO_MAYOR">
              Libro Mayor y Balance de Comprobación
            </button>
            <button type="button" class="filter-pill-btn ${activeBookType === "LIBRO_DIARIO" ? "is-active" : ""}" data-book="LIBRO_DIARIO">
              Libro Diario General Foliado
            </button>
          </div>
        </div>

        ${activeBookType === "LIBRO_MAYOR" ? `
          <div class="workspace-split-layout">
            <div class="enterprise-panel">
              <div class="enterprise-panel-header">
                <h3 class="enterprise-panel-title">Libro Mayor General y Balance de Comprobación (${ledgerAccountsSummary.length} cuentas)</h3>
                <span class="badge-pill badge-info">Click para poblar folios de la cuenta</span>
              </div>
              <div class="table-scroll-container">
                <table class="accounting-table">
                  <thead>
                    <tr>
                      <th>Cuenta</th>
                      <th>Denominación Contable</th>
                      <th class="col-numeric">Suma Debe</th>
                      <th class="col-numeric">Suma Haber</th>
                      <th class="col-numeric">Saldo Deudor</th>
                      <th class="col-numeric">Saldo Acreedor</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${ledgerAccountsSummary.map((row) => `
                      <tr class="ledger-acc-row ${selectedLedgerRow?.code === row.code ? "is-selected-row" : ""}" data-acc-code="${sanitizeTextString(row.code)}">
                        <td class="font-mono"><strong>${highlightSearchMatchSafe(row.code, localSearch)}</strong></td>
                        <td>${highlightSearchMatchSafe(row.name, localSearch)}</td>
                        <td class="col-numeric col-debit">${formatCurrencyAmount(row.sumDebit)}</td>
                        <td class="col-numeric col-credit">${formatCurrencyAmount(row.sumCredit)}</td>
                        <td class="col-numeric col-positive">${formatCurrencyAmount(row.debtorBalance)}</td>
                        <td class="col-numeric col-credit">${formatCurrencyAmount(row.creditorBalance)}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="enterprise-panel">
              <div class="enterprise-panel-header">
                <h3 class="enterprise-panel-title">Contenido del Folio Mayor: ${sanitizeTextString(selectedLedgerRow?.code || "-")}</h3>
                <span class="badge-pill badge-success">${sanitizeTextString(selectedLedgerRow?.nature || "-")}</span>
              </div>
              <div class="enterprise-panel-body">
                ${selectedLedgerRow ? `
                  <div class="search-content-inspector">
                    <div class="inspector-header">
                      <strong>${sanitizeTextString(selectedLedgerRow.code)} - ${sanitizeTextString(selectedLedgerRow.name)}</strong>
                      <span class="badge-pill badge-purple">${selectedLedgerRow.movementsCount} pases al Mayor</span>
                    </div>
                    <div class="table-scroll-container">
                      <table class="accounting-table">
                        <thead>
                          <tr>
                            <th>Folio</th>
                            <th>Asiento</th>
                            <th>Fecha</th>
                            <th>Glosa</th>
                            <th class="col-numeric">Debe</th>
                            <th class="col-numeric">Haber</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${selectedLedgerRow.lines.length === 0 ? `
                            <tr><td colspan="6">Cuenta con saldo inicial sin movimientos adicionales en el rango.</td></tr>
                          ` : selectedLedgerRow.lines.map((l) => `
                            <tr>
                              <td class="font-mono">${sanitizeTextString(l.folio)}</td>
                              <td class="font-mono">${sanitizeTextString(l.entryNumber)}</td>
                              <td class="font-mono">${sanitizeTextString(l.date)}</td>
                              <td>${highlightSearchMatchSafe(l.concept, localSearch)}</td>
                              <td class="col-numeric col-debit">${formatCurrencyAmount(l.debit)}</td>
                              <td class="col-numeric col-credit">${formatCurrencyAmount(l.credit)}</td>
                            </tr>
                          `).join("")}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ` : ""}
              </div>
            </div>
          </div>
        ` : `
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Libro Diario Oficial Foliado (${filteredJournalLines.length} líneas)</h3>
              <span class="badge-pill badge-success">Normativa Fiscal e Impresión Legal</span>
            </div>
            <div class="table-scroll-container">
              <table class="accounting-table">
                <thead>
                  <tr>
                    <th>Folio Legal</th>
                    <th>Fecha</th>
                    <th>Asiento</th>
                    <th>Código Cuenta</th>
                    <th>Nombre de la Cuenta</th>
                    <th>Concepto / Referencia</th>
                    <th class="col-numeric">Débito (Debe)</th>
                    <th class="col-numeric">Crédito (Haber)</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredJournalLines.map((line) => `
                    <tr>
                      <td class="font-mono">${highlightSearchMatchSafe(line.folio, localSearch)}</td>
                      <td class="font-mono">${sanitizeTextString(line.date)}</td>
                      <td class="font-mono"><strong>${highlightSearchMatchSafe(line.entryNumber, localSearch)}</strong></td>
                      <td class="font-mono">${highlightSearchMatchSafe(line.accountCode, localSearch)}</td>
                      <td>${highlightSearchMatchSafe(line.accountName, localSearch)}</td>
                      <td>${highlightSearchMatchSafe(line.concept, localSearch)} (${sanitizeTextString(line.reference)})</td>
                      <td class="col-numeric col-debit">${formatCurrencyAmount(line.debit)}</td>
                      <td class="col-numeric col-credit">${formatCurrencyAmount(line.credit)}</td>
                    </tr>
                  `).join("")}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="6">SUMAS IGUALES DEL LIBRO DIARIO OFICIAL</td>
                    <td class="col-numeric col-debit">${formatCurrencyAmount(totalJournalDebits)}</td>
                    <td class="col-numeric col-credit">${formatCurrencyAmount(totalJournalCredits)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        `}
      `;

      const searchInput = containerEl.querySelector("#lib-local-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          localSearch = e.target.value;
          renderContent();
          const refreshed = containerEl.querySelector("#lib-local-search-input");
          if (refreshed) {
            refreshed.focus();
            refreshed.setSelectionRange(localSearch.length, localSearch.length);
          }
        });
      }

      containerEl.querySelectorAll("[data-book]").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeBookType = btn.getAttribute("data-book");
          renderContent();
        });
      });

      containerEl.querySelectorAll(".ledger-acc-row").forEach((row) => {
        row.addEventListener("click", () => {
          const code = row.getAttribute("data-acc-code");
          selectedLedgerRow = ledgerAccountsSummary.find((r) => r.code === code) || selectedLedgerRow;
          renderContent();
        });
      });
    };

    renderContent();
  }
};
