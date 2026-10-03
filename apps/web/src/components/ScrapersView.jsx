import React from 'react';
import ScraperCard from './ScraperCard';
import { Layers } from 'lucide-react';

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
          <span>{scrapers.length} Engines Ready</span>
        </div>
      </div>

      {/* Grid of the Scrapers */}
      {scrapers.length === 0 ? (
        <div className="p-12 bg-white border border-[#E7E7E7] rounded-xl text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#F5F5F5] border border-[#E7E7E7] flex items-center justify-center mx-auto text-[#8A8A8A]">
            <Layers className="w-6 h-6 text-[#8A8A8A]" />
          </div>
          <div>
            <p className="text-base font-bold text-[#111111]">No scraper engines installed</p>
            <p className="text-xs text-[#8A8A8A] mt-1 max-w-sm mx-auto">
              Scraper engines are required to discover no-website businesses, tech hiring, and RFP contracts.
            </p>
          </div>
          <div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#EA4B0B] hover:bg-[#d03f07] text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
            >
              Reload Engines
            </button>
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
