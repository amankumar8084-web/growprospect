import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Deterministic Deduplication Engine', () => {
  const existingLeads = [
    {
      id: 'lead-1',
      name: 'Apex Plumbing Co.',
      location: 'Austin, TX, US',
      website: 'http://apexplumbing.com',
      phone: '+1 (512) 894-2019'
    }
  ];

  function isDuplicate(lead, existingList) {
    const normalizedNewName = lead.name.toLowerCase().trim();
    return existingList.some((existing) => {
      const existingName = existing.name.toLowerCase().trim();
      if (existingName === normalizedNewName) return true;
      if (lead.website && existing.website) {
        const cleanA = lead.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
        const cleanB = existing.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
        if (cleanA === cleanB) return true;
      }
      if (lead.phone && existing.phone) {
        const digitsA = lead.phone.replace(/\D/g, '').slice(-10);
        const digitsB = existing.phone.replace(/\D/g, '').slice(-10);
        if (digitsA && digitsB && digitsA.length >= 7 && digitsA === digitsB) return true;
      }
      return false;
    });
  }

  test('detects exact name match', () => {
    const candidate = {
      name: 'apex plumbing co. ',
      location: 'Austin, TX, US',
      website: null,
      phone: null
    };
    assert.strictEqual(isDuplicate(candidate, existingLeads), true);
  });

  test('detects duplicate by normalized website URL', () => {
    const candidate = {
      name: 'Different Name Plumbers',
      location: 'Austin, TX, US',
      website: 'https://www.apexplumbing.com/',
      phone: null
    };
    assert.strictEqual(isDuplicate(candidate, existingLeads), true);
  });

  test('detects duplicate by normalized phone digits', () => {
    const candidate = {
      name: 'Completely New Entity',
      location: 'Dallas, TX',
      website: null,
      phone: '512-894-2019'
    };
    assert.strictEqual(isDuplicate(candidate, existingLeads), true);
  });

  test('allows unique lead', () => {
    const candidate = {
      name: 'Summit Solar Solutions',
      location: 'Denver, CO, US',
      website: 'https://summitsolar.com',
      phone: '+1 (303) 555-0199'
    };
    assert.strictEqual(isDuplicate(candidate, existingLeads), false);
  });
});
