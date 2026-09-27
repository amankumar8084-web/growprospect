import { BaseLocationProvider } from './BaseLocationProvider.js';

export class GeoapifyAdapter extends BaseLocationProvider {
  constructor(options = {}) {
    super('geoapify', 'Geoapify Places API', options);
    this.apiKey = options.apiKey || (typeof process !== 'undefined' ? process.env?.GEOAPIFY_API_KEY : null) || '';
    this.baseUrl = options.baseUrl || 'https://api.geoapify.com/v2/places';
    this.geocodeUrl = options.geocodeUrl || 'https://api.geoapify.com/v1/geocode/search';
  }

  mapCategory(cat) {
    const map = {
      'Commercial & Local Services': 'service',
      'Healthcare & Dental': 'healthcare',
      'Catering & Restaurants': 'catering.restaurant',
      'Beauty & Personal Care': 'service.beauty_salon',
      'Automotive Services': 'commercial.vehicle',
      'Legal & Professional': 'office'
    };
    return map[cat] || 'service';
  }

  async testConnection() {
    if (!this.apiKey || this.apiKey.trim() === '') {
      return {
        success: false,
        message: 'No API Key provided for Geoapify.'
      };
    }

    const start = Date.now();
    try {
      const url = `${this.geocodeUrl}?text=New+York&limit=1&apiKey=${encodeURIComponent(this.apiKey)}`;
      const res = await fetch(url);
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          message: `Geoapify API error (HTTP ${res.status}): ${errText || res.statusText}`,
          latencyMs
        };
      }

      const data = await res.json();
      if (data && data.features) {
        return {
          success: true,
          message: `Connected successfully to Geoapify Places API (HTTP 200 OK)`,
          latencyMs
        };
      }

      return {
        success: false,
        message: 'Geoapify returned an unexpected response structure.',
        latencyMs
      };
    } catch (err) {
      return {
        success: false,
        message: `Network/connection error contacting Geoapify: ${err.message}`
      };
    }
  }

  async searchPlaces({ country = 'US', state = '', city = 'Austin, TX', category = 'Commercial & Local Services', limit = 20 }) {
    if (!this.apiKey || this.apiKey.trim() === '') {
      throw new Error('[GeoapifyAdapter] BLOCKED: No API key configured. Configure your Geoapify API key in Settings.');
    }

    // Step 1: Geocode city & country -> place_id
    const locationQuery = [city, state, country].filter(Boolean).join(', ');
    const geocodeReqUrl = `${this.geocodeUrl}?text=${encodeURIComponent(locationQuery)}&apiKey=${this.apiKey}`;
    
    const geocodeRes = await fetch(geocodeReqUrl);
    if (!geocodeRes.ok) {
      const errText = await geocodeRes.text();
      throw new Error(`[GeoapifyAdapter] Geocode failed (HTTP ${geocodeRes.status}): ${errText}`);
    }

    const geocodeData = await geocodeRes.json();
    const placeId = geocodeData.features?.[0]?.properties?.place_id;

    if (!placeId) {
      throw new Error(`[GeoapifyAdapter] Could not resolve coordinates or place_id for "${locationQuery}". Please verify location.`);
    }

    // Step 2: Query places
    const queryCategory = this.mapCategory(category);
    const placesUrl = `${this.baseUrl}?categories=${encodeURIComponent(queryCategory)}&filter=place:${placeId}&limit=${limit}&apiKey=${this.apiKey}`;

    const placesRes = await fetch(placesUrl);
    if (!placesRes.ok) {
      const errText = await placesRes.text();
      throw new Error(`[GeoapifyAdapter] Places API failed (HTTP ${placesRes.status}): ${errText}`);
    }

    const data = await placesRes.json();
    const features = data.features || [];

    return features.map((f, idx) => {
      const p = f.properties || {};
      const placeIdResolved = p.place_id || `geo-${Date.now()}-${idx}`;
      return {
        id: placeIdResolved,
        name: p.name || p.formatted || 'Unnamed Business',
        address: p.formatted || [p.street, p.city, p.state, p.country].filter(Boolean).join(', '),
        city: p.city || city,
        state: p.state || state,
        country: (p.country_code || country).toUpperCase(),
        website: p.website || p.contact?.website || null,
        phone: p.contact?.phone || p.phone || null,
        category: p.categories?.[0] || category,
        source: 'Geoapify Places API',
        sourceUrl: `https://api.geoapify.com/v2/places?id=${placeIdResolved}`,
        lat: p.lat || f.geometry?.coordinates?.[1] || null,
        lng: p.lon || f.geometry?.coordinates?.[0] || null
      };
    });
  }
}
