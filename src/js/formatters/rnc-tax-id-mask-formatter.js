/**
 * Formateador y validador independiente de máscara RNC empresarial (###-#####-#).
 * Garantiza que solo se ingresen caracteres numéricos y aplica la máscara en vivo.
 */

export function applyRncMaskFormat(rawValue) {
  const digitsOnly = String(rawValue || "").replace(/\D/g, "").slice(0, 9);

  if (digitsOnly.length <= 3) {
    return digitsOnly;
  }
  if (digitsOnly.length <= 8) {
    return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3)}`;
  }
  return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 8)}-${digitsOnly.slice(8, 9)}`;
}

export function validateRncMaskFormat(rncString) {
  return /^\d{3}-\d{5}-\d{1}$/.test(String(rncString || "").trim());
}
