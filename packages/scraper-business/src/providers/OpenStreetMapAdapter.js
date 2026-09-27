import { BaseLocationProvider } from './BaseLocationProvider.js';

export class OpenStreetMapAdapter extends BaseLocationProvider {
  constructor(options = {}) {
    super('osm', 'OpenStreetMap (Nominatim)', options);
    this.endpoint = (options.endpoint || 'https://nominatim.openstreetmap.org/search').replace(/\/+$/, '');
    this.userAgent = options.userAgent || 'GrowProspect-LeadDiscovery/1.0 (contact: info@growprospect.local)';
  }

  async testConnection() {
    const start = Date.now();
    try {
      const url = `${this.endpoint}?q=New+York&format=json&limit=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        }
      });
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const text = await res.text();
        return {
          success: false,
          message: `OpenStreetMap error (HTTP ${res.status}): ${text || res.statusText}`,
          latencyMs
        };
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        return {
          success: true,
          message: 'Connected successfully to OpenStreetMap (Nominatim API)',
          latencyMs
        };
      }

      return {
        success: false,
        message: 'OpenStreetMap returned an unexpected response format.',
        latencyMs
      };
    } catch (err) {
      return {
        success: false,
        message: `Network/connection error contacting OpenStreetMap: ${err.message}`
      };
    }
  }

  async searchPlaces({ country = 'US', state = '', city = 'Austin, TX', category = 'Commercial & Local Services', limit = 20 }) {
    const locationParts = [city, state, country].filter(Boolean).join(', ');
    const query = `${category} in ${locationParts}`;
    const url = `${this.endpoint}?q=${encodeURIComponent(query)}&format=json&addressdetails=1&extratags=1&limit=${limit}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[OpenStreetMapAdapter] Nominatim API failed (HTTP ${res.status}): ${errText}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('[OpenStreetMapAdapter] Unexpected response: expected an array of places');
    }

    return data.map((item, idx) => {
      const tags = item.extratags || {};
      const addr = item.address || {};
      const placeId = `osm-${item.osm_type || 'node'}-${item.osm_id || item.place_id || idx}`;

      const website = tags.website || tags['contact:website'] || tags.url || null;
      const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || null;

      // Extract best name
      const name = item.name || tags.name || (item.display_name ? item.display_name.split(',')[0].trim() : 'Unnamed Business');

      return {
        id: placeId,
        name: name,
        address: item.display_name || [addr.road, addr.city, addr.state, addr.country].filter(Boolean).join(', '),
        city: addr.city || addr.town || addr.village || city,
        state: addr.state || state,
        country: (addr.country_code || country).toUpperCase(),
        website: website,
        phone: phone,
        category: tags.amenity || tags.shop || tags.office || category,
        source: 'OpenStreetMap (Nominatim)',
        sourceUrl: item.osm_type && item.osm_id ? `https://www.openstreetmap.org/${item.osm_type}/${item.osm_id}` : '',
        lat: item.lat ? parseFloat(item.lat) : null,
        lng: item.lon ? parseFloat(item.lon) : null
      };
    });
  }
}
