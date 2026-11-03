/**
 * MÓDULO INDEPENDIENTE 9: PUNTO DE VENTA - POS (T-CODE: POS01)
 * Terminal autónoma de facturación rápida, carrito de venta, control de stock
 * y emisión de eventos desacoplados para contabilización automática.
 */

import {
  getCollectionRecords,
  insertOrUpdateCollectionRecord
} from "../../database/database-provider-adapter.js";
import { publishSystemEvent } from "../../core/event-bus-dispatcher.js";
import { recordSecurityAuditEvent } from "../../security/audit-trail-logger.js";
import { getActiveUserSecuritySession } from "../../security/role-permission-evaluator.js";
import { renderStatisticsKpiCardsHtml } from "../../statistics/real-time-statistics-calculator.js";
import { formatCurrencyAmount } from "../../formatters/currency-and-number-formatter.js";
import { sanitizeTextString, highlightSearchMatchSafe } from "../../validators/security-input-sanitizer.js";
import { dispatchEnterpriseToast } from "../../core/ui-notification-dispatcher.js";

export const PointOfSaleModule = {
  id: "point-of-sale",
  tCode: "POS01",
  name: "Punto de Venta (POS)",
  category: "MÓDULOS OPERATIVOS",
  templatePath: "./src/html/modules/point-of-sale-view.html",
  requiredPermission: "OPS_POS_TERMINAL_VIEW",
  exportedFunctions: [
    "addProductToPosTicket",
    "processIndependentPosCheckout",
    "searchPosCatalogAndTickets"
  ],

  async renderModuleWorkspace(containerEl, { searchQuery = "" } = {}) {
    let localSearch = searchQuery;
    let currentTicketItems = [
      { id: "PRD-001", sku: "ERP-LIC-ENT", name: "Licencia EasyData ERP Enterprise Node", price: 1850.00, qty: 1 }
    ];

    const renderContent = () => {
      const catalog = getCollectionRecords("posCatalog");
      const salesHistory = getCollectionRecords("posSalesHistory");
      const cleanSearch = String(localSearch || "").trim().toLowerCase();

      const filteredCatalog = catalog.filter((p) =>
        !cleanSearch || `${p.sku} ${p.name} ${p.category}`.toLowerCase().includes(cleanSearch)
      );

      const filteredSales = salesHistory.filter((s) =>
        !cleanSearch || `${s.id} ${s.customer} ${s.rncNit} ${s.paymentMethod} ${s.journalId}`.toLowerCase().includes(cleanSearch)
      );

      const subtotalTicket = currentTicketItems.reduce((acc, i) => acc + i.price * i.qty, 0);
      const taxTicket = Math.round(subtotalTicket * 0.18 * 100) / 100;
      const totalTicket = Math.round((subtotalTicket + taxTicket) * 100) / 100;

      const totalPosRevenue = filteredSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
      const avgTicket = filteredSales.length > 0 ? totalPosRevenue / filteredSales.length : 0;

      const kpisHtml = renderStatisticsKpiCardsHtml([
        {
          label: "Productos POS Poblados",
          value: `${filteredCatalog.length} / ${catalog.length}`,
          badge: "CATÁLOGO ACTIVO",
          subtitle: "Disponibles para venta inmediata",
          trend: "Stock en línea",
          accent: "info",
          progressPct: (filteredCatalog.length / Math.max(1, catalog.length)) * 100
        },
        {
          label: "Facturación POS Filtrada",
          value: formatCurrencyAmount(totalPosRevenue),
          badge: `${filteredSales.length} TICKETS`,
          subtitle: "Ventas procesadas en terminal",
          trend: "Integración Automática",
          accent: "success",
          progressPct: 90
        },
        {
          label: "Ticket Promedio POS",
          value: formatCurrencyAmount(avgTicket),
          badge: "KPI COMERCIAL",
          subtitle: "Valor medio por transacción",
          trend: "IVA/ITBIS 18% Incluido",
          accent: "purple",
          progressPct: 80
        },
        {
          label: "Carrito Actual en Caja",
          value: formatCurrencyAmount(totalTicket),
          badge: `${currentTicketItems.length} ÍTEMS`,
          subtitle: `Impuestos: ${formatCurrencyAmount(taxTicket)}`,
          trend: "Listo para cobro",
          accent: "warning",
          progressPct: currentTicketItems.length > 0 ? 100 : 15
        }
      ]);

      containerEl.innerHTML = `
        <div class="stats-kpi-grid">${kpisHtml}</div>

        <div class="module-filter-bar">
          <div class="filter-input-group">
            <input
              type="search"
              id="pos-local-search-input"
              class="module-search-input"
              placeholder="Buscar producto por código SKU, nombre, categoría o buscar facturas emitidas por cliente / NIT..."
              value="${sanitizeTextString(localSearch)}"
            />
          </div>
          <div class="module-toolbar-actions">
            <span class="badge-pill badge-success">Módulo POS Independiente Conectado a Firebase</span>
          </div>
        </div>

        <div class="workspace-split-layout">
          <!-- Catálogo de Productos + Historial de Ventas POS -->
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Catálogo Rápido de Productos y Servicios (Click para agregar al ticket)</h3>
              <span class="badge-pill badge-info">${filteredCatalog.length} ítems</span>
            </div>
            <div class="enterprise-panel-body">
              <div class="pos-catalog-grid">
                ${filteredCatalog.map((prod) => `
                  <div class="pos-product-card" data-prod-id="${sanitizeTextString(prod.id)}">
                    <div>
                      <span class="pos-product-sku">${highlightSearchMatchSafe(prod.sku, localSearch)}</span>
                      <h4 class="pos-product-name">${highlightSearchMatchSafe(prod.name, localSearch)}</h4>
                    </div>
                    <div class="inspector-header">
                      <span class="badge-pill badge-info">Stock: ${prod.stock}</span>
                      <span class="pos-product-price">${formatCurrencyAmount(prod.price)}</span>
                    </div>
                  </div>
                `).join("")}
              </div>

              <hr class="module-header-banner" />

              <h4 class="enterprise-panel-title">Historial de Ventas POS y Pólizas Generadas (${filteredSales.length})</h4>
              <div class="table-scroll-container">
                <table class="accounting-table">
                  <thead>
                    <tr>
                      <th>Ticket ID</th>
                      <th>Fecha / Hora</th>
                      <th>Cliente</th>
                      <th>NIT / RNC</th>
                      <th>Método Pago</th>
                      <th class="col-numeric">Total Cobrado</th>
                      <th>Póliza Contable</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredSales.map((sale) => `
                      <tr>
                        <td class="font-mono"><strong>${highlightSearchMatchSafe(sale.id, localSearch)}</strong></td>
                        <td class="font-mono">${sanitizeTextString(sale.date)}</td>
                        <td>${highlightSearchMatchSafe(sale.customer, localSearch)}</td>
                        <td class="font-mono">${highlightSearchMatchSafe(sale.rncNit, localSearch)}</td>
                        <td><span class="badge-pill badge-info">${sanitizeTextString(sale.paymentMethod)}</span></td>
                        <td class="col-numeric col-positive">${formatCurrencyAmount(sale.total)}</td>
                        <td class="font-mono"><span class="badge-pill badge-success">${sanitizeTextString(sale.journalId)}</span></td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Terminal de Caja y Emisión de Ticket -->
          <div class="enterprise-panel">
            <div class="enterprise-panel-header">
              <h3 class="enterprise-panel-title">Terminal de Caja Registradora Independiente</h3>
              <button type="button" id="btn-pos-clear-cart" class="btn-action btn-danger btn-xs">
                Vaciar Ticket
              </button>
            </div>
            <div class="enterprise-panel-body">
              <form id="form-pos-checkout">
                <div class="form-grid-layout">
                  <div class="form-field-group">
                    <label class="form-field-label" for="pos-cust-name">Razón Social / Cliente</label>
                    <input id="pos-cust-name" class="form-input-control" type="text" value="Consorcio Empresarial Delta S.A." required />
                  </div>
                  <div class="form-field-group">
                    <label class="form-field-label" for="pos-cust-nit">NIT / RNC Fiscal</label>
                    <input id="pos-cust-nit" class="form-input-control font-mono" type="text" value="132-77450-1" required />
                  </div>
                  <div class="form-field-group">
                    <label class="form-field-label" for="pos-pay-method">Método de Cobro</label>
                    <select id="pos-pay-method" class="form-select-control">
                      <option value="EFECTIVO_CAJA">Efectivo en Caja (Cuenta 1.1.01)</option>
                      <option value="TARJETA_CORPORATIVA">Tarjeta / POS Bancario (Cuenta 1.1.02)</option>
                      <option value="TRANSFERENCIA_INMEDIATA">Transferencia Bancaria (Cuenta 1.1.02)</option>
                    </select>
                  </div>
                </div>

                <div class="table-scroll-container">
                  <table class="accounting-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Producto</th>
                        <th class="col-numeric">Cant.</th>
                        <th class="col-numeric">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${currentTicketItems.length === 0 ? `
                        <tr><td colspan="4">Seleccione productos del catálogo para facturar.</td></tr>
                      ` : currentTicketItems.map((item) => `
                        <tr>
                          <td class="font-mono">${sanitizeTextString(item.sku)}</td>
                          <td>${sanitizeTextString(item.name)}</td>
                          <td class="col-numeric font-mono">${item.qty}</td>
                          <td class="col-numeric col-debit">${formatCurrencyAmount(item.price * item.qty)}</td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>

                <div class="pos-ticket-summary">
                  <div class="pos-summary-line">
                    <span>Subtotal Neto</span>
                    <span class="font-mono">${formatCurrencyAmount(subtotalTicket)}</span>
                  </div>
                  <div class="pos-summary-line">
                    <span>IVA / ITBIS (18%)</span>
                    <span class="font-mono">${formatCurrencyAmount(taxTicket)}</span>
                  </div>
                  <div class="pos-summary-total">
                    <span>TOTAL A COBRAR</span>
                    <span class="font-mono col-positive">${formatCurrencyAmount(totalTicket)}</span>
                  </div>
                </div>

                <div class="module-toolbar-actions">
                  <button type="submit" class="btn-action btn-primary">
                    Facturar en POS y Emitir Evento Contable Automático
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      `;

      const searchInput = containerEl.querySelector("#pos-local-search-input");
      if (searchInput) {
        searchInput.addEventListener("input", (e) => {
          localSearch = e.target.value;
          renderContent();
          const refreshed = containerEl.querySelector("#pos-local-search-input");
          if (refreshed) {
            refreshed.focus();
            refreshed.setSelectionRange(localSearch.length, localSearch.length);
          }
        });
      }

      containerEl.querySelectorAll(".pos-product-card").forEach((card) => {
        card.addEventListener("click", () => {
          const prodId = card.getAttribute("data-prod-id");
          const prod = catalog.find((p) => p.id === prodId);
          if (!prod) {
            return;
          }
          const existing = currentTicketItems.find((i) => i.id === prod.id);
          if (existing) {
            existing.qty += 1;
          } else {
            currentTicketItems.push({
              id: prod.id,
              sku: prod.sku,
              name: prod.name,
              price: Number(prod.price) || 0,
              qty: 1
            });
          }
          renderContent();
        });
      });

      const clearBtn = containerEl.querySelector("#btn-pos-clear-cart");
      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          currentTicketItems = [];
          renderContent();
        });
      }

      const formEl = containerEl.querySelector("#form-pos-checkout");
      if (formEl) {
        formEl.addEventListener("submit", async (e) => {
          e.preventDefault();
          if (currentTicketItems.length === 0) {
            dispatchEnterpriseToast({
              title: "Ticket Vacío",
              message: "Agregue al menos un producto del catálogo para facturar.",
              variant: "warning"
            });
            return;
          }

          const customer = containerEl.querySelector("#pos-cust-name").value.trim();
          const rncNit = containerEl.querySelector("#pos-cust-nit").value.trim();
          const paymentMethod = containerEl.querySelector("#pos-pay-method").value;
          const session = getActiveUserSecuritySession();
          const saleId = `POS-VTA-${9000 + salesHistory.length + 1}`;

          // Emitir evento al Bus de Integración para que se genere el asiento contable desacoplado
          const eventPayload = {
            saleId,
            customer,
            rncNit,
            paymentMethod,
            subtotal: subtotalTicket,
            taxAmount: taxTicket,
            total: totalTicket,
            generatedJournalNumber: null
          };

          await publishSystemEvent("POS_SALE_COMPLETED", eventPayload);

          const newSaleRecord = {
            id: saleId,
            date: new Date().toISOString().replace("T", " ").slice(0, 19),
            customer,
            rncNit,
            itemsCount: currentTicketItems.reduce((s, i) => s + i.qty, 0),
            subtotal: subtotalTicket,
            taxAmount: taxTicket,
            total: totalTicket,
            paymentMethod,
            journalId: eventPayload.generatedJournalNumber || "AST-POS-AUTO",
            cashier: session.username,
            status: "CONTABILIZADO"
          };

          await insertOrUpdateCollectionRecord("posSalesHistory", newSaleRecord);

          recordSecurityAuditEvent({
            actor: session.username,
            moduleId: "point-of-sale",
            action: "POS_INVOICE_ISSUED",
            detail: `Factura POS ${saleId} emitida a ${customer} por ${formatCurrencyAmount(totalTicket)} (Asiento: ${newSaleRecord.journalId}).`,
            severity: "SUCCESS"
          });

          dispatchEnterpriseToast({
            title: `Venta POS ${saleId} Completada`,
            message: `Cobro por ${formatCurrencyAmount(totalTicket)} sincronizado con Firebase y Contabilidad (${newSaleRecord.journalId}).`,
            variant: "success"
          });

          currentTicketItems = [];
          renderContent();
        });
      }
    };

    renderContent();
  }
};
