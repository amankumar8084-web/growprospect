import { ProviderFactory } from './providers/ProviderFactory.js';
import { GeoapifyAdapter } from './providers/GeoapifyAdapter.js';
import { DeduplicationEngine, normalizeLead, OPPORTUNITY_TYPES } from '@lead-discovery/scraper-core';

export class BusinessScraper {
  constructor(options = {}) {
    if (options.provider) {
      this.provider = options.provider;
    } else if (options.providerConfig) {
      this.provider = ProviderFactory.getActiveProvider(options.providerConfig);
    } else {
      this.provider = new GeoapifyAdapter({ apiKey: options.apiKey });
    }
    this.deduplicator = options.deduplicator || new DeduplicationEngine();
  }

  /**
   * Discovers local businesses and separates No-Website leads from leads with websites.
   * @param {Object} filters
   * @param {string} filters.country Country code
   * @param {string} [filters.state] State name or code
   * @param {string} filters.city City name
   * @param {string} filters.category Business category
   * @param {number} [filters.limit=20]
   * @param {string} [filters.runId]
   * @returns {Promise<{ noWebsiteLeads: Object[], websiteLeads: Object[], totalDiscovered: number, duplicates: number }>}
   */
  async runDiscovery(filters = {}) {
    // 1. Discovery via configured active provider
    const rawPlaces = await this.provider.searchPlaces({
      country: filters.country || 'US',
      state: filters.state || '',
      city: filters.city || 'Austin, TX',
      category: filters.category || 'Commercial & Local Services',
      limit: filters.limit || 20
    });

    // 2. Normalization
    const sourceEngine = this.provider.name || 'Location Provider API';
    const normalized = rawPlaces.map((place) =>
      normalizeLead(place, {
        sourceEngine,
        scraperId: 'no-website-biz',
        runId: filters.runId
      })
    );

    // 3. Deduplication
    const { uniqueLeads, duplicateCount } = this.deduplicator.deduplicateBatch(normalized);

    // 4. Separation: No-Website leads vs. Website Leads (per PRD flow)
    const noWebsiteLeads = [];
    const websiteLeads = [];

    for (const lead of uniqueLeads) {
      if (!lead.website) {
        lead.opportunityType = OPPORTUNITY_TYPES.NO_WEBSITE;
        lead.signals = {
          hasWebsite: false,
          discoveryConfidence: 'HIGH',
          verifiedPhysicalPlace: true
        };
        noWebsiteLeads.push(lead);
      } else {
        websiteLeads.push(lead);
      }
    }

    return {
      noWebsiteLeads,
      websiteLeads,
      totalDiscovered: rawPlaces.length,
      duplicates: duplicateCount
    };
  }
}
