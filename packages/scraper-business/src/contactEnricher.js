export class ContactEnricher {
  /**
   * Searches for a business by name and location using OpenStreetMap Nominatim API.
   * @param {Object} business 
   * @param {string} business.name
   * @param {string} business.city
   * @param {string} business.country
   */
  async enrichBusinessContact(business) {
    const query = `${business.name} ${business.city} ${business.country}`;
    const searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&extratags=1`;

    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'LeadDiscoveryApp/1.0 (test@example.com)'
        }
      });
      
      if (!response.ok) {
        return { phone: null, email: null, website: null, source: null };
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        const place = data[0]; // Best match
        
        // Basic validation: verify the name matches at least partially
        const nameParts = business.name.toLowerCase().split(' ').filter(p => p.length > 2);
        const placeName = (place.name || '').toLowerCase();
        
        const isSameBusiness = nameParts.some(part => placeName.includes(part));
        
        if (isSameBusiness && place.extratags) {
          return {
            phone: place.extratags.phone || place.extratags['contact:phone'] || null,
            email: place.extratags.email || place.extratags['contact:email'] || null,
            website: place.extratags.website || place.extratags['contact:website'] || null,
            source: 'OSM Nominatim Directory'
          };
        }
      }
      
      return { phone: null, email: null, website: null, source: null };
    } catch (error) {
      console.warn(`[ContactEnricher] Failed to enrich ${business.name}: ${error.message}`);
      return { phone: null, email: null, website: null, source: null };
    }
  }
}
