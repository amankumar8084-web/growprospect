import React from 'react';
import ScraperCard from './ScraperCard';

export default function ScrapersView({ scrapers, onConfigure, onLaunchDirect }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111111] tracking-tight">
            Scrapers
          </h1>
          <p className="text-xs text-[#8A8A8A] mt-1">
            Configure and launch your lead discovery engines.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F5F5F5] border border-[#E7E7E7] rounded text-xs font-mono text-[#111111]">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>4 / 4 Engines Ready</span>
        </div>
      </div>

      {/* Grid of the 4 Scrapers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {scrapers.map((scraper) => (
          <ScraperCard
            key={scraper.id}
            scraper={scraper}
            onConfigure={onConfigure}
            onLaunchDirect={onLaunchDirect}
          />
        ))}
      </div>
    </div>
  );
}
