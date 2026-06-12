// Dynamic year range. World Bank data lags ~1–2 years, so the window ends last year.
export const START_YEAR = 1974;
export const END_YEAR = new Date().getFullYear() - 1;

// Indicators in use. `monetary: true` flags the ones the Relocate ranking must
// log-transform (money is heavy-tailed across countries).
export const INDICATORS = {
  gdppc: { key: "gdppc", code: "NY.GDP.PCAP.CD", label: "GDP per capita", unit: "$", monetary: true },
  gdp: { key: "gdp", code: "NY.GDP.MKTP.CD", label: "GDP (total)", unit: "$", monetary: true },
  pop: { key: "pop", code: "SP.POP.TOTL", label: "Population", unit: "ppl", monetary: false },
  internet: { key: "internet", code: "IT.NET.USER.ZS", label: "Internet users (% of pop.)", unit: "%", monetary: false },
  life: { key: "life", code: "SP.DYN.LE00.IN", label: "Life expectancy", unit: "yrs", monetary: false },
  urban: { key: "urban", code: "SP.URB.TOTL.IN.ZS", label: "Urban population", unit: "%", monetary: false },
  health: { key: "health", code: "SH.XPD.CHEX.PC.CD", label: "Health spending per capita", unit: "$", monetary: true },
};

// Convenience list view of the same data.
export const INDICATOR_LIST = Object.values(INDICATORS);

// More World Bank indicators worth adding later (high data coverage, easy to add —
// just append a row above):
// NY.GNP.PCAP.CD      GNI per capita, Atlas method ($)
// SP.DYN.IMRT.IN      Infant mortality (per 1,000 live births)
// SP.POP.GROW         Population growth (annual %)
// FP.CPI.TOTL.ZG      Inflation, consumer prices (annual %)
// SL.UEM.TOTL.ZS      Unemployment (% of labor force)
// SL.TLF.CACT.FE.ZS   Female labor force participation (%)
// SE.ADT.LITR.ZS      Adult literacy rate (%)
// SE.PRM.ENRR         Primary school enrollment (% gross)
// EG.ELC.ACCS.ZS      Access to electricity (% of pop.)
// SH.H2O.BASW.ZS      Basic drinking water access (%)
// SH.XPD.CHEX.GD.ZS   Health spending (% of GDP)
// IT.CEL.SETS.P2      Mobile subscriptions (per 100 people)
// AG.LND.FRST.ZS      Forest area (% of land)
// NV.IND.TOTL.ZS      Industry value added (% of GDP)
// BX.KLT.DINV.WD.GD.ZS  FDI net inflows (% of GDP)
// SI.POV.GINI         Gini index (sparse coverage)

// Chart series colors (mirror the @theme tokens for use inside recharts props).
export const SERIES_A = "#ea7a1d"; // amber — country A
export const SERIES_B = "#2563eb"; // blue  — country B
export const INK = "#0f172a";
export const ACCENT = "#0d9488";
