/**
 * Contact Information Extractor
 * Extracts public email addresses and phone numbers from HTML pages.
 */

const EMAIL_REGEX = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
const MAILTO_REGEX = /href=["']mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})[^"']*["']/gi;
const TEL_REGEX = /href=["']tel:([^"']+)["']/gi;
const PHONE_TEXT_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

// Ignore non-contact email false positives like image filenames and CDN assets
const ASSET_EXTENSIONS = /\.(png|jpg|jpeg|gif|webp|svg|css|js)$/i;

export class ContactExtractor {
  /**
   * Extracts unique emails and phones from HTML markup.
   * @param {string} html 
   * @returns {{ emails: string[], phones: string[] }}
   */
  static extract(html) {
    if (!html || typeof html !== 'string') {
      return { emails: [], phones: [] };
    }

    const emailSet = new Set();
    const phoneSet = new Set();

    // 1. Mailto links (highest confidence)
    let mailtoMatch;
    while ((mailtoMatch = MAILTO_REGEX.exec(html)) !== null) {
      const email = mailtoMatch[1].toLowerCase().trim();
      if (!ASSET_EXTENSIONS.test(email)) {
        emailSet.add(email);
      }
    }

    // 2. Body text emails
    const rawEmails = html.match(EMAIL_REGEX) || [];
    for (const raw of rawEmails) {
      const clean = raw.toLowerCase().trim();
      if (!ASSET_EXTENSIONS.test(clean) && !clean.includes('example.com') && !clean.includes('sentry.io')) {
        emailSet.add(clean);
      }
    }

    // 3. Tel links
    let telMatch;
    while ((telMatch = TEL_REGEX.exec(html)) !== null) {
      const phone = telMatch[1].trim();
      if (phone.length >= 7) {
        phoneSet.add(phone);
      }
    }

    // 4. Body text phones
    const rawPhones = html.match(PHONE_TEXT_REGEX) || [];
    for (const p of rawPhones) {
      const clean = p.trim();
      if (clean.length >= 10) {
        phoneSet.add(clean);
      }
    }

    return {
      emails: Array.from(emailSet),
      phones: Array.from(phoneSet)
    };
  }
}
