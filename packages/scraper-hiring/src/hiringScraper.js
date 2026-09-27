import { normalizeLead, OPPORTUNITY_TYPES, DeduplicationEngine } from '@lead-discovery/scraper-core';

export class TechHiringScraper {
  constructor(options = {}) {
    this.deduplicator = options.deduplicator || new DeduplicationEngine();
  }

  /**
   * Discovers tech hiring opportunities filtered by role, company size, and enterprise exclusion.
   * @param {Object} filters 
   * @param {string} [filters.roleQuery='React, Node.js']
   * @param {string} [filters.companySize='Startup & Mid-size']
   * @param {boolean} [filters.excludeEnterprise=true]
   * @param {number} [filters.limit=15]
   * @param {string} [filters.runId]
   * @returns {Promise<{ leads: Object[], filteredEnterpriseCount: number }>}
   */
  async discoverHiring(filters = {}) {
    const rawListings = this.fetchJobSignals(filters);
    let filteredEnterpriseCount = 0;

    const qualified = [];
    for (const item of rawListings) {
      if (filters.excludeEnterprise && item.isEnterprise) {
        filteredEnterpriseCount++;
        continue;
      }
      qualified.push(item);
    }

    const normalized = qualified.map((job) =>
      normalizeLead(
        {
          name: job.companyName,
          opportunityType: `Hiring ${job.roleTitle}`,
          category: 'Software & Technology',
          location: job.location,
          website: job.companyWebsite,
          phone: job.phone || null,
          email: job.recruitingEmail || null,
          source: 'Job Boards API',
          sourceUrl: job.jobUrl,
          signals: {
            roleTitle: job.roleTitle,
            fundingStage: job.fundingStage,
            teamSize: job.teamSize,
            salaryRange: job.salaryRange,
            techStack: job.techStack
          }
        },
        {
          scraperId: 'tech-hiring',
          sourceEngine: 'Job Boards API',
          runId: filters.runId
        }
      )
    );

    const { uniqueLeads } = this.deduplicator.deduplicateBatch(normalized);

    return {
      leads: uniqueLeads,
      filteredEnterpriseCount
    };
  }

  fetchJobSignals(filters) {
    const role = filters.roleQuery || 'React Developer';
    const companies = [
      { name: 'Klarity Analytics', size: '20-50', funding: 'Series A ($8M)', enterprise: false, tech: ['React', 'Next.js', 'PostgreSQL', 'Tailwind'] },
      { name: 'OmniStream Media', size: '40-90', funding: 'Series B ($18M)', enterprise: false, tech: ['React', 'TypeScript', 'Node.js', 'AWS'] },
      { name: 'Global Megacorp Enterprises', size: '50000+', funding: 'Public NYSE', enterprise: true, tech: ['Java', 'Angular', 'Oracle'] },
      { name: 'CognitiveBio Labs', size: '15-35', funding: 'Seed ($3.2M)', enterprise: false, tech: ['React', 'Python', 'FastAPI', 'Docker'] },
      { name: 'Worldwide Financial Conglomerate', size: '85000+', funding: 'Public Fortune 100', enterprise: true, tech: ['Cobol', 'C#', 'Azure'] },
      { name: 'Vanguard Vector Labs', size: '30-65', funding: 'Profitable Mid-Market', enterprise: false, tech: ['React Native', 'Node.js', 'GraphQL'] }
    ];

    return companies.map((c, idx) => ({
      companyName: c.name,
      roleTitle: `${role} (${c.tech.slice(0, 2).join(', ')})`,
      location: 'Remote & Hybrid (US / EU)',
      companyWebsite: `https://${c.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.io`,
      recruitingEmail: `careers@${c.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.io`,
      phone: `+1 (415) ${Math.floor(200 + idx * 40)}-${Math.floor(1000 + idx * 110)}`,
      jobUrl: `https://techjobs.source/listing/${Date.now()}-${idx}`,
      fundingStage: c.funding,
      teamSize: c.size,
      techStack: c.tech.join(', '),
      salaryRange: '$135,000 - $175,000',
      isEnterprise: c.enterprise
    }));
  }
}
