/**
 * Motor independiente de validación matemática y normativa contable (Partida Doble,
 * Cuentas Imputables y Estado de Periodo Fiscal).
 */

export function validateJournalEntryBalance(entryPayload, chartOfAccounts = [], fiscalPeriods = []) {
  const errors = [];
  const lines = Array.isArray(entryPayload?.lines) ? entryPayload.lines : [];

  if (!entryPayload?.concept || String(entryPayload.concept).trim().length < 4) {
    errors.push("El concepto o glosa del asiento debe tener al menos 4 caracteres.");
  }

  if (lines.length < 2) {
    errors.push("Un asiento de partida doble requiere como mínimo 2 líneas contables.");
  }

  const targetPeriodCode = String(entryPayload?.date || "").slice(0, 7);
  const matchingPeriod = fiscalPeriods.find((period) => period.period === targetPeriodCode);
  if (matchingPeriod && matchingPeriod.status === "CERRADO") {
    errors.push(`El periodo fiscal ${targetPeriodCode} se encuentra CERRADO y bloqueado por seguridad.`);
  }

  let totalDebit = 0;
  let totalCredit = 0;

  lines.forEach((line, index) => {
    const debit = Math.round((Number(line.debit) || 0) * 100) / 100;
    const credit = Math.round((Number(line.credit) || 0) * 100) / 100;
    totalDebit += debit;
    totalCredit += credit;

    if (debit === 0 && credit === 0) {
      errors.push(`Línea #${index + 1}: Debe registrar un monto en Débito o Crédito.`);
    }
    if (debit > 0 && credit > 0) {
      errors.push(`Línea #${index + 1}: Una misma línea no puede tener Débito y Crédito simultáneamente.`);
    }

    const accountRecord = chartOfAccounts.find((acc) => acc.code === line.accountCode);
    if (!accountRecord) {
      errors.push(`Línea #${index + 1}: La cuenta ${line.accountCode || "(vacía)"} no existe en el Catálogo.`);
    } else if (!accountRecord.imputable) {
      errors.push(`Línea #${index + 1}: La cuenta ${accountRecord.code} (${accountRecord.name}) es agrupadora y no admite cargos directos.`);
    }
  });

  totalDebit = Math.round(totalDebit * 100) / 100;
  totalCredit = Math.round(totalCredit * 100) / 100;
  const difference = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;

  if (totalDebit <= 0) {
    errors.push("El total del asiento contable debe ser mayor que cero.");
  }
  if (difference > 0.001) {
    errors.push(`Descuadre contable detectado: Débito (${totalDebit.toFixed(2)}) ≠ Crédito (${totalCredit.toFixed(2)}). Diferencia: ${difference.toFixed(2)}.`);
  }

  return {
    isValid: errors.length === 0,
    totalDebit,
    totalCredit,
    difference,
    errors
  };
}
