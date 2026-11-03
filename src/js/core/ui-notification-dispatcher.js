/**
 * Despachador independiente de notificaciones visuales (Toasts) del sistema ERP.
 */

import { sanitizeTextString } from "../validators/security-input-sanitizer.js";

export function dispatchEnterpriseToast({ title, message, variant = "info", durationMs = 4200 }) {
  const container = document.getElementById("erp-global-toast-container");
  if (!container) {
    return;
  }

  const toastEl = document.createElement("div");
  const variantClass = variant === "success"
    ? "toast-success"
    : variant === "danger"
      ? "toast-danger"
      : variant === "warning"
        ? "toast-warning"
        : "";

  toastEl.className = `erp-toast-card ${variantClass}`.trim();
  toastEl.innerHTML = `
    <span class="erp-toast-title">${sanitizeTextString(title)}</span>
    <span class="erp-toast-message">${sanitizeTextString(message)}</span>
  `;

  container.appendChild(toastEl);

  setTimeout(() => {
    if (toastEl.parentNode) {
      toastEl.parentNode.removeChild(toastEl);
    }
  }, durationMs);
}
