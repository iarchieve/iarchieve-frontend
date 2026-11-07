export function createScope(countryId, cityId = null) {
  if (typeof countryId !== 'string' || !countryId.trim()) {
    throw new TypeError('국가를 선택하세요.');
  }
  return cityId
    ? { type: 'city', countryId, cityId }
    : { type: 'country', countryId, cityId: null };
}
