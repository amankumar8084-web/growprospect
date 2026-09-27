/**
 * Deterministic Deduplication Engine
 * Deduplicates business records across discovery and enrichment pipelines.
 */

export class DeduplicationEngine {
  constructor() {
    this.nameIndex = new Set();
    this.domainIndex = new Set();
    this.phoneIndex = new Set();
  }

  /**
   * Normalizes a business name by removing non-alphanumeric noise,
   * entity suffixes (LLC, Inc, Co), and multiple spaces.
   */
  normalizeName(name) {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/\b(llc|inc|corp|co|ltd|gmbh|co\.|inc\.)\b/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalizes a website domain to canonical root without protocol or www.
   */
  normalizeDomain(url) {
    if (!url) return null;
    return url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .trim();
  }

  /**
   * Normalizes a phone number to its last 10 digits for invariant matching.
   */
  normalizePhone(phone) {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 7 ? digits.slice(-10) : null;
  }

  /**
   * Checks if candidate lead is a duplicate of any indexed lead.
   * @param {Object} lead 
   * @returns {boolean}
   */
  isDuplicate(lead) {
    const normName = this.normalizeName(lead.name);
    const normDomain = this.normalizeDomain(lead.website);
    const normPhone = this.normalizePhone(lead.phone);

    if (normName && this.nameIndex.has(normName)) {
      return true;
    }
    if (normDomain && this.domainIndex.has(normDomain)) {
      return true;
    }
    if (normPhone && this.phoneIndex.has(normPhone)) {
      return true;
    }

    return false;
  }

  /**
   * Indexes a lead into the deduplication hash set.
   * @param {Object} lead 
   */
  indexLead(lead) {
    const normName = this.normalizeName(lead.name);
    const normDomain = this.normalizeDomain(lead.website);
    const normPhone = this.normalizePhone(lead.phone);

    if (normName) this.nameIndex.add(normName);
    if (normDomain) this.domainIndex.add(normDomain);
    if (normPhone) this.phoneIndex.add(normPhone);
  }

  /**
   * Deduplicates a batch of leads against existing and within-batch records.
   * @param {Object[]} leads 
   * @returns {{ uniqueLeads: Object[], duplicateCount: number }}
   */
  deduplicateBatch(leads) {
    const uniqueLeads = [];
    let duplicateCount = 0;

    for (const lead of leads) {
      if (this.isDuplicate(lead)) {
        duplicateCount++;
      } else {
        this.indexLead(lead);
        uniqueLeads.push(lead);
      }
    }

    return { uniqueLeads, duplicateCount };
  }
}
