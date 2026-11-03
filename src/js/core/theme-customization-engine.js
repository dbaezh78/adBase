/**
 * Motor Independiente de Personalización de Temas Corporativos y Perfiles de Colores.
 * - Soporta Modo Oscuro, Modo Claro, Tema Azul y temas generados por nombre.
 * - Soporta creación de Perfiles de Colores 100% personalizados por el usuario para toda la plataforma.
 * - Utiliza CSSOM Constructable Stylesheets (document.adoptedStyleSheets) para aplicar colores
 *   en 0ms manteniendo CERO etiquetas <style> y CERO atributos style="" inline en el HTML.
 */

import {
  getCollectionRecords,
  insertOrUpdateCollectionRecord
} from "../database/database-provider-adapter.js";

const ACTIVE_THEME_STORAGE_KEY = "EDA_ACTIVE_THEME_PALETTE_V6";
const ACTIVE_THEME_NAME_KEY = "EDA_ACTIVE_THEME_NAME_V6";
const CUSTOM_COLOR_PROFILES_STORAGE_KEY = "EDA_CUSTOM_COLOR_PROFILES_V6";
const ACTIVE_CUSTOM_COLORS_KEY = "EDA_ACTIVE_CUSTOM_COLORS_JSON_V6";

export const PRESET_PALETTE_DEFINITIONS = {
  "palette-oscuro": {
    key: "palette-oscuro",
    label: "Modo Oscuro Enterprise (Original)",
    description: "Tema oscuro de alto contraste financiero (por defecto).",
    colors: {
      bgPrimary: "#0b1120",
      bgSecondary: "#111827",
      bgSurface: "#1e293b",
      bgSurfaceElevated: "#26334d",
      bgSurfaceHover: "#334155",
      textPrimary: "#f8fafc",
      textSecondary: "#cbd5e1",
      textMuted: "#94a3b8",
      textInverse: "#0f172a",
      brandPrimary: "#38bdf8",
      brandSecondary: "#6366f1",
      brandAccent: "#0ea5e9",
      borderSubtle: "#1e293b",
      borderDefault: "#334155",
      borderStrong: "#475569",
      successColor: "#10b981"
    }
  },
  "palette-claro": {
    key: "palette-claro",
    label: "Modo Claro Luminoso Corporativo",
    description: "Tema claro ejecutivo de alto contraste para oficinas iluminadas.",
    colors: {
      bgPrimary: "#f1f5f9",
      bgSecondary: "#ffffff",
      bgSurface: "#f8fafc",
      bgSurfaceElevated: "#e2e8f0",
      bgSurfaceHover: "#cbd5e1",
      textPrimary: "#0f172a",
      textSecondary: "#334155",
      textMuted: "#64748b",
      textInverse: "#ffffff",
      brandPrimary: "#0284c7",
      brandSecondary: "#4f46e5",
      brandAccent: "#0369a1",
      borderSubtle: "#e2e8f0",
      borderDefault: "#cbd5e1",
      borderStrong: "#94a3b8",
      successColor: "#059669"
    }
  },
  "palette-azul": {
    key: "palette-azul",
    label: "Tema Azul Profundo (SAP Horizon)",
    description: "Tema azul corporativo inspirado en SAP Logon 800 y Fiori Horizon.",
    colors: {
      bgPrimary: "#0c192c",
      bgSecondary: "#132642",
      bgSurface: "#1b355a",
      bgSurfaceElevated: "#234472",
      bgSurfaceHover: "#2d558e",
      textPrimary: "#f0f7ff",
      textSecondary: "#bfd9f5",
      textMuted: "#8ab4e1",
      textInverse: "#081221",
      brandPrimary: "#3b9eff",
      brandSecondary: "#1d70db",
      brandAccent: "#0070f2",
      borderSubtle: "#1a3356",
      borderDefault: "#294c7a",
      borderStrong: "#3c6aa6",
      successColor: "#10b981"
    }
  },
  "palette-antillana": {
    key: "palette-antillana",
    label: "Turquesa Oceánico (La Antillana)",
    description: "Paleta institucional oceánica con acentos cian y turquesa.",
    colors: {
      bgPrimary: "#071c24",
      bgSecondary: "#0d2b36",
      bgSurface: "#143d4d",
      bgSurfaceElevated: "#1b5064",
      bgSurfaceHover: "#23647d",
      textPrimary: "#ecfeff",
      textSecondary: "#a5f3fc",
      textMuted: "#67e8f9",
      textInverse: "#041318",
      brandPrimary: "#06b6d4",
      brandSecondary: "#0ea5e9",
      brandAccent: "#14b8a6",
      borderSubtle: "#164e63",
      borderDefault: "#155e75",
      borderStrong: "#0891b2",
      successColor: "#10b981"
    }
  },
  "palette-esmeralda": {
    key: "palette-esmeralda",
    label: "Esmeralda Bóveda Financiera",
    description: "Paleta bancaria en tonos verde esmeralda y pizarra.",
    colors: {
      bgPrimary: "#071a14",
      bgSecondary: "#0c2920",
      bgSurface: "#133b2f",
      bgSurfaceElevated: "#1b4f3f",
      bgSurfaceHover: "#236350",
      textPrimary: "#ecfdf5",
      textSecondary: "#a7f3d0",
      textMuted: "#6ee7b7",
      textInverse: "#051510",
      brandPrimary: "#10b981",
      brandSecondary: "#059669",
      brandAccent: "#34d399",
      borderSubtle: "#144234",
      borderDefault: "#1d5c49",
      borderStrong: "#059669",
      successColor: "#34d399"
    }
  },
  "palette-oro": {
    key: "palette-oro",
    label: "Oro Imperial Ejecutivo",
    description: "Paleta de contraste cálido con acentos dorados.",
    colors: {
      bgPrimary: "#18130a",
      bgSecondary: "#241c0f",
      bgSurface: "#332815",
      bgSurfaceElevated: "#45361d",
      bgSurfaceHover: "#574425",
      textPrimary: "#fefce8",
      textSecondary: "#fde68a",
      textMuted: "#fcd34d",
      textInverse: "#18130a",
      brandPrimary: "#f59e0b",
      brandSecondary: "#d97706",
      brandAccent: "#fbbf24",
      borderSubtle: "#382c18",
      borderDefault: "#524022",
      borderStrong: "#785d32",
      successColor: "#10b981"
    }
  },
  "palette-amatista": {
    key: "palette-amatista",
    label: "Amatista Cyber Real",
    description: "Paleta moderna en tonos violeta profundo y amatista.",
    colors: {
      bgPrimary: "#150d24",
      bgSecondary: "#211538",
      bgSurface: "#2e1d4d",
      bgSurfaceElevated: "#3d2766",
      bgSurfaceHover: "#4c3180",
      textPrimary: "#faf5ff",
      textSecondary: "#e9d5ff",
      textMuted: "#c084fc",
      textInverse: "#150d24",
      brandPrimary: "#a855f7",
      brandSecondary: "#7e22ce",
      brandAccent: "#c084fc",
      borderSubtle: "#342056",
      borderDefault: "#4c2f7d",
      borderStrong: "#6b42b0",
      successColor: "#10b981"
    }
  },
  "palette-rubi": {
    key: "palette-rubi",
    label: "Rubí Auditoría Carmesí",
    description: "Paleta ejecutiva de alto impacto en tonos carmesí y rubí.",
    colors: {
      bgPrimary: "#1f0b10",
      bgSecondary: "#2e1118",
      bgSurface: "#421823",
      bgSurfaceElevated: "#57202e",
      bgSurfaceHover: "#6e283a",
      textPrimary: "#fff1f2",
      textSecondary: "#fecdd3",
      textMuted: "#fda4af",
      textInverse: "#1f0b10",
      brandPrimary: "#f43f5e",
      brandSecondary: "#e11d48",
      brandAccent: "#fb7185",
      borderSubtle: "#471a26",
      borderDefault: "#632435",
      borderStrong: "#883249",
      successColor: "#10b981"
    }
  },
  "palette-arena": {
    key: "palette-arena",
    label: "Arena Marfil Cálido (Claro)",
    description: "Tema claro cálido en tonos marfil y bronce para lectura prolongada.",
    colors: {
      bgPrimary: "#faf8f5",
      bgSecondary: "#ffffff",
      bgSurface: "#f3efe6",
      bgSurfaceElevated: "#e6dfd1",
      bgSurfaceHover: "#d6ccb8",
      textPrimary: "#1c1917",
      textSecondary: "#44403c",
      textMuted: "#78716c",
      textInverse: "#ffffff",
      brandPrimary: "#b45309",
      brandSecondary: "#92400e",
      brandAccent: "#d97706",
      borderSubtle: "#e7e2d8",
      borderDefault: "#d6cfc2",
      borderStrong: "#a8a29e",
      successColor: "#059669"
    }
  }
};

let dynamicColorStyleSheet = null;

function applyColorsViaConstructableStylesheet(colorsObj) {
  if (!colorsObj) {
    return;
  }

  try {
    if (!dynamicColorStyleSheet && typeof CSSStyleSheet !== "undefined") {
      dynamicColorStyleSheet = new CSSStyleSheet();
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, dynamicColorStyleSheet];
    }

    if (dynamicColorStyleSheet) {
      const cssRuleText = `
        :root, html[data-theme] {
          --color-bg-primary: ${colorsObj.bgPrimary || "#0b1120"} !important;
          --color-bg-secondary: ${colorsObj.bgSecondary || "#111827"} !important;
          --color-bg-surface: ${colorsObj.bgSurface || "#1e293b"} !important;
          --color-bg-surface-elevated: ${colorsObj.bgSurfaceElevated || colorsObj.bgSurface || "#26334d"} !important;
          --color-bg-surface-hover: ${colorsObj.bgSurfaceHover || colorsObj.borderDefault || "#334155"} !important;
          --color-text-primary: ${colorsObj.textPrimary || "#f8fafc"} !important;
          --color-text-secondary: ${colorsObj.textSecondary || "#cbd5e1"} !important;
          --color-text-muted: ${colorsObj.textMuted || colorsObj.textSecondary || "#94a3b8"} !important;
          --color-text-inverse: ${colorsObj.textInverse || "#0f172a"} !important;
          --color-brand-primary: ${colorsObj.brandPrimary || "#38bdf8"} !important;
          --color-brand-secondary: ${colorsObj.brandSecondary || "#6366f1"} !important;
          --color-brand-accent: ${colorsObj.brandAccent || colorsObj.brandPrimary || "#0ea5e9"} !important;
          --color-border-subtle: ${colorsObj.borderSubtle || colorsObj.bgSurface || "#1e293b"} !important;
          --color-border-default: ${colorsObj.borderDefault || "#334155"} !important;
          --color-border-strong: ${colorsObj.borderStrong || colorsObj.borderDefault || "#475569"} !important;
          --color-border-focus: ${colorsObj.brandPrimary || "#38bdf8"} !important;
          --color-success: ${colorsObj.successColor || "#10b981"} !important;
        }
      `;
      dynamicColorStyleSheet.replaceSync(cssRuleText);
    }
  } catch (_err) {
    // Fallback limpio
  }
}

export function derivePaletteFromThemeName(customName = "") {
  const normalized = String(customName || "").trim().toLowerCase();
  if (!normalized) {
    return "palette-oscuro";
  }

  if (normalized.includes("claro") || normalized.includes("blanco") || normalized.includes("luz") || normalized.includes("dia")) {
    return "palette-claro";
  }
  if (normalized.includes("arena") || normalized.includes("marfil") || normalized.includes("crema") || normalized.includes("beige")) {
    return "palette-arena";
  }
  if (normalized.includes("azul") || normalized.includes("sap") || normalized.includes("horizon") || normalized.includes("cobalto")) {
    return "palette-azul";
  }
  if (normalized.includes("antillana") || normalized.includes("oceano") || normalized.includes("turquesa") || normalized.includes("caribe") || normalized.includes("cian")) {
    return "palette-antillana";
  }
  if (normalized.includes("verde") || normalized.includes("esmeralda") || normalized.includes("bosque") || normalized.includes("finanza")) {
    return "palette-esmeralda";
  }
  if (normalized.includes("oro") || normalized.includes("dorado") || normalized.includes("ambar") || normalized.includes("sol") || normalized.includes("imperial")) {
    return "palette-oro";
  }
  if (normalized.includes("morado") || normalized.includes("amatista") || normalized.includes("violeta") || normalized.includes("purpura")) {
    return "palette-amatista";
  }
  if (normalized.includes("rojo") || normalized.includes("rubi") || normalized.includes("carmesi") || normalized.includes("vino")) {
    return "palette-rubi";
  }
  if (normalized.includes("oscuro") || normalized.includes("dark") || normalized.includes("noche") || normalized.includes("negro")) {
    return "palette-oscuro";
  }

  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  const dynamicPalettes = [
    "palette-antillana",
    "palette-esmeralda",
    "palette-azul",
    "palette-oro",
    "palette-amatista",
    "palette-rubi",
    "palette-arena",
    "palette-claro"
  ];
  return dynamicPalettes[hash % dynamicPalettes.length];
}

export function applyThemePaletteToDocument(paletteKey, themeName = "Oscuro", customColors = null) {
  let resolvedKey = paletteKey;
  if (!resolvedKey || resolvedKey === "undefined") {
    resolvedKey = derivePaletteFromThemeName(themeName);
  }

  const presetDef = PRESET_PALETTE_DEFINITIONS[resolvedKey] || PRESET_PALETTE_DEFINITIONS["palette-oscuro"];
  const colorsToApply = customColors || presetDef.colors;

  document.documentElement.setAttribute("data-theme", resolvedKey);
  applyColorsViaConstructableStylesheet(colorsToApply);

  try {
    localStorage.setItem(ACTIVE_THEME_STORAGE_KEY, resolvedKey);
    localStorage.setItem(ACTIVE_THEME_NAME_KEY, themeName);
    if (customColors) {
      localStorage.setItem(ACTIVE_CUSTOM_COLORS_KEY, JSON.stringify(customColors));
    } else {
      localStorage.removeItem(ACTIVE_CUSTOM_COLORS_KEY);
    }
  } catch (_e) {
    // Ignorar
  }

  const headerThemeLabel = document.getElementById("header-active-theme-label");
  if (headerThemeLabel) {
    headerThemeLabel.textContent = `Tema: ${themeName}`;
  }
}

export function previewCustomColorsLive(colorsObj, profileName = "Vista Previa") {
  applyColorsViaConstructableStylesheet(colorsObj);
  const headerThemeLabel = document.getElementById("header-active-theme-label");
  if (headerThemeLabel) {
    headerThemeLabel.textContent = `Tema: ${profileName}`;
  }
}

export function initializeSavedThemeOnBoot() {
  const savedPalette = localStorage.getItem(ACTIVE_THEME_STORAGE_KEY) || "palette-oscuro";
  const savedName = localStorage.getItem(ACTIVE_THEME_NAME_KEY) || "Oscuro";
  let savedCustomColors = null;
  try {
    const rawCustom = localStorage.getItem(ACTIVE_CUSTOM_COLORS_KEY);
    if (rawCustom) {
      savedCustomColors = JSON.parse(rawCustom);
    }
  } catch (_e) {
    savedCustomColors = null;
  }
  applyThemePaletteToDocument(savedPalette, savedName, savedCustomColors);
}

export function getActiveThemeMetadata() {
  const paletteKey = localStorage.getItem(ACTIVE_THEME_STORAGE_KEY) || "palette-oscuro";
  const themeName = localStorage.getItem(ACTIVE_THEME_NAME_KEY) || "Oscuro";
  let activeColors = PRESET_PALETTE_DEFINITIONS[paletteKey]?.colors || PRESET_PALETTE_DEFINITIONS["palette-oscuro"].colors;

  try {
    const rawCustom = localStorage.getItem(ACTIVE_CUSTOM_COLORS_KEY);
    if (rawCustom) {
      activeColors = { ...activeColors, ...JSON.parse(rawCustom) };
    }
  } catch (_e) {
    // Usar colores preset
  }

  return {
    paletteKey,
    themeName,
    activeColors,
    availablePalettes: Object.values(PRESET_PALETTE_DEFINITIONS)
  };
}

export async function createAndApplyNamedTheme(customThemeName) {
  const cleanName = String(customThemeName || "").trim();
  const derivedPaletteKey = derivePaletteFromThemeName(cleanName);
  const paletteInfo = PRESET_PALETTE_DEFINITIONS[derivedPaletteKey];

  const newThemeRecord = {
    id: `theme-custom-${Date.now()}`,
    name: cleanName,
    baseKey: derivedPaletteKey.replace("palette-", ""),
    paletteKey: derivedPaletteKey,
    description: `Tema personalizado generado en base al nombre "${cleanName}" (${paletteInfo?.label || derivedPaletteKey}).`,
    isPreset: false,
    customColors: null
  };

  await insertOrUpdateCollectionRecord("savedThemes", newThemeRecord);
  applyThemePaletteToDocument(derivedPaletteKey, cleanName, null);
  return newThemeRecord;
}

export function getCustomColorProfilesList() {
  try {
    const raw = localStorage.getItem(CUSTOM_COLOR_PROFILES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (_e) {
    // Fallback
  }
  return [];
}

export async function createAndApplyCustomColorProfile({
  id,
  name,
  colors
}) {
  const cleanName = String(name || "Mi Perfil de Colores").trim();
  const profileRecord = {
    id: id || `PROFILE-COL-${Date.now()}`,
    name: cleanName,
    paletteKey: `custom-profile-${Date.now()}`,
    description: `Perfil de colores personalizado por el usuario (${colors.bgPrimary} / ${colors.brandPrimary}).`,
    isPreset: false,
    isCustomColorProfile: true,
    customColors: { ...colors }
  };

  const profiles = getCustomColorProfilesList();
  const existingIdx = profiles.findIndex((p) => p.id === profileRecord.id || p.name.toLowerCase() === cleanName.toLowerCase());
  if (existingIdx >= 0) {
    profiles[existingIdx] = profileRecord;
  } else {
    profiles.push(profileRecord);
  }

  try {
    localStorage.setItem(CUSTOM_COLOR_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  } catch (_e) {
    // Ignorar
  }

  await insertOrUpdateCollectionRecord("savedThemes", profileRecord);
  applyThemePaletteToDocument(profileRecord.paletteKey, profileRecord.name, profileRecord.customColors);
  return profileRecord;
}

export function getAllSavedThemes() {
  const dbThemes = getCollectionRecords("savedThemes");
  const normalizedPresets = [
    {
      id: "theme-oscuro",
      name: "Modo Oscuro (Original Enterprise)",
      baseKey: "oscuro",
      paletteKey: "palette-oscuro",
      description: "Tema oscuro de alto contraste financiero (por defecto).",
      isPreset: true,
      customColors: PRESET_PALETTE_DEFINITIONS["palette-oscuro"].colors
    },
    {
      id: "theme-claro",
      name: "Modo Claro (Ejecutivo Luminoso)",
      baseKey: "claro",
      paletteKey: "palette-claro",
      description: "Tema claro corporativo de alto contraste para oficinas iluminadas.",
      isPreset: true,
      customColors: PRESET_PALETTE_DEFINITIONS["palette-claro"].colors
    },
    {
      id: "theme-azul",
      name: "Tema Azul (SAP Logon Horizon)",
      baseKey: "azul",
      paletteKey: "palette-azul",
      description: "Tema azul profundo inspirado en SAP GUI 800 y Fiori Horizon.",
      isPreset: true,
      customColors: PRESET_PALETTE_DEFINITIONS["palette-azul"].colors
    },
    {
      id: "theme-antillana",
      name: "Turquesa Oceánico (La Antillana)",
      baseKey: "antillana",
      paletteKey: "palette-antillana",
      description: "Tema institucional cian y turquesa oceánico.",
      isPreset: true,
      customColors: PRESET_PALETTE_DEFINITIONS["palette-antillana"].colors
    },
    {
      id: "theme-esmeralda",
      name: "Esmeralda Bóveda Financiera",
      baseKey: "esmeralda",
      paletteKey: "palette-esmeralda",
      description: "Tema bancario en tonos esmeralda y pizarra.",
      isPreset: true,
      customColors: PRESET_PALETTE_DEFINITIONS["palette-esmeralda"].colors
    },
    {
      id: "theme-arena",
      name: "Arena Marfil Cálido (Claro)",
      baseKey: "arena",
      paletteKey: "palette-arena",
      description: "Tema claro cálido marfil para lectura prolongada.",
      isPreset: true,
      customColors: PRESET_PALETTE_DEFINITIONS["palette-arena"].colors
    }
  ];

  const customProfiles = getCustomColorProfilesList();
  const customNamedFromDb = dbThemes.filter(
    (t) => !t.isPreset && !normalizedPresets.some((p) => p.id === t.id) && !customProfiles.some((c) => c.id === t.id)
  ).map((t) => ({
    ...t,
    paletteKey: t.paletteKey || derivePaletteFromThemeName(t.name)
  }));

  return [...normalizedPresets, ...customProfiles, ...customNamedFromDb];
}
