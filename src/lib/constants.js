// Dynamic year range. World Bank data lags ~1–2 years, so the window ends last year.
export const START_YEAR = 1974;
export const END_YEAR = new Date().getFullYear() - 1;

// Curated preset indicators — ~25 well-known World Bank series with clean labels
// and units, all verified to have broad country coverage. `monetary: true` flags
// the ones the Relocate ranking must log-transform (money is heavy-tailed across
// countries). Compare lets users pick any of these, plus anything from the live
// World Bank catalog search (those arrive with unit: null → compact formatting).
//
// `unit` drives readout/axis formatting (see src/lib/format.js):
//   "$" → $1.3M   "%" → 84.2%   "yrs"/"per 1,000"/"per 100"/"t" → "78.9 yrs"
//   "ppl" / "" / null → bare compact (331M)
export const INDICATORS = {
  // Income & output
  gdppc: { key: "gdppc", code: "NY.GDP.PCAP.CD", label: "GDP per capita", unit: "$", monetary: true },
  gdp: { key: "gdp", code: "NY.GDP.MKTP.CD", label: "GDP (total)", unit: "$", monetary: true },
  gni: { key: "gni", code: "NY.GNP.PCAP.CD", label: "GNI per capita (Atlas)", unit: "$", monetary: true },
  inflation: { key: "inflation", code: "FP.CPI.TOTL.ZG", label: "Inflation (CPI, annual)", unit: "%", monetary: false },
  industry: { key: "industry", code: "NV.IND.TOTL.ZS", label: "Industry value added (% of GDP)", unit: "%", monetary: false },
  fdi: { key: "fdi", code: "BX.KLT.DINV.WD.GD.ZS", label: "FDI net inflows (% of GDP)", unit: "%", monetary: false },
  gini: { key: "gini", code: "SI.POV.GINI", label: "Gini index (inequality)", unit: "", monetary: false },

  // People
  pop: { key: "pop", code: "SP.POP.TOTL", label: "Population", unit: "ppl", monetary: false },
  popgrowth: { key: "popgrowth", code: "SP.POP.GROW", label: "Population growth (annual)", unit: "%", monetary: false },
  urban: { key: "urban", code: "SP.URB.TOTL.IN.ZS", label: "Urban population", unit: "%", monetary: false },
  life: { key: "life", code: "SP.DYN.LE00.IN", label: "Life expectancy", unit: "yrs", monetary: false },
  infantmort: { key: "infantmort", code: "SP.DYN.IMRT.IN", label: "Infant mortality", unit: "per 1,000", monetary: false },

  // Labor
  unemployment: { key: "unemployment", code: "SL.UEM.TOTL.ZS", label: "Unemployment (% of labor force)", unit: "%", monetary: false },
  femlabor: { key: "femlabor", code: "SL.TLF.CACT.FE.ZS", label: "Female labor force participation", unit: "%", monetary: false },

  // Health
  health: { key: "health", code: "SH.XPD.CHEX.PC.CD", label: "Health spending per capita", unit: "$", monetary: true },
  healthgdp: { key: "healthgdp", code: "SH.XPD.CHEX.GD.ZS", label: "Health spending (% of GDP)", unit: "%", monetary: false },
  water: { key: "water", code: "SH.H2O.BASW.ZS", label: "Basic drinking water access", unit: "%", monetary: false },

  // Education
  literacy: { key: "literacy", code: "SE.ADT.LITR.ZS", label: "Adult literacy rate", unit: "%", monetary: false },
  primaryenroll: { key: "primaryenroll", code: "SE.PRM.ENRR", label: "Primary school enrollment (gross)", unit: "%", monetary: false },

  // Infrastructure & connectivity
  internet: { key: "internet", code: "IT.NET.USER.ZS", label: "Internet users (% of pop.)", unit: "%", monetary: false },
  mobile: { key: "mobile", code: "IT.CEL.SETS.P2", label: "Mobile subscriptions", unit: "per 100", monetary: false },
  electricity: { key: "electricity", code: "EG.ELC.ACCS.ZS", label: "Access to electricity", unit: "%", monetary: false },

  // Environment
  co2: { key: "co2", code: "EN.GHG.CO2.PC.CE.AR5", label: "CO₂ emissions per capita", unit: "t", monetary: false },
  forest: { key: "forest", code: "AG.LND.FRST.ZS", label: "Forest area (% of land)", unit: "%", monetary: false },
};

// Convenience list view of the same data (preset dropdown order).
export const INDICATOR_LIST = Object.values(INDICATORS);

// Default Compare charts on first load.
export const DEFAULT_COMPARE = ["gdppc", "pop", "internet"];

// Quiz pool — ~36 recognizable countries with good GDP/capita coverage (ISO-3).
export const QUIZ_POOL = [
  "USA", "CHN", "IND", "JPN", "DEU", "KOR", "SGP", "ARE", "KAZ", "UZB", "BRA", "NGA",
  "GBR", "FRA", "ITA", "ESP", "CAN", "AUS", "RUS", "MEX", "IDN", "TUR", "SAU", "ZAF",
  "EGY", "ARG", "THA", "VNM", "POL", "NLD", "SWE", "NOR", "CHE", "MYS", "PHL", "PAK",
];

// Chart series colors (mirror the @theme tokens for use inside recharts props).
export const SERIES_A = "#ea7a1d"; // amber — country A
export const SERIES_B = "#2563eb"; // blue  — country B
export const INK = "#0f172a";
export const ACCENT = "#0d9488";
