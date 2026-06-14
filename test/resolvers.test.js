import { describe, it, expect, afterEach } from "vitest";
import { countryLabel, regionLabel } from "../src/lib/countries.js";
import { describeIndicator, indicatorLabel } from "../src/lib/indicators.js";
import { setStoredLocale } from "../src/lib/i18n.js";

describe("countryLabel — English from API, Russian from dict, English fallback", () => {
  const RUS = { id: "RUS", name: "Russian Federation" };
  const USA = { id: "USA", name: "United States" };

  it("returns the API English name for the en locale", () => {
    expect(countryLabel(RUS, "en")).toBe("Russian Federation");
    expect(countryLabel(USA, "en")).toBe("United States");
  });

  it("returns the Russian name from the dictionary for ru", () => {
    expect(countryLabel(RUS, "ru")).toBe("Россия");
    expect(countryLabel(USA, "ru")).toBe("США");
  });

  it("falls back to the API English name when a code is missing from the ru dict", () => {
    expect(countryLabel({ id: "ZZZ", name: "Fooland" }, "ru")).toBe("Fooland");
  });

  it("handles a missing country gracefully", () => {
    expect(countryLabel(null, "ru")).toBe("");
  });
});

describe("regionLabel — ru display with English fallback (and trailing-space regions)", () => {
  it("translates known WB regions for ru", () => {
    expect(regionLabel("Europe & Central Asia", "ru")).toBe("Европа и Центральная Азия");
    expect(regionLabel("North America", "ru")).toBe("Северная Америка");
  });

  it("matches the WB regions that carry a trailing space (trimmed lookup)", () => {
    expect(regionLabel("Sub-Saharan Africa ", "ru")).toBe("Африка южнее Сахары");
    expect(regionLabel("Latin America & Caribbean ", "ru")).toBe("Латинская Америка и Карибский бассейн");
  });

  it("falls back to the raw region string for unknown regions or the en locale", () => {
    expect(regionLabel("Made Up Region", "ru")).toBe("Made Up Region");
    expect(regionLabel("Europe & Central Asia", "en")).toBe("Europe & Central Asia");
    expect(regionLabel("", "ru")).toBe("");
  });
});

describe("indicatorLabel — preset label per current locale", () => {
  afterEach(() => setStoredLocale("en")); // indicatorLabel reads the global locale

  const gdppc = describeIndicator("NY.GDP.PCAP.CD");

  it("uses the English preset label by default", () => {
    expect(indicatorLabel(gdppc)).toBe("GDP per capita");
  });

  it("uses the localized label_ru when the locale is ru", () => {
    setStoredLocale("ru");
    expect(indicatorLabel(gdppc)).toBe("ВВП на душу населения");
    expect(indicatorLabel(describeIndicator("IT.NET.USER.ZS"))).toBe("Пользователи интернета (% населения)");
  });

  it("leaves searched (non-preset) indicators in their catalog English even in ru", () => {
    setStoredLocale("ru");
    const searched = describeIndicator("XX.SOME.CODE", "Some catalog label");
    expect(indicatorLabel(searched)).toBe("Some catalog label");
  });

  it("handles a missing descriptor gracefully", () => {
    expect(indicatorLabel(null)).toBe("");
  });
});
