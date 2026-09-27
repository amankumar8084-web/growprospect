import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

// Mock localStorage for Node environment tests
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  clear() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
}

global.window = {};
global.localStorage = new LocalStorageMock();

describe('Lead Filtering & Permanent Deletion Validation', async () => {
  const { storage } = await import('../src/services/storage.js');

  const testLeads = [
    {
      id: 'lead-geo-1',
      name: 'Austin Plumbers Co.',
      category: 'Commercial Services',
      location: 'Austin, TX',
      website: null,
      source: 'Geoapify Places API',
      scraperId: 'no-website-biz',
      scraperName: 'No-Website Business Finder',
      opportunityType: 'No Website'
    },
    {
      id: 'lead-gplaces-2',
      name: 'Downtown Dental Clinic',
      category: 'Healthcare',
      location: 'Austin, TX',
      website: null,
      source: 'Google Maps / Places API',
      scraperId: 'no-website-biz',
      scraperName: 'No-Website Business Finder',
      opportunityType: 'No Website'
    },
    {
      id: 'lead-osm-3',
      name: 'Capitol Auto Repair',
      category: 'Automotive',
      location: 'Austin, TX',
      website: null,
      source: 'OpenStreetMap (Nominatim)',
      scraperId: 'no-website-biz',
      scraperName: 'No-Website Business Finder',
      opportunityType: 'No Website'
    },
    {
      id: 'lead-outdated-4',
      name: 'Vintage Bakery Cafe',
      category: 'Restaurant',
      location: 'Chicago, IL',
      website: 'http://vintage-bakery-chicago.com',
      source: 'Crawlee + Playwright',
      scraperId: 'outdated-website-biz',
      scraperName: 'Outdated-Website Business Finder',
      opportunityType: 'Outdated Website UI'
    },
    {
      id: 'lead-tech-5',
      name: 'NovaCloud AI',
      category: 'Software & Technology',
      location: 'San Francisco, CA',
      website: 'https://novacloud.io',
      source: 'Job Boards API',
      scraperId: 'tech-hiring',
      scraperName: 'Tech Hiring Finder',
      opportunityType: 'Hiring React Engineers'
    }
  ];

  beforeEach(() => {
    global.localStorage.clear();
    storage.resetAll();
    storage.addLeadsBatch(testLeads);
  });

  test('successfully filters leads by exact scraper engine', () => {
    const allLeads = storage.getLeads();
    const noWebsiteLeads = allLeads.filter(l => l.scraperId === 'no-website-biz');
    const outdatedLeads = allLeads.filter(l => l.scraperId === 'outdated-website-biz');
    const techHiringLeads = allLeads.filter(l => l.scraperId === 'tech-hiring');

    assert.strictEqual(noWebsiteLeads.length, 3);
    assert.strictEqual(outdatedLeads.length, 1);
    assert.strictEqual(techHiringLeads.length, 1);
  });

  test('successfully filters leads by exact API provider / key source', () => {
    const allLeads = storage.getLeads();
    const googleLeads = allLeads.filter(l => l.source === 'Google Maps / Places API');
    const geoapifyLeads = allLeads.filter(l => l.source === 'Geoapify Places API');
    const osmLeads = allLeads.filter(l => l.source === 'OpenStreetMap (Nominatim)');
    const crawleeLeads = allLeads.filter(l => l.source === 'Crawlee + Playwright');

    assert.strictEqual(googleLeads.length, 1);
    assert.strictEqual(geoapifyLeads.length, 1);
    assert.strictEqual(osmLeads.length, 1);
    assert.strictEqual(crawleeLeads.length, 1);
    assert.strictEqual(googleLeads[0].name, 'Downtown Dental Clinic');
  });

  test('permanently deletes a single lead and updates counts', () => {
    const beforeCount = storage.getLeads().length;
    assert.strictEqual(beforeCount, 5);

    const remaining = storage.deleteLead('lead-gplaces-2');
    assert.strictEqual(remaining.length, 4);
    assert.strictEqual(remaining.some(l => l.id === 'lead-gplaces-2'), false);

    // Verify persistence in localStorage
    const persisted = storage.getLeads();
    assert.strictEqual(persisted.length, 4);
    assert.strictEqual(persisted.some(l => l.id === 'lead-gplaces-2'), false);
  });

  test('permanently deletes multiple selected leads via bulk delete', () => {
    const idsToDelete = ['lead-geo-1', 'lead-osm-3', 'lead-tech-5'];
    const remaining = storage.deleteLeads(idsToDelete);

    assert.strictEqual(remaining.length, 2);
    assert.strictEqual(remaining.some(l => idsToDelete.includes(l.id)), false);

    const persisted = storage.getLeads();
    assert.strictEqual(persisted.length, 2);
  });

  test('clearAllLeads permanently wipes all leads and resets counts', () => {
    storage.clearAllLeads();
    assert.strictEqual(storage.getLeads().length, 0);

    const scrapers = storage.getScrapers();
    scrapers.forEach(s => {
      assert.strictEqual(s.leadsCount, 0);
    });
  });
});
