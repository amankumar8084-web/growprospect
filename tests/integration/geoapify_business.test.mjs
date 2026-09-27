import 'dotenv/config';
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { BusinessScraper } from '../../packages/scraper-business/src/businessScraper.js';
import { DeduplicationEngine, OPPORTUNITY_TYPES } from '../../packages/scraper-core/src/index.js';

describe('Geoapify Business Discovery & Enrichment Pipeline', () => {
  // Provider fixture conforming to Geoapify contract
  const sampleGeoapifyProvider = {
    name: 'Geoapify Places API',
    async searchPlaces() {
      return [
        {
          id: 'geo-1',
          name: 'Austin Dental Clinic',
          address: '123 Main St, Austin, TX',
          city: 'Austin',
          country: 'US',
          website: null,
          phone: '512-555-0100',
          category: 'healthcare',
          source: 'Geoapify Places API',
          sourceUrl: 'https://api.geoapify.com/v2/places?id=geo-1'
        },
        {
          id: 'geo-2',
          name: 'Austin Tech Repair',
          address: '456 Oak St, Austin, TX',
          city: 'Austin',
          country: 'US',
          website: 'https://austintechrepair.com',
          phone: '512-555-0200',
          category: 'commercial.services',
          source: 'Geoapify Places API',
          sourceUrl: 'https://api.geoapify.com/v2/places?id=geo-2'
        }
      ];
    }
  };

  test('separates no-website leads from enrichable website leads', async () => {
    const deduplicator = new DeduplicationEngine();
    const scraper = new BusinessScraper({ provider: sampleGeoapifyProvider, deduplicator });

    const result = await scraper.runDiscovery({
      country: 'US',
      city: 'Austin, TX',
      category: 'Commercial & Local Services',
      limit: 10,
      runId: 'RUN-TEST-001'
    });

    assert.ok(result.totalDiscovered > 0, 'Total discovered places should be greater than 0');
    assert.ok(result.noWebsiteLeads.length > 0, 'Should isolate No-Website leads');

    // Verify all No-Website leads lack a website
    result.noWebsiteLeads.forEach((lead) => {
      assert.strictEqual(lead.website, null, 'No-website lead must have null website');
      assert.strictEqual(lead.opportunityType, OPPORTUNITY_TYPES.NO_WEBSITE);
      assert.strictEqual(lead.source, 'Geoapify Places API');
      assert.ok(lead.location.includes('Austin'), 'Location must preserve target city');
    });

    // Verify website leads retain their web link for Crawlee enrichment
    result.websiteLeads.forEach((lead) => {
      assert.ok(lead.website && lead.website.length > 0, 'Website leads must have valid URL');
    });
  });

  test('deterministic deduplication prevents duplicate entities', async () => {
    const deduplicator = new DeduplicationEngine();
    const scraper = new BusinessScraper({ provider: sampleGeoapifyProvider, deduplicator });

    // First discovery run
    const run1 = await scraper.runDiscovery({ city: 'Austin, TX', limit: 5 });
    // Second discovery run with identical dataset
    const run2 = await scraper.runDiscovery({ city: 'Austin, TX', limit: 5 });

    assert.ok(run2.duplicates > 0, 'Second run must catch duplicate entities');
  });
});
