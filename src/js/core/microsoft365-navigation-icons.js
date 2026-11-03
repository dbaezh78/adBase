/**
 * Catálogo de Iconos Vectoriales Estilo Microsoft 365 Admin Center (Fluent Line Icons).
 * Provee el icono de contracción de 3 líneas (Imagen 1 y 2) y los iconos de cada módulo
 * y sub-módulo para visualización expandida y contraída (solo iconos).
 */

export const M365_HAMBURGER_TOGGLE_SVG = `
  <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
    <line x1="3" y1="5" x2="17" y2="5"></line>
    <line x1="3" y1="10" x2="17" y2="10"></line>
    <line x1="3" y1="15" x2="17" y2="15"></line>
  </svg>
`;

export const M365_CHEVRON_DOWN_SVG = `
  <svg class="m365-chevron-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="4 6 8 10 12 6"></polyline>
  </svg>
`;

const MODULE_FLUENT_ICONS_MAP = {
  // Módulos Principales (Barra Lateral Izquierda)
  settings: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l2.1-2.1a5 5 0 0 1-6.4 6.4l-5.6 5.6a1.8 1.8 0 0 1-2.5-2.5l5.6-5.6a5 5 0 0 1 6.4-6.4l-2.6 1.6z"></path>
    </svg>
  `,
  security: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 2L3.5 4.8v4.7c0 4.5 2.8 8.3 6.5 9.5 3.7-1.2 6.5-5 6.5-9.5V4.8L10 2z"></path>
      <rect x="7.8" y="9.2" width="4.4" height="3.6" rx="0.8"></rect>
      <path d="M8.6 9.2V7.8a1.4 1.4 0 0 1 2.8 0v1.4"></path>
    </svg>
  `,
  "users-windows": `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="6.2" r="3.2"></circle>
      <path d="M4.2 16.8c0-2.9 2.6-5 5.8-5s5.8 2.1 5.8 5"></path>
    </svg>
  `,
  "chart-of-accounts": `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="6" height="6" rx="1"></rect>
      <rect x="11" y="3" width="6" height="6" rx="1"></rect>
      <rect x="3" y="11" width="6" height="6" rx="1"></rect>
      <rect x="11" y="11" width="6" height="6" rx="1"></rect>
    </svg>
  `,
  "journal-entries": `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13.8 3.2l3 3-9.6 9.6H4.2v-3l9.6-9.6z"></path>
      <line x1="11.8" y1="5.2" x2="14.8" y2="8.2"></line>
    </svg>
  `,
  "official-books": `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3.5" y="3" width="13" height="14" rx="1.5"></rect>
      <line x1="7" y1="7" x2="13" y2="7"></line>
      <line x1="7" y1="10" x2="13" y2="10"></line>
      <line x1="7" y1="13" x2="11" y2="13"></line>
    </svg>
  `,
  "bank-reconciliation": `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.6"></rect>
      <line x1="2.5" y1="8.2" x2="17.5" y2="8.2"></line>
      <line x1="12.5" y1="12.5" x2="15" y2="12.5"></line>
    </svg>
  `,
  "period-closing": `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4.2" width="14" height="12.8" rx="1.6"></rect>
      <line x1="6.5" y1="2.5" x2="6.5" y2="5.5"></line>
      <line x1="13.5" y1="2.5" x2="13.5" y2="5.5"></line>
      <line x1="3" y1="8" x2="17" y2="8"></line>
      <polyline points="7.5 12.2 9.4 14 12.8 10.5"></polyline>
    </svg>
  `,
  "financial-statements": `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3.5 4 3.5 16.5 16.5 16.5"></polyline>
      <polyline points="6 13 9.2 9.2 12.2 11.4 16 6.5"></polyline>
    </svg>
  `,
  "point-of-sale": `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3.5" width="14" height="9.5" rx="1.2"></rect>
      <line x1="7" y1="16.5" x2="13" y2="16.5"></line>
      <line x1="10" y1="13" x2="10" y2="16.5"></line>
    </svg>
  `,
  payroll: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="7.5" cy="6.5" r="2.5"></circle>
      <circle cx="13.5" cy="7" r="2"></circle>
      <path d="M2.8 15.8c0-2.3 2.1-4 4.7-4s4.7 1.7 4.7 4"></path>
      <path d="M12.5 15.8c0-1.7 1.4-3.1 3.5-3.1 1.2 0 2.2.5 2.8 1.4"></path>
    </svg>
  `,
  "module-integration": `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6.5 6.5 3 10 6.5 13.5"></polyline>
      <polyline points="13.5 6.5 17 10 13.5 13.5"></polyline>
      <line x1="11.2" y1="4.5" x2="8.8" y2="15.5"></line>
    </svg>
  `,
  reports: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="5" y1="16" x2="5" y2="10"></line>
      <line x1="10" y1="16" x2="10" y2="5"></line>
      <line x1="15" y1="16" x2="15" y2="8"></line>
    </svg>
  `,
  "sobre-about": `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="10 2.5 17.5 10 10 17.5 2.5 10 10 2.5"></polygon>
      <circle cx="10" cy="10" r="2.2"></circle>
    </svg>
  `,

  // Sub-items de Configuración y Empresas (Cinta Vertical CFG01)
  LDAP: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3.5" width="14" height="5" rx="1"></rect>
      <rect x="3" y="11.5" width="14" height="5" rx="1"></rect>
      <circle cx="6" cy="6" r="0.8"></circle>
      <circle cx="6" cy="14" r="0.8"></circle>
    </svg>
  `,
  RADIUS: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 2.5L4 5.2v4.5c0 4.2 2.6 7.8 6 9 3.4-1.2 6-4.8 6-9V5.2L10 2.5z"></path>
      <polyline points="7.5 10.2 9.2 12 12.8 8.2"></polyline>
    </svg>
  `,
  TRAER_USUARIO: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="8" cy="6.5" r="2.8"></circle>
      <path d="M3 16c0-2.5 2.2-4.3 5-4.3"></path>
      <line x1="14.5" y1="10" x2="14.5" y2="16.5"></line>
      <polyline points="12 14 14.5 16.5 17 14"></polyline>
    </svg>
  `,
  LOCAL: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="8.5" cy="6.2" r="2.8"></circle>
      <path d="M3.5 16.2c0-2.5 2.2-4.4 5-4.4"></path>
      <rect x="11.5" y="11" width="5.5" height="4.5" rx="0.8"></rect>
    </svg>
  `,
  OAUTH_CORREO: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5"></rect>
      <polyline points="3 5.2 10 10.8 17 5.2"></polyline>
    </svg>
  `,
  SERVICIO_WINDOWS: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3.5" width="14" height="4.5" rx="1"></rect>
      <rect x="3" y="11" width="14" height="4.5" rx="1"></rect>
      <line x1="6" y1="5.7" x2="6.1" y2="5.7"></line>
      <line x1="6" y1="13.2" x2="6.1" y2="13.2"></line>
      <circle cx="14" cy="5.7" r="0.7"></circle>
      <circle cx="14" cy="13.2" r="0.7"></circle>
    </svg>
  `,
  ASIGNAR_USUARIO: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="8" cy="6" r="2.6"></circle>
      <path d="M3.2 15.8c0-2.4 2.1-4.2 4.8-4.2"></path>
      <polyline points="11.8 13.2 13.6 15 17.2 11.2"></polyline>
    </svg>
  `,
  DEPARTAMENTOS_GRUPOS: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="7" cy="6.5" r="2.3"></circle>
      <circle cx="13.5" cy="6.5" r="2.3"></circle>
      <path d="M2.8 15.5c0-2.1 1.9-3.7 4.2-3.7s4.2 1.6 4.2 3.7"></path>
      <path d="M11.5 15.5c.3-1.8 1.8-3.2 3.8-3.2 1.2 0 2.2.6 2.7 1.6"></path>
    </svg>
  `,
  MATRIZ_PERMISOS: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="14" height="14" rx="1.6"></rect>
      <line x1="3" y1="8" x2="17" y2="8"></line>
      <line x1="8" y1="3" x2="8" y2="17"></line>
    </svg>
  `,
  TEMAS_SISTEMA: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="10" r="4"></circle>
      <line x1="10" y1="2.5" x2="10" y2="4.2"></line>
      <line x1="10" y1="15.8" x2="10" y2="17.5"></line>
      <line x1="2.5" y1="10" x2="4.2" y2="10"></line>
      <line x1="15.8" y1="10" x2="17.5" y2="10"></line>
    </svg>
  `,
  PERFIL_COLORES: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 2.8a7.2 7.2 0 1 0 0 14.4c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.3-.3-.3-.4-.7-.4-1.1 0-1 .8-1.8 1.8-1.8h1.4A4.3 4.3 0 0 0 17.2 7c0-2.4-3.2-4.2-7.2-4.2z"></path>
      <circle cx="6.8" cy="8.2" r="0.8"></circle>
      <circle cx="9.6" cy="6.4" r="0.8"></circle>
      <circle cx="12.6" cy="7.8" r="0.8"></circle>
    </svg>
  `,
  SAP800: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 8.5L10 3l7 5.5v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8z"></path>
      <polyline points="7.5 17.5 7.5 11.5 12.5 11.5 12.5 17.5"></polyline>
    </svg>
  `,
  CREAR_EMPRESA: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3.5" y="3.5" width="9.5" height="13.5" rx="1"></rect>
      <line x1="6.5" y1="7" x2="10" y2="7"></line>
      <line x1="6.5" y1="10" x2="10" y2="10"></line>
      <line x1="15.5" y1="10" x2="15.5" y2="16"></line>
      <line x1="12.5" y1="13" x2="18.5" y2="13"></line>
    </svg>
  `,
  SOBRE_ABOUT: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="10 2.5 17.5 10 10 17.5 2.5 10 10 2.5"></polygon>
      <circle cx="10" cy="10" r="2.2"></circle>
    </svg>
  `,
  OPCIONES_SISTEMA: `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="10" r="3"></circle>
      <path d="M16.2 12.2a1.3 1.3 0 0 0 .3 1.4l.1.1a1.5 1.5 0 0 1-2.1 2.1l-.1-.1a1.3 1.3 0 0 0-1.4-.3 1.3 1.3 0 0 0-.8 1.2v.2a1.5 1.5 0 0 1-3 0v-.2a1.3 1.3 0 0 0-.8-1.2 1.3 1.3 0 0 0-1.4.3l-.1.1a1.5 1.5 0 0 1-2.1-2.1l.1-.1a1.3 1.3 0 0 0 .3-1.4 1.3 1.3 0 0 0-1.2-.8h-.2a1.5 1.5 0 0 1 0-3h.2a1.3 1.3 0 0 0 1.2-.8 1.3 1.3 0 0 0-.3-1.4l-.1-.1a1.5 1.5 0 0 1 2.1-2.1l.1.1a1.3 1.3 0 0 0 1.4.3 1.3 1.3 0 0 0 .8-1.2v-.2a1.5 1.5 0 0 1 3 0v.2a1.3 1.3 0 0 0 .8 1.2 1.3 1.3 0 0 0 1.4-.3l.1-.1a1.5 1.5 0 0 1 2.1 2.1l-.1.1a1.3 1.3 0 0 0-.3 1.4 1.3 1.3 0 0 0 1.2.8h.2a1.5 1.5 0 0 1 0 3h-.2a1.3 1.3 0 0 0-1.2.8z"></path>
    </svg>
  `,
  "opciones-sistema": `
    <svg class="m365-nav-svg-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="10" cy="10" r="3"></circle>
      <path d="M16.2 12.2a1.3 1.3 0 0 0 .3 1.4l.1.1a1.5 1.5 0 0 1-2.1 2.1l-.1-.1a1.3 1.3 0 0 0-1.4-.3 1.3 1.3 0 0 0-.8 1.2v.2a1.5 1.5 0 0 1-3 0v-.2a1.3 1.3 0 0 0-.8-1.2 1.3 1.3 0 0 0-1.4.3l-.1.1a1.5 1.5 0 0 1-2.1-2.1l.1-.1a1.3 1.3 0 0 0 .3-1.4 1.3 1.3 0 0 0-1.2-.8h-.2a1.5 1.5 0 0 1 0-3h.2a1.3 1.3 0 0 0 1.2-.8 1.3 1.3 0 0 0-.3-1.4l-.1-.1a1.5 1.5 0 0 1 2.1-2.1l.1.1a1.3 1.3 0 0 0 1.4.3 1.3 1.3 0 0 0 .8-1.2v-.2a1.5 1.5 0 0 1 3 0v.2a1.3 1.3 0 0 0 .8 1.2 1.3 1.3 0 0 0 1.4-.3l.1-.1a1.5 1.5 0 0 1 2.1 2.1l-.1.1a1.3 1.3 0 0 0-.3 1.4 1.3 1.3 0 0 0 1.2.8h.2a1.5 1.5 0 0 1 0 3h-.2a1.3 1.3 0 0 0-1.2.8z"></path>
    </svg>
  `
};

export function getMicrosoft365NavIconSvg(key) {
  return MODULE_FLUENT_ICONS_MAP[key] || MODULE_FLUENT_ICONS_MAP["chart-of-accounts"];
}
