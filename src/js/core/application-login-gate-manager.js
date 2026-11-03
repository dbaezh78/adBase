/**
 * Administrador de la Pantalla de Login / Control de Entrada Web de la Plataforma.
 * Bloquea la visualización del ERP hasta que un usuario se autentique con su cuenta
 * de dominio (Active Directory / RADIUS), contraseña local de respaldo o código de 16 caracteres.
 */

import {
  getActiveAuthSession,
  authenticateUserCredentials,
  clearActiveAuthSession
} from "../security/user-authentication-login-service.js";
import { getCollectionRecords, getActiveCompanyRecord } from "../database/database-provider-adapter.js";
import { sanitizeTextString } from "../validators/security-input-sanitizer.js";
import { dispatchEnterpriseToast } from "./ui-notification-dispatcher.js";

export const LoginGateManager = {
  gateContainerEl: null,
  activeLoginTab: "PASSWORD", // "PASSWORD" | "CODE16"

  init(onAuthenticatedCallback) {
    this.gateContainerEl = document.getElementById("erp-login-auth-gate");
    if (!this.gateContainerEl) {
      this.gateContainerEl = document.createElement("div");
      this.gateContainerEl.id = "erp-login-auth-gate";
      this.gateContainerEl.className = "erp-login-auth-gate";
      document.body.appendChild(this.gateContainerEl);
    }

    const currentSession = getActiveAuthSession();
    if (currentSession) {
      this.hide();
      if (typeof onAuthenticatedCallback === "function") {
        onAuthenticatedCallback(currentSession);
      }
      return;
    }

    this.render(onAuthenticatedCallback);
    this.show();
  },

  show() {
    if (this.gateContainerEl) {
      this.gateContainerEl.classList.remove("is-hidden");
      document.body.classList.add("is-gated-by-login");
    }
  },

  hide() {
    if (this.gateContainerEl) {
      this.gateContainerEl.classList.add("is-hidden");
      document.body.classList.remove("is-gated-by-login");
    }
  },

  logout(onLogoutCallback) {
    clearActiveAuthSession();
    this.show();
    this.render(onLogoutCallback);
    dispatchEnterpriseToast({
      title: "Sesión Finalizada",
      message: "Ha cerrado sesión de forma segura.",
      variant: "info"
    });
  },

  render(onAuthenticatedCallback) {
    const allCompanies = getCollectionRecords("companies");
    const activeCompany = getActiveCompanyRecord() || allCompanies[0];
    const defaultLogo = "./src/img/logos/easy-data-accounting-brand-logo.jpg";

    this.gateContainerEl.innerHTML = `
      <div class="login-gate-backdrop">
        <div class="login-gate-card" role="dialog" aria-labelledby="login-card-title">
          <div class="login-gate-brand-hero">
            <img
              src="${defaultLogo}"
              alt="Logo Contabilidad dBase"
              class="login-brand-logo"
            />
            <div class="login-brand-text-group">
              <h1 id="login-card-title" class="login-brand-title">Contabilidad dBase</h1>
              <span class="login-brand-subtitle">Accounting dBase — Base de datos para Contabilidad</span>
            </div>
            <div class="login-shield-badge">Control de Acceso Web &amp; Dominio</div>
          </div>

          <div class="login-gate-tabs">
            <button
              type="button"
              class="login-tab-btn ${this.activeLoginTab === "PASSWORD" ? "is-active" : ""}"
              id="btn-tab-login-password"
            >
              Usuario &amp; Contraseña (AD / Local)
            </button>
            <button
              type="button"
              class="login-tab-btn ${this.activeLoginTab === "CODE16" ? "is-active" : ""}"
              id="btn-tab-login-code16"
            >
              Código de 16 Caracteres (OAuth)
            </button>
          </div>

          <form id="form-erp-auth-login" class="login-form-body">
            <!-- Selección de Empresa a la que ingresa -->
            <div class="login-form-row">
              <label class="login-field-label" for="login-company-select">Empresa a la que Desea Ingresar</label>
              <div class="login-company-picker-row">
                <img
                  id="login-company-thumb-preview"
                  src="${sanitizeTextString(activeCompany?.logoUrl || defaultLogo)}"
                  alt="Logo Empresa"
                  class="login-company-thumb"
                />
                <select id="login-company-select" class="login-select-control">
                  ${allCompanies.map((c) => `
                    <option value="${sanitizeTextString(c.id)}" ${c.id === activeCompany?.id ? "selected" : ""}>
                      ${sanitizeTextString(c.nombreComercial)} (${sanitizeTextString(c.rnc)})
                    </option>
                  `).join("")}
                </select>
              </div>
            </div>

            <!-- Usuario o Correo Electrónico -->
            <div class="login-form-row">
              <label class="login-field-label" for="login-username-input">
                ${this.activeLoginTab === "PASSWORD" ? "Usuario de Dominio o Correo *" : "Correo Electrónico *"}
              </label>
              <input
                id="login-username-input"
                type="text"
                class="login-input-control font-mono"
                placeholder="${this.activeLoginTab === "PASSWORD" ? "ej. laantillana\\dbaezh o dbaezh@laantillana.com" : "ej. dbaezh@laantillana.com"}"
                value="laantillana\\dbaezh"
                required
                autocomplete="username"
              />
            </div>

            ${this.activeLoginTab === "PASSWORD" ? `
              <!-- Contraseña de Dominio o Respaldo Local -->
              <div class="login-form-row">
                <div class="login-label-with-hint">
                  <label class="login-field-label" for="login-password-input">Contraseña (AD / Respaldo Local) *</label>
                  <span class="login-hint-text">Funciona con dominio o respaldo local</span>
                </div>
                <div class="login-password-wrapper">
                  <input
                    id="login-password-input"
                    type="password"
                    class="login-input-control"
                    placeholder="Contraseña de Windows AD o Contraseña Local"
                    value="laantillana2026*"
                    required
                    autocomplete="current-password"
                  />
                  <button type="button" id="btn-toggle-login-pass" class="btn-login-peek-pass" title="Ver contraseña">
                    👁
                  </button>
                </div>
              </div>
            ` : `
              <!-- Código de 16 Caracteres -->
              <div class="login-form-row">
                <label class="login-field-label" for="login-code16-input">Código de Acceso de 16 Caracteres *</label>
                <input
                  id="login-code16-input"
                  type="text"
                  maxlength="16"
                  class="login-input-control font-mono"
                  placeholder="ej. K9M4P8X2W7R5Q3N6"
                  value="K9M4P8X2W7R5Q3N6"
                  required
                />
              </div>
            `}

            <div class="login-options-row">
              <label class="login-checkbox-label">
                <input type="checkbox" id="login-remember-me" checked />
                <span>Recordar sesión en este equipo</span>
              </label>
            </div>

            <div id="login-feedback-alert" class="login-feedback-banner is-hidden" role="alert"></div>

            <button type="submit" id="btn-submit-login" class="btn-login-submit">
              <span id="login-submit-label">Ingresar a Contabilidad dBase</span>
              <span id="login-submit-spinner" class="login-spinner is-hidden"></span>
            </button>
          </form>

          <div class="login-gate-footer">
            <span class="login-footer-lock">🔒 Seguridad Activa</span>
            <span>Acceso integrado con Active Directory, RADIUS NPS y Respaldo Local de contingencia.</span>
          </div>
        </div>
      </div>
    `;

    // Eventos
    const compSelect = this.gateContainerEl.querySelector("#login-company-select");
    const compThumb = this.gateContainerEl.querySelector("#login-company-thumb-preview");
    if (compSelect && compThumb) {
      compSelect.addEventListener("change", (e) => {
        const found = allCompanies.find((c) => c.id === e.target.value);
        compThumb.src = found?.logoUrl || defaultLogo;
      });
    }

    this.gateContainerEl.querySelector("#btn-tab-login-password")?.addEventListener("click", () => {
      this.activeLoginTab = "PASSWORD";
      this.render(onAuthenticatedCallback);
    });

    this.gateContainerEl.querySelector("#btn-tab-login-code16")?.addEventListener("click", () => {
      this.activeLoginTab = "CODE16";
      this.render(onAuthenticatedCallback);
    });

    const passInput = this.gateContainerEl.querySelector("#login-password-input");
    const togglePassBtn = this.gateContainerEl.querySelector("#btn-toggle-login-pass");
    if (passInput && togglePassBtn) {
      togglePassBtn.addEventListener("click", () => {
        passInput.type = passInput.type === "password" ? "text" : "password";
      });
    }

    const form = this.gateContainerEl.querySelector("#form-erp-auth-login");
    const alertBox = this.gateContainerEl.querySelector("#login-feedback-alert");
    const submitBtn = this.gateContainerEl.querySelector("#btn-submit-login");
    const submitLabel = this.gateContainerEl.querySelector("#login-submit-label");
    const submitSpinner = this.gateContainerEl.querySelector("#login-submit-spinner");

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const companyId = compSelect?.value;
        const usernameOrEmail = this.gateContainerEl.querySelector("#login-username-input")?.value;
        const password = passInput?.value;
        const code16 = this.gateContainerEl.querySelector("#login-code16-input")?.value;
        const rememberMe = Boolean(this.gateContainerEl.querySelector("#login-remember-me")?.checked);

        if (submitBtn) {
          submitBtn.disabled = true;
        }
        if (submitLabel) {
          submitLabel.textContent = "Verificando credenciales...";
        }
        if (submitSpinner) {
          submitSpinner.classList.remove("is-hidden");
        }
        if (alertBox) {
          alertBox.className = "login-feedback-banner is-hidden";
        }

        try {
          const authResult = await authenticateUserCredentials({
            usernameOrEmail,
            password,
            companyId,
            code16: this.activeLoginTab === "CODE16" ? code16 : null,
            rememberMe
          });

          if (authResult.success) {
            if (alertBox) {
              alertBox.className = "login-feedback-banner is-success";
              alertBox.textContent = authResult.detail;
            }
            dispatchEnterpriseToast({
              title: authResult.statusText || "Bienvenido",
              message: authResult.detail,
              variant: "success"
            });

            setTimeout(() => {
              this.hide();
              if (typeof onAuthenticatedCallback === "function") {
                onAuthenticatedCallback(authResult.session);
              }
            }, 600);
          } else {
            if (alertBox) {
              alertBox.className = "login-feedback-banner is-danger";
              alertBox.textContent = `${authResult.statusText}: ${authResult.detail}`;
            }
            if (submitBtn) {
              submitBtn.disabled = false;
            }
            if (submitLabel) {
              submitLabel.textContent = "Ingresar a Contabilidad dBase";
            }
            if (submitSpinner) {
              submitSpinner.classList.add("is-hidden");
            }
          }
        } catch (err) {
          if (alertBox) {
            alertBox.className = "login-feedback-banner is-danger";
            alertBox.textContent = `Error de autenticación: ${err.message}`;
          }
          if (submitBtn) {
            submitBtn.disabled = false;
          }
          if (submitLabel) {
            submitLabel.textContent = "Ingresar a Contabilidad dBase";
          }
          if (submitSpinner) {
            submitSpinner.classList.add("is-hidden");
          }
        }
      });
    }
  }
};
