import { INITIAL_SCRAPERS, INITIAL_RUNS, INITIAL_LEADS } from '../data/seedData';

const STORAGE_KEYS = {
  SCRAPERS: 'scrape_core_scrapers',
  RUNS: 'scrape_core_runs',
  LEADS: 'scrape_core_leads',
  SETTINGS: 'scrape_core_settings'
};

const DEFAULT_SETTINGS = {
  geoapifyApiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEOAPIFY_API_KEY) || '',
  concurrencyLimit: 4,
  defaultExportFormat: 'csv',
  autoDeduplicate: true,
  autoVerifyEmails: true
};

class StorageService {
  constructor() {
    this.listeners = new Set();
    this.init();
  }

  init() {
    if (typeof window === 'undefined') return;

    // Purge ALL simulated/fake leads — any lead with geo-sim- prefix is fake
    const existingLeads = localStorage.getItem(STORAGE_KEYS.LEADS);
    if (existingLeads) {
      try {
        const parsed = JSON.parse(existingLeads);
        const realLeads = parsed.filter(l =>
          l.id &&
          !l.id.startsWith('geo-sim-') &&
          !l.id.startsWith('lead-') &&
          l.id !== 'lead-001' &&
          !String(l.id).includes('sim')
        );
        if (realLeads.length !== parsed.length) {
          console.log(`[Storage] Purged ${parsed.length - realLeads.length} simulated fake leads from localStorage.`);
          localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(realLeads));
        }
      } catch {
        localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify([]));
      }
    } else {
      localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify([]));
    }

    // Purge any legacy dummy runs if present
    const existingRuns = localStorage.getItem(STORAGE_KEYS.RUNS);
    if (existingRuns && (existingRuns.includes('RUN-8921') || existingRuns.includes('RUN-8920'))) {
      localStorage.setItem(STORAGE_KEYS.RUNS, JSON.stringify([]));
    } else if (!existingRuns) {
      localStorage.setItem(STORAGE_KEYS.RUNS, JSON.stringify([]));
    }

    // Initialize clean scrapers
    const existingScrapers = localStorage.getItem(STORAGE_KEYS.SCRAPERS);
    if (!existingScrapers || existingScrapers.includes('642')) {
      localStorage.setItem(STORAGE_KEYS.SCRAPERS, JSON.stringify(INITIAL_SCRAPERS));
    }

    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((fn) => fn());
  }

  getScrapers() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCRAPERS);
      return data ? JSON.parse(data) : INITIAL_SCRAPERS;
    } catch {
      return INITIAL_SCRAPERS;
    }
  }

  updateScraper(id, updates) {
    const scrapers = this.getScrapers().map((s) => (s.id === id ? { ...s, ...updates } : s));
    localStorage.setItem(STORAGE_KEYS.SCRAPERS, JSON.stringify(scrapers));
    this.notify();
    return scrapers;
  }

  getRuns() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RUNS);
      return data ? JSON.parse(data) : INITIAL_RUNS;
    } catch {
      return INITIAL_RUNS;
    }
  }

  addRun(run) {
    const runs = [run, ...this.getRuns()];
    localStorage.setItem(STORAGE_KEYS.RUNS, JSON.stringify(runs));
    this.notify();
    return run;
  }

  updateRun(runId, updates) {
    const runs = this.getRuns().map((r) => (r.id === runId ? { ...r, ...updates } : r));
    localStorage.setItem(STORAGE_KEYS.RUNS, JSON.stringify(runs));
    this.notify();
    return runs.find((r) => r.id === runId);
  }

  appendRunLog(runId, logEntry) {
    const runs = this.getRuns().map((r) => {
      if (r.id === runId) {
        return {
          ...r,
          logs: [...(r.logs || []), logEntry]
        };
      }
      return r;
    });
    localStorage.setItem(STORAGE_KEYS.RUNS, JSON.stringify(runs));
    this.notify();
  }

  getLeads() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LEADS);
      return data ? JSON.parse(data) : INITIAL_LEADS;
    } catch {
      return INITIAL_LEADS;
    }
  }

  addLead(lead) {
    const currentLeads = this.getLeads();
    // Deterministic deduplication check
    const normalizedNewName = lead.name.toLowerCase().trim();
    const isDuplicate = currentLeads.some((existing) => {
      const existingName = existing.name.toLowerCase().trim();
      if (existingName === normalizedNewName) return true;
      if (lead.website && existing.website && lead.website.replace(/^https?:\/\/(www\.)?/, '') === existing.website.replace(/^https?:\/\/(www\.)?/, '')) {
        return true;
      }
      if (lead.phone && existing.phone) {
        const phoneA = lead.phone.replace(/\D/g, '').slice(-10);
        const phoneB = existing.phone.replace(/\D/g, '').slice(-10);
        if (phoneA && phoneB && phoneA.length >= 7 && phoneA === phoneB) {
          return true;
        }
      }
      return false;
    });

    if (isDuplicate) {
      return { added: false, reason: 'DUPLICATE' };
    }

    const updated = [lead, ...currentLeads];
    localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(updated));
    this.notify();
    return { added: true, lead };
  }

  addLeadsBatch(leads) {
    const currentLeads = this.getLeads();
    const existingSignatures = new Set(
      currentLeads.map((l) => `${l.name.toLowerCase().trim()}|${l.location.toLowerCase().trim()}`)
    );

    let saved = 0;
    let duplicates = 0;
    const newLeads = [];

    leads.forEach((l) => {
      const sig = `${l.name.toLowerCase().trim()}|${l.location.toLowerCase().trim()}`;
      if (existingSignatures.has(sig)) {
        duplicates++;
      } else {
        existingSignatures.add(sig);
        newLeads.push(l);
        saved++;
      }
    });

    if (newLeads.length > 0) {
      localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify([...newLeads, ...currentLeads]));
      this.notify();
    }

    return { saved, duplicates };
  }

  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    this.notify();
  }

  resetAll() {
    localStorage.setItem(STORAGE_KEYS.SCRAPERS, JSON.stringify(INITIAL_SCRAPERS));
    localStorage.setItem(STORAGE_KEYS.RUNS, JSON.stringify(INITIAL_RUNS));
    localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(INITIAL_LEADS));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    this.notify();
  }
}

export const storage = new StorageService();
