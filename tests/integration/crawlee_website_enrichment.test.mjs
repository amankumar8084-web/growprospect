import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ContactExtractor, WebsiteCrawler } from '../../packages/scraper-website/src/index.js';
import { OutdatedWebsiteClassifier, verifyEmail, EMAIL_VERIFICATION_STATUSES } from '../../packages/scraper-core/src/index.js';

describe('Website Enrichment & Crawlee Pipeline', () => {
  test('ContactExtractor parses mailto, body emails, and telephone numbers', () => {
    const sampleHtml = `
      <html>
        <body>
          <h1>Austin Apex Repair</h1>
          <p>Contact founder at <a href="mailto:founder@austinapexrepair.com?subject=Inquiry">founder@austinapexrepair.com</a></p>
          <p>General inquiries: support@austinapexrepair.com</p>
          <p>Call our office: <a href="tel:+15128942019">(512) 894-2019</a></p>
          <!-- Should ignore image false positive -->
          <img src="logo@2x.png" />
        </body>
      </html>
    `;

    const { emails, phones } = ContactExtractor.extract(sampleHtml);

    assert.ok(emails.includes('founder@austinapexrepair.com'));
    assert.ok(emails.includes('support@austinapexrepair.com'));
    assert.ok(!emails.some((e) => e.includes('logo@2x.png')), 'Should filter image asset names');
    assert.ok(phones.includes('+15128942019') || phones.includes('(512) 894-2019'));
  });

  test('OutdatedWebsiteClassifier flags missing viewport, HTTP, and old copyright year', () => {
    const classifier = new OutdatedWebsiteClassifier();

    const legacyHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Old Clinic</title></head>
      <body>
        <table><tr><td>Copyright © 2015 Old Clinic</td></tr></table>
      </body>
      </html>
    `;

    const audit = classifier.classify({
      html: legacyHtml,
      url: 'http://legacy-clinic.com'
    });

    assert.strictEqual(audit.isOutdated, true, 'Legacy markup must be classified as outdated');
    assert.strictEqual(audit.signals.hasViewport, false, 'Should detect missing viewport tag');
    assert.strictEqual(audit.signals.isHttps, false, 'Should flag insecure HTTP');
    assert.strictEqual(audit.signals.detectedCopyrightYear, 2015, 'Should parse 2015 copyright');
    assert.ok(audit.score < 50, `Score must be below threshold: got ${audit.score}`);
  });

  test('verifyEmail validates syntax, rejects disposables, and resolves status', async () => {
    // 1. Valid business email
    const validResult = await verifyEmail('dr.smith@lakesidedental.org');
    assert.strictEqual(validResult.status, EMAIL_VERIFICATION_STATUSES.VERIFIED);

    // 2. Malformed email
    const invalidResult = await verifyEmail('broken-email-format');
    assert.strictEqual(invalidResult.status, EMAIL_VERIFICATION_STATUSES.INVALID);

    // 3. Disposable inbox
    const disposableResult = await verifyEmail('testuser@mailinator.com');
    assert.strictEqual(disposableResult.status, EMAIL_VERIFICATION_STATUSES.INVALID);
    assert.ok(disposableResult.reason.includes('Disposable'));
  });

  test('WebsiteCrawler performs full domain audit with contact discovery', async () => {
    const crawler = new WebsiteCrawler();
    const result = await crawler.auditAndEnrichDomain('http://chicago-apex-dental.com');

    assert.ok(result.extractedContacts.primaryEmail !== null);
    assert.ok(result.extractedContacts.primaryPhone !== null);
    assert.ok(result.audit.score !== undefined);
  });
});
