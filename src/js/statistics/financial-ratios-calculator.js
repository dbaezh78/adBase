/**
 * Motor Independiente de Cálculo de Estados Financieros (NIIF) e Indicadores Ejecutivos.
 */

export function computeFinancialStatementsAndRatios(chartOfAccounts = []) {
  const imputableAccounts = chartOfAccounts.filter((acc) => acc.imputable);

  const assets = imputableAccounts.filter((acc) => acc.type === "ACTIVO");
  const currentAssets = assets.filter((acc) => String(acc.code).startsWith("1.1"));
  const nonCurrentAssets = assets.filter((acc) => !String(acc.code).startsWith("1.1"));

  const liabilities = imputableAccounts.filter((acc) => acc.type === "PASIVO");
  const currentLiabilities = liabilities.filter((acc) => String(acc.code).startsWith("2.1"));
  const nonCurrentLiabilities = liabilities.filter((acc) => !String(acc.code).startsWith("2.1"));

  const equityAccounts = imputableAccounts.filter((acc) => acc.type === "PATRIMONIO");
  const revenueAccounts = imputableAccounts.filter((acc) => acc.type === "INGRESO");
  const costAccounts = imputableAccounts.filter((acc) => acc.type === "COSTO");
  const expenseAccounts = imputableAccounts.filter((acc) => acc.type === "GASTO");

  const sumBalances = (list) => list.reduce((acc, item) => acc + (Number(item.balance) || 0), 0);

  const totalCurrentAssets = sumBalances(currentAssets);
  const totalNonCurrentAssets = sumBalances(nonCurrentAssets);
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

  const totalCurrentLiabilities = sumBalances(currentLiabilities);
  const totalNonCurrentLiabilities = sumBalances(nonCurrentLiabilities);
  const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

  const totalBaseEquity = sumBalances(equityAccounts);
  const totalRevenues = sumBalances(revenueAccounts);
  const totalCosts = sumBalances(costAccounts);
  const totalOperatingExpenses = sumBalances(expenseAccounts);

  const grossProfit = totalRevenues - totalCosts;
  const netIncome = grossProfit - totalOperatingExpenses;
  const totalEquityWithNetIncome = totalBaseEquity + netIncome;

  const inventoryBalance = currentAssets
    .filter((a) => a.name.toLowerCase().includes("inventario"))
    .reduce((acc, item) => acc + (Number(item.balance) || 0), 0);

  const currentRatio = totalCurrentLiabilities > 0
    ? totalCurrentAssets / totalCurrentLiabilities
    : 0;

  const acidTestRatio = totalCurrentLiabilities > 0
    ? (totalCurrentAssets - inventoryBalance) / totalCurrentLiabilities
    : 0;

  const debtToAssetRatioPct = totalAssets > 0
    ? (totalLiabilities / totalAssets) * 100
    : 0;

  const netProfitMarginPct = totalRevenues > 0
    ? (netIncome / totalRevenues) * 100
    : 0;

  const returnOnEquityPct = totalEquityWithNetIncome > 0
    ? (netIncome / totalEquityWithNetIncome) * 100
    : 0;

  const workingCapital = totalCurrentAssets - totalCurrentLiabilities;

  return {
    assets,
    currentAssets,
    nonCurrentAssets,
    liabilities,
    currentLiabilities,
    nonCurrentLiabilities,
    equityAccounts,
    revenueAccounts,
    costAccounts,
    expenseAccounts,
    totals: {
      totalCurrentAssets,
      totalNonCurrentAssets,
      totalAssets,
      totalCurrentLiabilities,
      totalNonCurrentLiabilities,
      totalLiabilities,
      totalBaseEquity,
      totalRevenues,
      totalCosts,
      totalOperatingExpenses,
      grossProfit,
      netIncome,
      totalEquityWithNetIncome,
      accountingEquationBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquityWithNetIncome)) < 1
    },
    ratios: {
      currentRatio,
      acidTestRatio,
      debtToAssetRatioPct,
      netProfitMarginPct,
      returnOnEquityPct,
      workingCapital
    }
  };
}
