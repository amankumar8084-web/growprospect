import { BaseLocationProvider } from './BaseLocationProvider.js';

export class GooglePlacesAdapter extends BaseLocationProvider {
  constructor(options = {}) {
    super('google_places', 'Google Maps / Places API', options);
    this.apiKey = options.apiKey || (typeof process !== 'undefined' ? process.env?.GOOGLE_MAPS_API_KEY : null) || '';
    this.textSearchUrl = options.textSearchUrl || 'https://maps.googleapis.com/maps/api/place/textsearch/json';
    this.detailsUrl = options.detailsUrl || 'https://maps.googleapis.com/maps/api/place/details/json';
  }

  async testConnection() {
    if (!this.apiKey || this.apiKey.trim() === '') {
      return {
        success: false,
        message: 'No API Key provided for Google Maps / Places API.'
      };
    }

    const start = Date.now();
    try {
      const url = `${this.textSearchUrl}?query=test&key=${encodeURIComponent(this.apiKey)}`;
      const res = await fetch(url);
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          message: `Google Places HTTP error (${res.status}): ${errText || res.statusText}`,
          latencyMs
        };
      }

      const data = await res.json();
      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
        return {
          success: true,
          message: 'Connected successfully to Google Places API (Status: ' + data.status + ')',
          latencyMs
        };
      }

      return {
        success: false,
        message: `Google Places API Error [${data.status}]: ${data.error_message || 'Access denied or invalid API key'}`,
        latencyMs
      };
    } catch (err) {
      return {
        success: false,
        message: `Network/connection error contacting Google Places: ${err.message}`
      };
    }
  }

  /**
   * Fetch place details (website, phone) for a Google place_id
   * @private
   */
  async fetchPlaceDetails(placeId) {
    if (!placeId || !this.apiKey) return null;
    try {
      const url = `${this.detailsUrl}?place_id=${encodeURIComponent(placeId)}&fields=name,formatted_phone_number,international_phone_number,website,formatted_address&key=${encodeURIComponent(this.apiKey)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.status === 'OK' && data.result) {
        return data.result;
      }
      return null;
    } catch {
      return null;
    }
  }

  async searchPlaces({ country = 'US', state = '', city = 'Austin, TX', category = 'Commercial & Local Services', limit = 20 }) {
    if (!this.apiKey || this.apiKey.trim() === '') {
      throw new Error('[GooglePlacesAdapter] BLOCKED: No Google Maps / Places API key configured. Configure your key in Settings.');
    }

    const locationQuery = [category, city, state, country].filter(Boolean).join(' in ');
    const url = `${this.textSearchUrl}?query=${encodeURIComponent(locationQuery)}&key=${encodeURIComponent(this.apiKey)}`;

    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[GooglePlacesAdapter] HTTP request failed (${res.status}): ${errText}`);
    }

    const data = await res.json();

    if (data.status === 'REQUEST_DENIED') {
      throw new Error(`[GooglePlacesAdapter] Request Denied: ${data.error_message || 'Invalid API Key or Places API not enabled'}`);
    }
    if (data.status === 'OVER_QUERY_LIMIT') {
      throw new Error(`[GooglePlacesAdapter] Over Query Limit: ${data.error_message || 'Quota exceeded'}`);
    }
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`[GooglePlacesAdapter] Error (${data.status}): ${data.error_message || 'Search failed'}`);
    }

    const results = (data.results || []).slice(0, limit);

    // Fetch place details for website and contact info in parallel (batched in chunks of 5)
    const normalizedPlaces = [];
    const chunkSize = 5;

    for (let i = 0; i < results.length; i += chunkSize) {
      const chunk = results.slice(i, i + chunkSize);
      const detailsList = await Promise.all(
        chunk.map((item) => (item.place_id ? this.fetchPlaceDetails(item.place_id) : Promise.resolve(null)))
      );

      chunk.forEach((item, idx) => {
        const details = detailsList[idx] || {};
        const placeId = item.place_id || `google-${Date.now()}-${i + idx}`;

        normalizedPlaces.push({
          id: placeId,
          name: details.name || item.name || 'Unnamed Business',
          address: details.formatted_address || item.formatted_address || `${city}, ${country}`,
          city: city,
          state: state,
          country: country,
          website: details.website || null,
          phone: details.formatted_phone_number || details.international_phone_number || null,
          category: (item.types && item.types[0]) ? item.types[0].replace(/_/g, ' ') : category,
          source: 'Google Maps / Places API',
          sourceUrl: item.place_id ? `https://www.google.com/maps/place/?q=place_id:${item.place_id}` : '',
          lat: item.geometry?.location?.lat || null,
          lng: item.geometry?.location?.lng || null
        });
      });
    }

    return normalizedPlaces;
  }
}
