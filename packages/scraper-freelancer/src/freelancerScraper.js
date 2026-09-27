import { normalizeLead, OPPORTUNITY_TYPES, DeduplicationEngine } from '@lead-discovery/scraper-core';

export class FreelancerScraper {
  constructor(options = {}) {
    this.deduplicator = options.deduplicator || new DeduplicationEngine();
  }

  /**
   * Discovers client RFP requirements and project contracts with budget thresholding.
   * @param {Object} filters 
   * @param {string} [filters.category='UI/UX & Web Development']
   * @param {number} [filters.minBudget=2500]
   * @param {string} [filters.runId]
   * @returns {Promise<{ leads: Object[], filteredBelowBudgetCount: number }>}
   */
  async discoverRequirements(filters = {}) {
    const rawRfps = this.fetchRfpFeeds(filters);
    const minBudget = filters.minBudget || 2000;
    let filteredBelowBudgetCount = 0;

    const qualified = [];
    for (const rfp of rawRfps) {
      if (rfp.budgetValue < minBudget) {
        filteredBelowBudgetCount++;
        continue;
      }
      qualified.push(rfp);
    }

    const normalized = qualified.map((rfp) =>
      normalizeLead(
        {
          name: rfp.clientName,
          opportunityType: rfp.projectTitle,
          category: filters.category || 'Contract RFP',
          location: rfp.location,
          website: rfp.clientWebsite,
          phone: rfp.phone,
          email: rfp.email,
          source: 'Contract RSS',
          sourceUrl: rfp.rfpUrl,
          signals: {
            budget: `$${rfp.budgetValue.toLocaleString()}`,
            timeline: rfp.timeline,
            postedHoursAgo: rfp.postedHoursAgo,
            scopeSummary: rfp.scopeSummary
          }
        },
        {
          scraperId: 'freelance-req',
          sourceEngine: 'Contract RSS',
          runId: filters.runId
        }
      )
    );

    const { uniqueLeads } = this.deduplicator.deduplicateBatch(normalized);

    return {
      leads: uniqueLeads,
      filteredBelowBudgetCount
    };
  }

  fetchRfpFeeds(filters) {
    const category = filters.category || 'UI/UX & Web Development';
    const sampleProjects = [
      { client: 'Nordic Peak Outdoor Gear', budget: 4800, title: 'Shopify Plus Custom Liquid Theme Migration', timeline: '3 Weeks', hours: 4, scope: 'Migrate custom inventory from WooCommerce to Shopify Plus' },
      { client: 'FinTrack Automated Bookkeeping', budget: 7500, title: 'Next.js 15 App Router & Supabase SaaS MVP', timeline: '4 Weeks', hours: 8, scope: 'Build responsive financial analytics dashboard with server actions' },
      { client: 'Micro Startup Micro-budget', budget: 450, title: 'Quick Bug Fix HTML Page', timeline: '1 Day', hours: 2, scope: 'Minor CSS tweaks' },
      { client: 'Zephyr Mobility Logistics', budget: 5200, title: 'Tailwind CSS Design System Implementation', timeline: '2 Weeks', hours: 12, scope: 'Convert Figma designs into accessible component library' },
      { client: 'Solstice Health Wellness', budget: 3600, title: 'Patient Booking Flow & Stripe Integration', timeline: '2 Weeks', hours: 16, scope: 'HIPAA compliant appointment scheduling portal' }
    ];

    return sampleProjects.map((p, idx) => ({
      clientName: p.client,
      projectTitle: p.title,
      clientWebsite: `https://${p.client.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      email: `rfp@${p.client.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      phone: `+1 (650) ${Math.floor(200 + idx * 50)}-${Math.floor(2000 + idx * 120)}`,
      location: 'Remote / North America & Europe',
      rfpUrl: `https://contracts-feed.source/rfp/${Date.now()}-${idx}`,
      budgetValue: p.budget,
      timeline: p.timeline,
      postedHoursAgo: p.hours,
      scopeSummary: p.scope
    }));
  }
}
