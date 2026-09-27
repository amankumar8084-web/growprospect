/**
 * BaseLocationProvider
 * Common abstract interface for all location/places data providers.
 * All providers MUST normalize their raw results to this exact schema.
 */
export class BaseLocationProvider {
  /**
   * @param {string} id Unique provider identifier ('google_places', 'geoapify', 'osm')
   * @param {string} name Human-readable provider name
   * @param {Object} [options={}] Configuration options (e.g. apiKey, endpoint)
   */
  constructor(id, name, options = {}) {
    this.id = id;
    this.name = name;
    this.options = options;
  }

  /**
   * Search places in a specific location by category.
   *
   * @param {Object} params
   * @param {string} [params.country='US']
   * @param {string} [params.state='']
   * @param {string} [params.city='']
   * @param {string} [params.category='']
   * @param {number} [params.limit=20]
   * @returns {Promise<NormalizedPlace[]>}
   */
  async searchPlaces(params = {}) {
    throw new Error(`[BaseLocationProvider] searchPlaces() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Test connection to provider API.
   *
   * @returns {Promise<{ success: boolean, message: string, latencyMs?: number }>}
   */
  async testConnection() {
    throw new Error(`[BaseLocationProvider] testConnection() must be implemented by ${this.constructor.name}`);
  }
}
