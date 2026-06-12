// The single seam for country names. Today the World Bank API already returns
// English names, so this is a pass-through. To localize later, swap the body for:
//   return nameDicts[LOCALE]?.[country.id] ?? country.name;
export const countryLabel = (country) => country.name;
