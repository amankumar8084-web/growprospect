import React from 'react';
import { Play, Settings2, Sparkles, MapPin, Globe, Briefcase, FileCode2 } from 'lucide-react';

export default function ScraperCard({ scraper, onConfigure, onLaunchDirect }) {
  const getIcon = () => {
    switch (scraper.id) {
      case 'no-website-biz':
        return MapPin;
      case 'outdated-website-biz':
        return Globe;
      case 'tech-hiring':
        return Briefcase;
      case 'freelance-req':
        return FileCode2;
      default:
        return Sparkles;
    }
  };

  const Icon = getIcon();
  const isRunning = scraper.status === 'running';

  return (
    <div className={`flex flex-col justify-between p-5 rounded-lg border bg-white transition-all ${
      isRunning ? 'border-[#EA4B0B] ring-1 ring-[#EA4B0B]/30' : 'border-[#E7E7E7] hover:border-[#CCCCCC]'
    }`}>
      <div>
        {/* Status indicator */}
        <div className="flex items-center justify-end mb-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-[#EA4B0B] animate-ping' : 'bg-emerald-500'}`} />
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#8A8A8A]">
              {scraper.status}
            </span>
          </div>
        </div>

        {/* Title & Description */}
        <div className="flex items-start gap-2.5 mb-4">
          <div className="p-2 rounded bg-[#F5F5F5] border border-[#E7E7E7] text-[#111111] shrink-0 mt-0.5">
            <Icon className="w-4 h-4 text-[#EA4B0B]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#111111] tracking-tight leading-snug">
              {scraper.name}
            </h3>
            <p className="text-xs text-[#8A8A8A] mt-1 line-clamp-2 leading-relaxed">
              {scraper.shortDescription}
            </p>
          </div>
        </div>
      </div>

      {/* Footer: Leads Yield & Actions */}
      <div className="pt-3 border-t border-[#E7E7E7] flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase text-[#8A8A8A]">Yield</div>
          <div className="text-sm font-mono font-bold text-[#111111]">
            {scraper.leadsCount || 0} leads
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onConfigure(scraper)}
            className="p-1.5 text-[#111111] hover:bg-[#F5F5F5] border border-[#E7E7E7] rounded text-xs transition-colors cursor-pointer"
            title="Configure parameters"
          >
            <Settings2 className="w-3.5 h-3.5 text-[#8A8A8A]" />
          </button>

          <button
            onClick={() => onLaunchDirect(scraper.id)}
            disabled={isRunning}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer ${
              isRunning
                ? 'bg-[#F5F5F5] text-[#8A8A8A] border border-[#E7E7E7] cursor-not-allowed'
                : 'bg-[#111111] hover:bg-[#EA4B0B] text-white active:scale-95'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isRunning ? 'Running' : 'Launch Run'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
