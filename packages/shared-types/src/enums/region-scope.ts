export const RegionScope = {
  Nationwide: 'nationwide',
  AllProvinces: 'all_provinces',
  AllCitiesInProvince: 'all_cities_in_province',
  AllDistrictsInCity: 'all_districts_in_city',
  Specific: 'specific',
} as const;
export type RegionScope = (typeof RegionScope)[keyof typeof RegionScope];
