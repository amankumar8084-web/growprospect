/**
 * Geoapify Places API Client
 * STRICT MODE: No fallback, no simulated data, no silent failures.
 * If the API is unavailable or the key is invalid, throws an explicit error.
 */

export class GeoapifyClient {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.GEOAPIFY_API_KEY || null;
    this.baseUrl = 'https://api.geoapify.com/v2/places';
  }

  /**
   * Discovers REAL places from the live Geoapify Places API.
   * NEVER returns simulated, fallback, or cached data.
   * Throws explicitly on API failure.
   *
   * @param {Object} params
   * @param {string} params.country Country code (e.g. 'US', 'GB')
   * @param {string} params.city City name (e.g. 'Austin, TX')
   * @param {string} params.category Place category filter
   * @param {number} [params.limit=20] Max places to fetch
   * @returns {Promise<Object[]>} Real places from Geoapify API
   */
  async searchPlaces({ country = 'US', city = 'Austin, TX', category = 'commercial.services', limit = 20 }) {
    if (!this.apiKey) {
      throw new Error('[GeoapifyClient] BLOCKED: No API key configured. Add your Geoapify key in Settings.');
    }

    // Step 1: Geocode city → place_id
    const geocodeUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(`${city}, ${country}`)}&apiKey=${this.apiKey}`;
    console.log(`[GeoapifyClient] Geocoding: ${city}, ${country}`);

    const geocodeRes = await fetch(geocodeUrl);
    console.log(`[GeoapifyClient] Geocode HTTP status: ${geocodeRes.status}`);
    if (!geocodeRes.ok) {
      const errText = await geocodeRes.text();
      throw new Error(`[GeoapifyClient] Geocode failed (HTTP ${geocodeRes.status}): ${errText}`);
    }

    const geocodeData = await geocodeRes.json();
    const placeId = geocodeData.features?.[0]?.properties?.place_id;

    if (!placeId) {
      throw new Error(`[GeoapifyClient] Could not resolve place_id for "${city}, ${country}". Check city name.`);
    }
    console.log(`[GeoapifyClient] Resolved place_id: ${placeId}`);

    // Step 2: Query places using place_id
    const queryCategory = this.mapCategory(category);
    const url = `${this.baseUrl}?categories=${encodeURIComponent(queryCategory)}&filter=place:${placeId}&limit=${limit}&apiKey=${this.apiKey}`;
    console.log(`[GeoapifyClient] Fetching places: category=${queryCategory}, limit=${limit}`);

    const response = await fetch(url);
    console.log(`[GeoapifyClient] Places HTTP status: ${response.status}`);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`[GeoapifyClient] Places API failed (HTTP ${response.status}): ${errText}`);
    }

    const data = await response.json();
    const features = data.features || [];
    console.log(`[GeoapifyClient] Real results returned: ${features.length} places`);

    if (features.length === 0) {
      console.warn(`[GeoapifyClient] API returned 0 results for "${city}, ${country}" / category "${queryCategory}". No leads will be generated.`);
    }

    return this.normalizeGeoapifyFeatures(features);
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

  normalizeGeoapifyFeatures(features) {
    return features.map((f, idx) => {
      const p = f.properties || {};
      return {
        id: p.place_id || `geo-real-${Date.now()}-${idx}`,
        name: p.name || p.formatted || 'Unnamed Business',
        address: p.formatted || `${p.street || ''}, ${p.city || ''}`,
        city: p.city,
        country: p.country_code?.toUpperCase(),
        website: p.website || p.contact?.website || null,
        phone: p.contact?.phone || p.phone || null,
        category: p.categories?.[0] || 'commercial.services',
        source: 'Geoapify Places API (LIVE)',
        sourceUrl: `https://api.geoapify.com/v2/places?id=${p.place_id || 'unknown'}`
      };
    });
  }
}

