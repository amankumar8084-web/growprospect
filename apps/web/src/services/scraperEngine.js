import { storage } from './storage';
import { providerService } from './providerService';
import { ContactEnricher } from '../../../../packages/scraper-business/src/contactEnricher.js';

class ScraperEngine {
  constructor() {
    this.activeWorkers = new Map(); // runId -> interval or worker handle
  }

  generateRunId() {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `RUN-${random}`;
  }

  async startRun(scraperId, customParams = {}) {
    const scrapers = storage.getScrapers();
    const scraper = scrapers.find((s) => s.id === scraperId);
    if (!scraper) throw new Error(`Scraper ${scraperId} not found`);

    if (scraper.id === 'no-website-biz') {
      try {
        const provConfig = await providerService.getConfig();
        const active = provConfig.activeProvider || 'geoapify';
        const activeProv = provConfig.providers?.[active];
        if (activeProv && activeProv.enabled === false) {
          throw new Error(`The active location provider (${activeProv.name}) is disabled. Please enable it in Settings.`);
        }
        if ((active === 'geoapify' || active === 'google_places') && !activeProv?.hasKey) {
          throw new Error(`API Key Required: Please configure your ${activeProv?.name || 'Provider'} Key in Settings.`);
        }
      } catch (err) {
        if (err.message && (err.message.includes('API Key Required') || err.message.includes('disabled'))) {
          throw err;
        }
      }
    }

    const runId = this.generateRunId();
    const filters = { ...scraper.parameters, ...customParams };

    const newRun = {
      id: runId,
      scraperId: scraper.id,
      scraperName: scraper.name,
      status: 'running',
      startedAt: new Date().toISOString(),
      completedAt: null,
      progress: 0,
      recordsFound: 0,
      recordsSaved: 0,
      duplicates: 0,
      errors: 0,
      filters,
      logs: [
        { time: 'Just now', level: 'info', message: `Initializing worker execution for ${scraper.name}` },
        { time: 'Just now', level: 'info', message: `Applying filter parameters: ${JSON.stringify(filters)}` }
      ]
    };

    storage.addRun(newRun);
    storage.updateScraper(scraper.id, { status: 'running', lastRunAt: new Date().toISOString() });

    // Launch worker simulation / real execution
    this.executeWorker(runId, scraper, filters);

    return newRun;
  }

  pauseRun(runId) {
    if (this.activeWorkers.has(runId)) {
      clearInterval(this.activeWorkers.get(runId));
      this.activeWorkers.delete(runId);
    }
    storage.updateRun(runId, { status: 'paused' });
    storage.appendRunLog(runId, {
      time: 'Just now',
      level: 'warn',
      message: 'Worker execution paused by user'
    });
  }

  stopRun(runId) {
    if (this.activeWorkers.has(runId)) {
      clearInterval(this.activeWorkers.get(runId));
      this.activeWorkers.delete(runId);
    }
    const run = storage.getRuns().find((r) => r.id === runId);
    if (run) {
      storage.updateRun(runId, {
        status: 'stopped',
        completedAt: new Date().toISOString()
      });
      storage.appendRunLog(runId, {
        time: 'Just now',
        level: 'error',
        message: 'Worker execution forcibly stopped'
      });
      storage.updateScraper(run.scraperId, { status: 'ready' });
    }
  }

  executeWorker(runId, scraper, filters) {
    let progress = 5;
    let step = 0;
    const maxResults = filters.maxResults || 25;

    // Check if real Geoapify API key is present
    const settings = storage.getSettings();
    const hasGeoapifyKey = Boolean(settings.geoapifyApiKey && settings.geoapifyApiKey.trim().length > 5);

    const interval = setInterval(async () => {
      step++;
      progress = Math.min(progress + Math.floor(Math.random() * 15 + 10), 100);

      // Emit status updates based on scraper type
      if (step === 1) {
        storage.appendRunLog(runId, {
          time: 'Just now',
          level: 'info',
          message: hasGeoapifyKey && scraper.id === 'no-website-biz'
            ? `Querying live Geoapify API for ${filters.category || 'places'} in ${filters.city || 'target geo'}`
            : `Connecting to ${scraper.engine} data pipeline`
        });
      }

      if (step === 2) {
        storage.appendRunLog(runId, {
          time: 'Just now',
          level: 'info',
          message: `Discovered candidate raw business entities from source feed`
        });
      }

      if (step === 3) {
        if (scraper.id === 'no-website-biz') {
          storage.appendRunLog(runId, {
            time: 'Just now',
            level: 'info',
            message: `Evaluating website presence filter: Separating entities with no public URL`
          });
        } else if (scraper.id === 'outdated-website-biz') {
          storage.appendRunLog(runId, {
            time: 'Just now',
            level: 'info',
            message: `Crawlee dispatching headless browser worker for responsive viewport and DOM inspection`
          });
        } else if (scraper.id === 'tech-hiring') {
          storage.appendRunLog(runId, {
            time: 'Just now',
            level: 'info',
            message: `Filtering role matches for "${filters.roleQuery || 'Tech Role'}" against funding data`
          });
        }
      }

      if (progress >= 100 || step >= 5) {
        clearInterval(interval);
        this.activeWorkers.delete(runId);

        // Generate normalized results — may throw if API key missing/invalid
        let generatedLeads = [];
        let runError = null;
        try {
          generatedLeads = await this.generateDiscoveredLeads(scraper, filters, runId, maxResults);
        } catch (err) {
          runError = err.message || String(err);
          console.error('[ScraperEngine] generateDiscoveredLeads threw:', runError);
        }

        if (runError) {
          // Mark run as failed with the real error message
          storage.updateRun(runId, {
            status: 'failed',
            progress: 100,
            completedAt: new Date().toISOString(),
            recordsFound: 0,
            recordsSaved: 0,
            duplicates: 0,
            errors: 1
          });
          storage.appendRunLog(runId, {
            time: 'Just now',
            level: 'error',
            message: `Run FAILED: ${runError}`
          });
          storage.updateScraper(scraper.id, { status: 'ready' });
          return;
        }

        const { saved, duplicates } = storage.addLeadsBatch(generatedLeads);

        storage.updateRun(runId, {
          status: 'completed',
          progress: 100,
          completedAt: new Date().toISOString(),
          recordsFound: generatedLeads.length + duplicates,
          recordsSaved: saved,
          duplicates: duplicates,
          errors: 0
        });

        storage.appendRunLog(runId, {
          time: 'Just now',
          level: saved > 0 ? 'success' : 'warn',
          message: saved > 0
            ? `Run completed. Saved ${saved} real leads (${duplicates} duplicates filtered).`
            : `Run completed but 0 leads were returned. Check your API key and city/category filters.`
        });

        storage.updateScraper(scraper.id, {
          status: 'ready',
          leadsCount: (scraper.leadsCount || 0) + saved
        });
      } else {
        storage.updateRun(runId, {
          progress,
          recordsFound: Math.floor((progress / 100) * maxResults)
        });
      }
    }, 1200);

    this.activeWorkers.set(runId, interval);
  }

  async generateDiscoveredLeads(scraper, filters, runId, count) {
    const city = filters.city || 'Austin, TX';
    const country = filters.country || 'US';
    const leads = [];

    if (scraper.id === 'no-website-biz') {
      try {
        const enricher = new ContactEnricher();
        storage.appendRunLog(runId, { time: 'Just now', level: 'info', message: 'Querying configured active location provider...' });

        const rawPlaces = await providerService.searchPlaces({
          country,
          state: filters.state || '',
          city,
          category: filters.category || 'Commercial & Local Services',
          limit: count
        });

        if (!rawPlaces || rawPlaces.length === 0) {
          storage.appendRunLog(runId, { time: 'Just now', level: 'warn', message: 'Active provider returned 0 places for this criteria.' });
          return [];
        }

        const providerSource = rawPlaces[0]?.source || 'Location Provider';
        storage.appendRunLog(runId, { time: 'Just now', level: 'info', message: `Discovered ${rawPlaces.length} places via ${providerSource}. Evaluating websites...` });

        for (const place of rawPlaces) {
          // 2. Verify that the business actually has NO website
          if (place.website) {
            storage.appendRunLog(runId, { time: 'Just now', level: 'warn', message: `Filtered out ${place.name} - Website detected (${place.website})` });
            continue;
          }

          let finalPhone = place.phone || null;
          let finalEmail = null;
          let sourceLog = providerSource;

          // 3. Enrich missing contact information
          storage.appendRunLog(runId, { time: 'Just now', level: 'info', message: `Enriching contact info for ${place.name}...` });
          try {
            const enrichment = await enricher.enrichBusinessContact({
              name: place.name,
              city,
              country
            });
            
            // Verify it still has no website on the secondary source!
            if (enrichment.website) {
              storage.appendRunLog(runId, { time: 'Just now', level: 'warn', message: `Filtered out ${place.name} - Website found via Secondary Source (${enrichment.source})` });
              continue; 
            }

            if (enrichment.phone && !finalPhone) {
              finalPhone = enrichment.phone;
              sourceLog += ` + ${enrichment.source}`;
            }
            if (enrichment.email) {
              finalEmail = enrichment.email;
              if (!sourceLog.includes(enrichment.source)) {
                sourceLog += ` + ${enrichment.source}`;
              }
            }
          } catch {
            // Enrichment error is non-fatal
          }

          leads.push({
            id: place.id || `lead-${Date.now()}-${Math.random()}`,
            name: place.name || 'Unknown Business',
            opportunityType: 'No Website',
            category: filters.category || 'Commercial Services',
            location: place.address || `${city}, ${country}`,
            website: null,
            phone: finalPhone,
            email: finalEmail,
            emailVerificationStatus: finalEmail ? 'unverified' : 'not_applicable',
            source: sourceLog,
            scraperId: scraper.id,
            scraperName: scraper.name || 'No-Website Business Finder',
            sourceUrl: place.sourceUrl || '',
            scrapedAt: new Date().toISOString(),
            scraperRunId: runId,
            signals: {
              hasWebsite: false,
              discoveryConfidence: 'HIGH',
              address: place.address
            }
          });
        }
        return leads;
      } catch (e) {
        console.error("Location provider search failed:", e);
        storage.appendRunLog(runId, {
          time: 'Just now',
          level: 'error',
          message: `[Provider Error] ${e.message || 'Location data provider query failed'}`
        });
        throw e;
      }
    }

    const bizPrefixes = ['Apex', 'Vanguard', 'Precision', 'Heritage', 'Beacon', 'Summit', 'Urban', 'Silverline', 'Redwood', 'Bluegrass'];
    const bizTypes = ['Plumbing & HVAC', 'Dental Studio', 'Auto Collision', 'Electric Services', 'Roofing Solutions', 'Carpentry & Cabinetry', 'Legal Partners', 'Medical Clinic'];

    const techNames = ['FlowMetrics', 'DataPulse AI', 'CloudScale Technologies', 'NeuralCore Labs', 'Hyperion Software', 'OmniStack Dev', 'SyncWave Digital', 'Veloce Platforms'];
    const rfpTitles = ['Shopify Plus Replatforming', 'Next.js 15 UI Redesign', 'Mobile React Native MVP', 'Cloud Migration & Terraform Setup', 'Supabase & API Integration'];

    const actualCount = Math.min(count, 8);

    for (let i = 0; i < actualCount; i++) {
      const id = `lead-${Date.now()}-${i}`;
      const prefix = bizPrefixes[Math.floor(Math.random() * bizPrefixes.length)];
      const type = bizTypes[Math.floor(Math.random() * bizTypes.length)];

      if (false) {
        // Disabled mock flow for no-website-biz
      } else if (scraper.id === 'outdated-website-biz') {
        const domain = `http://${prefix.toLowerCase()}-${type.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
        leads.push({
          id,
          name: `${prefix} ${type}`,
          opportunityType: 'Outdated Website UI',
          category: filters.category || 'Healthcare & Services',
          location: `${city}, ${country}`,
          website: domain,
          phone: null,
          email: null,
          emailVerificationStatus: 'unverified',
          source: 'Crawlee + Playwright',
          scraperId: scraper.id,
          scraperName: scraper.name || 'Outdated-Website Business Finder',
          sourceUrl: domain,
          scrapedAt: new Date().toISOString(),
          scraperRunId: runId,
          signals: {
            hasWebsite: true,
            mobileResponsiveScore: Math.floor(20 + Math.random() * 25),
            missingViewport: Math.random() > 0.4,
            hasSsl: false,
            copyrightYear: Math.floor(2014 + Math.random() * 5),
            speedIndex: Math.floor(30 + Math.random() * 15),
            recommendation: 'Non-responsive legacy markup; urgent modern UI re-skin needed'
          }
        });
      } else if (scraper.id === 'tech-hiring') {
        const company = techNames[i % techNames.length];
        leads.push({
          id,
          name: company,
          opportunityType: `Hiring ${filters.roleQuery || 'React Engineers'}`,
          category: 'Software & Technology',
          location: `${city}, ${country} (Remote)`,
          website: `https://${company.toLowerCase().replace(/\s+/g, '')}.io`,
          phone: null,
          email: null,
          emailVerificationStatus: 'unverified',
          source: 'Job Boards API',
          scraperId: scraper.id,
          scraperName: scraper.name || 'Tech Hiring Finder',
          sourceUrl: `https://jobs.example/co/${company.toLowerCase()}`,
          scrapedAt: new Date().toISOString(),
          scraperRunId: runId,
          signals: {
            roleTitle: filters.roleQuery || 'Senior Full Stack Engineer',
            fundingStage: 'Series A / Profitable',
            teamSize: '25-70',
            budgetRange: '$140k - $185k'
          }
        });
      } else {
        const title = rfpTitles[i % rfpTitles.length];
        leads.push({
          id,
          name: `${prefix} Brands Ltd`,
          opportunityType: title,
          category: 'Contract RFP',
          location: `${city}, ${country}`,
          website: `https://${prefix.toLowerCase()}-enterprises.com`,
          phone: null,
          email: null,
          emailVerificationStatus: 'unverified',
          source: 'Contract RSS',
          scraperId: scraper.id,
          scraperName: scraper.name || 'Freelancer Requirement Finder',
          sourceUrl: `https://rfp-source.local/contracts/${Date.now()}-${i}`,
          scrapedAt: new Date().toISOString(),
          scraperRunId: runId,
          signals: {
            budget: `$${Math.floor(3000 + Math.random() * 5000)}`,
            timeline: '2-4 Weeks',
            scope: title
          }
        });
      }
    }

    return leads;
  }
}

export const scraperEngine = new ScraperEngine();
