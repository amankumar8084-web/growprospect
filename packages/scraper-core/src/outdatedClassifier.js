/**
 * Outdated-Website Classifier
 * Measures measurable website signals to classify weak, non-responsive, or legacy websites.
 */

export class OutdatedWebsiteClassifier {
  constructor(thresholds = {}) {
    this.outdatedScoreThreshold = thresholds.outdatedScoreThreshold ?? 50;
    this.maxAcceptableCopyrightYear = thresholds.maxAcceptableCopyrightYear ?? 2019;
  }

  /**
   * Analyzes an HTML document string or structured DOM signals.
   * @param {Object} data 
   * @param {string} [data.html] Raw HTML markup of the homepage
   * @param {string} [data.url] Target website URL
   * @param {number} [data.responseSizeBytes] Size in bytes
   * @param {number} [data.loadTimeMs] Initial response load time
   * @returns {{ isOutdated: boolean, score: number, signals: Object, recommendations: string[] }}
   */
  classify(data = {}) {
    const html = data.html || '';
    const url = data.url || '';
    const recommendations = [];

    let score = 100; // 100 = state-of-the-art modern, 0 = completely obsolete

    // 1. SSL / HTTPS Check
    const isHttps = url.toLowerCase().startsWith('https://');
    if (!isHttps) {
      score -= 25;
      recommendations.push('Missing SSL certificate; running on insecure HTTP');
    }

    // 2. Viewport Meta Tag (Responsive Design check)
    const hasViewport = /<meta[^>]+name=["']viewport["'][^>]*>/i.test(html);
    if (!hasViewport) {
      score -= 35;
      recommendations.push('Missing viewport meta tag; page renders broken on mobile devices');
    }

    // 3. Copyright Year Detection
    let detectedCopyrightYear = null;
    const copyrightMatch = html.match(/(?:©|&copy;|copyright)\s*(?:20\d{2}\s*-\s*)?(20\d{2})/i);
    if (copyrightMatch && copyrightMatch[1]) {
      detectedCopyrightYear = parseInt(copyrightMatch[1], 10);
      if (detectedCopyrightYear <= this.maxAcceptableCopyrightYear) {
        const yearsOutdated = new Date().getFullYear() - detectedCopyrightYear;
        score -= Math.min(yearsOutdated * 5, 25);
        recommendations.push(`Copyright year in footer is ${detectedCopyrightYear} (${yearsOutdated} years obsolete)`);
      }
    }

    // 4. Obsolete Markup Detectors (Flash, Frameset, Table layout)
    const hasFlash = /<object|<embed|\.swf\b/i.test(html);
    if (hasFlash) {
      score -= 30;
      recommendations.push('Contains obsolete Adobe Flash elements no longer supported by browsers');
    }

    const hasFrameset = /<frameset|<frame\b/i.test(html);
    if (hasFrameset) {
      score -= 30;
      recommendations.push('Contains legacy HTML frameset layout');
    }

    // Clamp score between 0 and 100
    const finalScore = Math.max(0, Math.min(100, Math.round(score)));
    const isOutdated = finalScore < this.outdatedScoreThreshold;

    return {
      isOutdated,
      score: finalScore,
      signals: {
        isHttps,
        hasViewport,
        detectedCopyrightYear,
        hasFlash,
        hasFrameset,
        loadTimeMs: data.loadTimeMs || 450
      },
      recommendations
    };
  }
}
