import 'dotenv/config';
import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  BaseLocationProvider,
  GeoapifyAdapter,
  GooglePlacesAdapter,
  OpenStreetMapAdapter,
  ProviderFactory,
  PROVIDER_TYPES,
  BusinessScraper
} from '../../packages/scraper-business/src/index.js';

describe('Location Provider Architecture & Adapters', () => {
  test('BaseLocationProvider requires subclasses to implement methods', async () => {
    const base = new BaseLocationProvider('test', 'Test Provider');
    await assert.rejects(async () => {
      await base.searchPlaces();
    }, /must be implemented/);
    await assert.rejects(async () => {
      await base.testConnection();
    }, /must be implemented/);
  });

  test('ProviderFactory instantiates correct adapter types', () => {
    const geo = ProviderFactory.create(PROVIDER_TYPES.GEOAPIFY, { apiKey: 'test' });
    assert.ok(geo instanceof GeoapifyAdapter);

    const google = ProviderFactory.create(PROVIDER_TYPES.GOOGLE_PLACES, { apiKey: 'test' });
    assert.ok(google instanceof GooglePlacesAdapter);

    const osm = ProviderFactory.create(PROVIDER_TYPES.OSM, {});
    assert.ok(osm instanceof OpenStreetMapAdapter);
  });

  test('ProviderFactory resolves active provider and enforces disabled state', () => {
    const config = {
      activeProvider: 'osm',
      providers: {
        osm: { enabled: true, endpoint: 'https://nominatim.openstreetmap.org/search' }
      }
    };
    const active = ProviderFactory.getActiveProvider(config);
    assert.ok(active instanceof OpenStreetMapAdapter);

    const disabledConfig = {
      activeProvider: 'google_places',
      providers: {
        google_places: { enabled: false, apiKey: 'test' }
      }
    };
    assert.throws(() => {
      ProviderFactory.getActiveProvider(disabledConfig);
    }, /disabled/);
  });

  test('OpenStreetMapAdapter tests connection and discovers live normalized places', async () => {
    const osm = new OpenStreetMapAdapter();
    const testResult = await osm.testConnection();
    assert.strictEqual(testResult.success, true);
    assert.ok(testResult.latencyMs >= 0);

    const places = await osm.searchPlaces({
      country: 'US',
      city: 'Austin, TX',
      category: 'bakery',
      limit: 3
    });

    assert.ok(Array.isArray(places));
    if (places.length > 0) {
      const p = places[0];
      assert.ok(p.id, 'Place must have an ID');
      assert.ok(p.name, 'Place must have a name');
      assert.ok(p.address, 'Place must have an address');
      assert.strictEqual(p.source, 'OpenStreetMap (Nominatim)');
      assert.strictEqual(typeof p.website, 'object'); // null or string
    }
  });

  test('GooglePlacesAdapter strictly rejects invalid API keys with clear error', async () => {
    const google = new GooglePlacesAdapter({ apiKey: 'INVALID_TEST_KEY_12345' });
    const result = await google.testConnection();
    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('REQUEST_DENIED') || result.message.includes('Google Places'));
  });

  test('BusinessScraper works with any configured location provider', async () => {
    const osmProvider = new OpenStreetMapAdapter();
    const scraper = new BusinessScraper({ provider: osmProvider });

    const discovery = await scraper.runDiscovery({
      country: 'US',
      city: 'Austin, TX',
      category: 'bakery',
      limit: 3,
      runId: 'RUN-TEST-OSM'
    });

    assert.ok(discovery.totalDiscovered >= 0);
    assert.ok(Array.isArray(discovery.noWebsiteLeads));
    assert.ok(Array.isArray(discovery.websiteLeads));

    discovery.noWebsiteLeads.forEach((lead) => {
      assert.strictEqual(lead.website, null);
      assert.strictEqual(lead.source, 'OpenStreetMap (Nominatim)');
    });
  });
});
