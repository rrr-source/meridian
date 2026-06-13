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
