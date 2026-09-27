// Configuration for scrapers (clean state with 0 dummy leads/runs)

export const INITIAL_SCRAPERS = [
  {
    id: 'no-website-biz',
    name: 'No-Website Business Finder',
    shortDescription: 'Discover brick-and-mortar & local businesses lacking an online web presence.',
    engine: 'Geoapify Places API',
    engineBadge: 'Geoapify API',
    status: 'ready',
    color: '#111111',
    category: 'Business Discovery',
    supportedCountries: ['US', 'GB', 'CA', 'AU', 'DE', 'IN'],
    defaultCity: 'Austin, TX',
    defaultCategories: ['catering.restaurant', 'service.carpenter', 'healthcare.dentist', 'service.plumber', 'commercial.automotive'],
    leadsCount: 0,
    lastRunAt: null,
    parameters: {
      country: 'US',
      city: 'Austin, TX',
      category: 'Commercial & Local Services',
      maxResults: 25,
      skipWithWebsite: true
    }
  },
  {
    id: 'outdated-website-biz',
    name: 'Outdated-Website Business Finder',
    shortDescription: 'Crawl business websites and detect non-responsive, slow, or outdated web presences.',
    engine: 'Crawlee + Playwright',
    engineBadge: 'Crawlee + Playwright',
    status: 'ready',
    color: '#EA4B0B',
    category: 'Website Auditing',
    supportedCountries: ['US', 'GB', 'DE'],
    defaultCity: 'Chicago, IL',
    defaultCategories: ['healthcare.clinic', 'service.beauty_salon', 'catering.bar', 'commercial.retail'],
    leadsCount: 0,
    lastRunAt: null,
    parameters: {
      country: 'US',
      city: 'Chicago, IL',
      category: 'Healthcare & Dental',
      maxResults: 25,
      minSpeedIndex: 45,
      checkMobileViewport: true,
      checkSsl: true
    }
  },
  {
    id: 'tech-hiring',
    name: 'Tech Hiring Finder',
    shortDescription: 'Identify funded startups and tech companies actively hiring for modern engineering roles.',
    engine: 'Public Job Feeds & Web Adapters',
    engineBadge: 'Job Boards API',
    status: 'ready',
    color: '#111111',
    category: 'Hiring & Talent',
    supportedCountries: ['US', 'Remote', 'GB', 'DE'],
    defaultCity: 'San Francisco, CA',
    defaultCategories: ['Full Stack Engineer', 'React Developer', 'DevOps / Cloud', 'AI / ML Engineer'],
    leadsCount: 0,
    lastRunAt: null,
    parameters: {
      roleQuery: 'React, Node.js, Cloud',
      companySize: 'Startup & Mid-size',
      excludeEnterprise: true,
      geo: 'Remote & US',
      maxResults: 20
    }
  },
  {
    id: 'freelance-req',
    name: 'Freelancer Requirement Finder',
    shortDescription: 'Aggregate high-budget public client RFPs, contract proposals, and freelance listings.',
    engine: 'Public RFP Feeds & RSS',
    engineBadge: 'Contract RSS',
    status: 'ready',
    color: '#8A8A8A',
    category: 'Contract RFP',
    supportedCountries: ['Global', 'US', 'EU'],
    defaultCity: 'Global Remote',
    defaultCategories: ['Web Development', 'UI/UX Redesign', 'API Integration', 'Mobile App'],
    leadsCount: 0,
    lastRunAt: null,
    parameters: {
      category: 'UI/UX & Web Development',
      minBudget: 2500,
      postedWithinHours: 24,
      maxResults: 15
    }
  }
];

// Clean initial runs — zero dummy data
export const INITIAL_RUNS = [];

// Clean initial leads — zero dummy data
export const INITIAL_LEADS = [];
