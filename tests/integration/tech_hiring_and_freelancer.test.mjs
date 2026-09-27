import { test, describe } from 'node:test';
import assert from 'node:assert';
import { TechHiringScraper } from '../../packages/scraper-hiring/src/index.js';
import { FreelancerScraper } from '../../packages/scraper-freelancer/src/index.js';

describe('Tech Hiring & Freelancer Requirements Scrapers', () => {
  test('TechHiringScraper filters roles and applies enterprise exclusion', async () => {
    const scraper = new TechHiringScraper();

    // Run with enterprise exclusion enabled
    const resultWithExclusion = await scraper.discoverHiring({
      roleQuery: 'React, Node.js',
      excludeEnterprise: true
    });

    assert.ok(resultWithExclusion.leads.length > 0);
    assert.ok(resultWithExclusion.filteredEnterpriseCount > 0, 'Enterprise MNCs should be filtered out');

    resultWithExclusion.leads.forEach((lead) => {
      assert.ok(lead.opportunityType.includes('Hiring'));
      assert.ok(lead.email !== null || lead.website !== null);
    });
  });

  test('FreelancerScraper threshold filters projects below minimum budget', async () => {
    const scraper = new FreelancerScraper();

    const result = await scraper.discoverRequirements({
      category: 'UI/UX & Web Development',
      minBudget: 3000
    });

    assert.ok(result.leads.length > 0);
    assert.ok(result.filteredBelowBudgetCount > 0, 'Micro-budget tasks (<$3000) should be filtered');

    result.leads.forEach((lead) => {
      assert.strictEqual(lead.category, 'UI/UX & Web Development');
      const budgetNum = parseInt(lead.signals.budget.replace(/[^0-9]/g, ''), 10);
      assert.ok(budgetNum >= 3000, `Budget must meet or exceed $3000, got: ${budgetNum}`);
    });
  });
});
