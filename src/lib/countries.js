// The single seam for country display names. English comes straight from the World
// Bank API; other locales resolve through a dictionary keyed by ISO-3, falling back
// to the API's English name for any code the dictionary is missing. `locale` defaults
// to the current locale, so callers can keep using countryLabel(country).

import { getLocale } from "./i18n";
import { COUNTRY_NAMES_RU } from "./countryNames.ru";

const DICTS = { ru: COUNTRY_NAMES_RU };

export const countryLabel = (country, locale = getLocale()) => {
  if (!country) return "";
  const dict = DICTS[locale];
  return (dict && dict[country.id]) || country.name;
};

// WB region names → Russian. Display-only: the English region string stays the
// internal filter value and URL token; we just localize what's shown. Keys are
// trimmed (the API returns a couple with a trailing space — see regionLabel).
const REGION_NAMES_RU = {
  "East Asia & Pacific": "Восточная Азия и Тихоокеанский регион",
  "Europe & Central Asia": "Европа и Центральная Азия",
  "Latin America & Caribbean": "Латинская Америка и Карибский бассейн",
  "Middle East, North Africa, Afghanistan & Pakistan": "Ближний Восток, Северная Африка, Афганистан и Пакистан",
  "North America": "Северная Америка",
  "South Asia": "Южная Азия",
  "Sub-Saharan Africa": "Африка южнее Сахары",
};

const REGION_DICTS = { ru: REGION_NAMES_RU };

// Display label for a WB region value, falling back to the raw English string.
export const regionLabel = (region, locale = getLocale()) => {
  if (!region) return "";
  const dict = REGION_DICTS[locale];
  return (dict && dict[region.trim()]) || region;
};
