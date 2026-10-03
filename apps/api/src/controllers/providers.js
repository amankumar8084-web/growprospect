import { ProviderFactory, PROVIDER_TYPES } from '@lead-discovery/scraper-business';

export async function searchActivePlaces(searchParams = {}) {
  const geoKey = process.env.GEOAPIFY_API_KEY || process.env.VITE_GEOAPIFY_API_KEY || '';
  const googleKey = process.env.GOOGLE_MAPS_API_KEY || '';

  const activeType = geoKey 
    ? PROVIDER_TYPES.GEOAPIFY 
    : googleKey 
      ? PROVIDER_TYPES.GOOGLE_PLACES 
      : PROVIDER_TYPES.OSM;

  const adapterConfig = {
    apiKey: activeType === PROVIDER_TYPES.GEOAPIFY ? geoKey : googleKey,
    endpoint: 'https://nominatim.openstreetmap.org/search'
  };

  const adapter = ProviderFactory.create(activeType, adapterConfig);
  return await adapter.searchPlaces(searchParams);
}
