import { GeoapifyAdapter } from './GeoapifyAdapter.js';
import { GooglePlacesAdapter } from './GooglePlacesAdapter.js';
import { OpenStreetMapAdapter } from './OpenStreetMapAdapter.js';

export const PROVIDER_TYPES = {
  GEOAPIFY: 'geoapify',
  GOOGLE_PLACES: 'google_places',
  OSM: 'osm'
};

export class ProviderFactory {
  /**
   * Instantiate an adapter given its type and options
   *
   * @param {string} providerType 'geoapify' | 'google_places' | 'osm'
   * @param {Object} [options={}]
   * @returns {BaseLocationProvider}
   */
  static create(providerType, options = {}) {
    switch (providerType) {
      case PROVIDER_TYPES.GOOGLE_PLACES:
        return new GooglePlacesAdapter(options);
      case PROVIDER_TYPES.OSM:
        return new OpenStreetMapAdapter(options);
      case PROVIDER_TYPES.GEOAPIFY:
      default:
        return new GeoapifyAdapter(options);
    }
  }

  /**
   * Get active provider from a unified provider configuration object
   *
   * @param {Object} config
   * @param {string} config.activeProvider
   * @param {Object} config.providers
   * @returns {BaseLocationProvider}
   */
  static getActiveProvider(config = {}) {
    const activeType = config.activeProvider || PROVIDER_TYPES.GEOAPIFY;
    const providerConfig = (config.providers && config.providers[activeType]) || {};

    if (providerConfig.enabled === false) {
      throw new Error(`[ProviderFactory] The active provider "${activeType}" is currently disabled in Settings.`);
    }

    return this.create(activeType, providerConfig);
  }
}
