const API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:3001';

export const providerService = {
  /**
   * Fetch current public provider configuration (active provider, enabled states, masked keys)
   */
  async getConfig() {
    try {
      const res = await fetch(`${API_URL}/api/providers/config`);
      if (!res.ok) {
        throw new Error(`Failed to load provider config (HTTP ${res.status})`);
      }
      return await res.json();
    } catch (err) {
      console.warn('[providerService] Could not reach backend config, using local defaults:', err.message);
      return {
        activeProvider: 'geoapify',
        providers: {
          google_places: { name: 'Google Maps / Places API', enabled: true, hasKey: false, maskedKey: '' },
          geoapify: { name: 'Geoapify Places API', enabled: true, hasKey: false, maskedKey: '' },
          osm: { name: 'OpenStreetMap (Nominatim)', enabled: true, endpoint: 'https://nominatim.openstreetmap.org/search' }
        }
      };
    }
  },

  /**
   * Save provider configuration securely on the backend
   */
  async saveConfig(payload) {
    const res = await fetch(`${API_URL}/api/providers/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Failed to save provider config (HTTP ${res.status})`);
    }

    return await res.json();
  },

  /**
   * Test connection to a specific provider
   * @param {string} providerId 'google_places' | 'geoapify' | 'osm'
   * @param {Object} [params]
   * @param {string} [params.apiKey]
   * @param {string} [params.endpoint]
   */
  async testConnection(providerId, params = {}) {
    const res = await fetch(`${API_URL}/api/providers/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId,
        apiKey: params.apiKey,
        endpoint: params.endpoint
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || errData.error || `Connection test failed (HTTP ${res.status})`);
    }

    return await res.json();
  },

  /**
   * Search places using the active provider on the backend
   */
  async searchPlaces(searchParams) {
    const res = await fetch(`${API_URL}/api/providers/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchParams)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.success) {
      throw new Error(data.error || `Provider search failed (HTTP ${res.status})`);
    }

    return data.places || [];
  }
};
