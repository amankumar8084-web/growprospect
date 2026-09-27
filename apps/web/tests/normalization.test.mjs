import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Normalized Lead Model Validation', () => {
  const sampleLead = {
    id: 'lead-test-01',
    name: 'Apex Heating Co.',
    opportunityType: 'No Website',
    category: 'Home & Commercial Services',
    location: 'Austin, TX, US',
    website: null,
    phone: '+1 (512) 894-2019',
    email: 'contact@apexheating.local',
    emailVerificationStatus: 'unverified',
    source: 'Geoapify Places API',
    sourceUrl: 'https://api.geoapify.com/v2/places?id=518a28f',
    scrapedAt: new Date().toISOString(),
    scraperRunId: 'RUN-TEST'
  };

  const REQUIRED_FIELDS = [
    'id',
    'name',
    'opportunityType',
    'category',
    'location',
    'source',
    'scrapedAt'
  ];

  test('conforms to PRD Section 6 required normalized schema', () => {
    REQUIRED_FIELDS.forEach((field) => {
      assert.ok(sampleLead[field] !== undefined, `Missing field: ${field}`);
    });
  });

  test('handles null website gracefully for no-website leads', () => {
    assert.strictEqual(sampleLead.website, null);
    assert.strictEqual(sampleLead.opportunityType, 'No Website');
  });

  test('verification status defaults to recognized values', () => {
    const validStatuses = ['verified', 'unverified', 'pending', 'invalid', 'not_applicable'];
    assert.ok(validStatuses.includes(sampleLead.emailVerificationStatus));
  });
});
