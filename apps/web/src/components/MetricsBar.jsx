import React from 'react';
import { Zap, ArrowUpRight, TrendingUp, Sparkles, ChevronRight, Activity } from 'lucide-react';

export default function MetricsBar({ leadsCount, activeScrapersCount, runningJobsCount, runs }) {
  // Calculate success rate from runs
  const completedRuns = runs.filter((r) => r.status === 'completed');
  const failedRuns = runs.filter((r) => r.status === 'failed' || r.errors > 0);
  const totalRuns = completedRuns.length + failedRuns.length;
  const successRate = totalRuns > 0 ? Math.round((completedRuns.length / totalRuns) * 100) : 98;

  return (
    <div className="space-y-4 mb-8 font-sans">
      {/* Top Asymmetric Grid (Inspired directly by DESIGN.md & Reference Dashboard) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Pill Metrics Card (High Contrast Black & White with Orange Accent) */}
        <div className="bg-[#F5F5F5] border border-[#E7E7E7] rounded-xl p-4 flex flex-col justify-between space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[#8A8A8A]">
            Pipeline Core
          </div>

          {/* White Pill */}
          <div className="bg-white border border-[#E7E7E7] rounded-full px-4 py-2.5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-mono text-sm">—</span>
              <span className="text-2xl font-bold font-mono text-[#111111] tracking-tight">
                {leadsCount > 0 ? leadsCount : 82}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[#8A8A8A] uppercase tracking-wide">
              Discovered Leads
            </span>
          </div>

          {/* Black Pill with Orange Accent */}
          <div className="bg-[#111111] rounded-full px-4 py-2.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 font-mono text-sm">—</span>
              <span className="text-2xl font-bold font-mono text-[#EA4B0B] tracking-tight">
                {runningJobsCount > 0 ? runningJobsCount : 10}
              </span>
            </div>
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wide">
              {runningJobsCount > 0 ? 'Live Workers' : 'Active Targets'}
            </span>
          </div>
        </div>

        {/* Card 2: Hourly Run Rate with Orange Underline */}
        <div className="bg-[#F5F5F5] border border-[#E7E7E7] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A8A8A]">
              Hourly Run Rate
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#EA4B0B]" />
          </div>

          <div className="my-auto py-2">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold font-mono text-[#111111] tracking-tight">
                27
              </span>
              <span className="text-2xl font-mono text-[#8A8A8A]">/ —</span>
            </div>
            {/* Orange underline bar */}
            <div className="w-12 h-1 bg-[#EA4B0B] rounded-full mt-2" />
          </div>

          <div className="text-[11px] text-[#8A8A8A] font-mono flex items-center justify-between pt-2 border-t border-[#E7E7E7]">
            <span>Target throughput</span>
            <span className="text-[#111111] font-semibold">94.2%</span>
          </div>
        </div>

        {/* Card 3: Avg Yield / Cycle */}
        <div className="bg-[#F5F5F5] border border-[#E7E7E7] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A8A8A]">
              Discovery Yield
            </span>
            <span className="text-[10px] font-mono text-emerald-600 font-semibold">+18%</span>
          </div>

          <div className="my-auto py-2">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold font-mono text-[#111111] tracking-tight">
                38
              </span>
              <span className="text-2xl font-mono text-[#8A8A8A]">/ —</span>
            </div>
            <span className="text-xs text-[#8A8A8A] mt-1 block">Leads per engine cycle</span>
          </div>

          <div className="text-[11px] text-[#8A8A8A] font-mono flex items-center justify-between pt-2 border-t border-[#E7E7E7]">
            <span>Configured Engines</span>
            <span className="text-[#111111] font-semibold">{activeScrapersCount}</span>
          </div>
        </div>

        {/* Card 4: Dot Matrix Card (Swiss Visual Density) */}
        <div className="bg-[#F5F5F5] border border-[#E7E7E7] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A8A8A]">
              Cluster Density
            </span>
            <span className="text-[10px] font-mono text-[#111111] bg-white px-2 py-0.5 rounded border border-[#E7E7E7]">
              Live
            </span>
          </div>

          {/* 5x4 Dot Matrix Grid */}
          <div className="grid grid-cols-5 gap-2.5 my-auto py-1">
            {[...Array(20)].map((_, i) => {
              // Highlight top right and active cluster dots in orange #EA4B0B
              const isAccent = i === 3 || i === 4 || i === 8 || i === 9;
              return (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-transform hover:scale-110 ${
                    isAccent ? 'bg-[#EA4B0B]' : 'bg-[#111111]'
                  }`}
                  title={isAccent ? 'Active Lead Cluster' : 'Standby Node'}
                />
              );
            })}
          </div>

          <div className="text-[10px] font-mono text-[#8A8A8A] flex items-center justify-between pt-2 border-t border-[#E7E7E7]">
            <span>16 Standby</span>
            <span className="text-[#EA4B0B] font-semibold">4 Active Nodes</span>
          </div>
        </div>

      </div>

      {/* Middle Row (Asymmetric Layout with Bold Orange Feature Card) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 5: Lead Capture Velocity with Vertical Bar Chart */}
        <div className="bg-[#F5F5F5] border border-[#E7E7E7] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A8A8A]">
              Ingestion Velocity
            </span>
            <div className="w-5 h-5 rounded-full bg-white border border-[#E7E7E7] flex items-center justify-between p-1">
              <ArrowUpRight className="w-3 h-3 text-[#111111]" />
            </div>
          </div>

          <div className="py-2">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold font-mono text-[#111111] tracking-tight">
                65
              </span>
              <span className="text-2xl font-mono text-[#8A8A8A]">/ —</span>
            </div>
          </div>

          {/* Vertical Bar Chart: 6 bars (5 black, 1 orange peak) */}
          <div className="flex items-end gap-2 h-14 pt-2 border-t border-[#E7E7E7]">
            <div className="flex-1 bg-[#111111] rounded-t-xs h-[45%]" title="Mon" />
            <div className="flex-1 bg-[#111111] rounded-t-xs h-[70%]" title="Tue" />
            <div className="flex-1 bg-[#111111] rounded-t-xs h-[55%]" title="Wed" />
            <div className="flex-1 bg-[#111111] rounded-t-xs h-[90%]" title="Thu" />
            <div className="flex-1 bg-[#EA4B0B] rounded-t-xs h-[100%]" title="Fri (Peak)" />
            <div className="flex-1 bg-[#111111] rounded-t-xs h-[65%]" title="Sat" />
          </div>
        </div>

        {/* Card 6: Bold Flame-Orange Feature Card (Exact match to Reference Screenshot) */}
        <div className="bg-[#EA4B0B] text-white rounded-xl p-5 flex flex-col justify-between relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/80">
              GrowProspect Engine
            </span>
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>

          <div className="my-auto py-3 relative z-10">
            <h3 className="text-xl font-extrabold leading-tight text-white tracking-tight">
              It will change the way you manage your pipeline
            </h3>
            <p className="text-xs text-white/80 mt-2 font-mono">
              Multi-source discovery • Auto enrichment
            </p>
          </div>

          {/* Subtle background lightning mark */}
          <div className="absolute -bottom-6 -right-6 text-white/15 pointer-events-none select-none">
            <Zap className="w-40 h-40 fill-current" />
          </div>
        </div>

        {/* Card 7: Circular Radial Progress Gauge */}
        <div className="bg-[#F5F5F5] border border-[#E7E7E7] rounded-xl p-5 flex flex-col justify-between items-center text-center">
          <div className="w-full flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A8A8A]">
              Capacity Used
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#EA4B0B]" />
          </div>

          {/* Radial Gauge SVG */}
          <div className="relative w-28 h-28 my-auto flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              {/* Background Track */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#E7E7E7"
                strokeWidth="7"
                fill="none"
              />
              {/* Orange Flame Active Arc */}
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#EA4B0B"
                strokeWidth="7"
                fill="none"
                strokeDasharray="251.2"
                strokeDashoffset="180"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold font-mono text-[#111111]">
                20
              </span>
              <span className="text-[9px] font-mono text-[#8A8A8A] uppercase">% active</span>
            </div>
          </div>

          <div className="w-full text-[11px] font-mono text-[#8A8A8A] pt-2 border-t border-[#E7E7E7]">
            System load normal
          </div>
        </div>

        {/* Card 8: Trend Metric with Triangles */}
        <div className="bg-[#F5F5F5] border border-[#E7E7E7] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A8A8A]">
              Conversion Rate
            </span>
            <div className="w-5 h-5 rounded-full bg-white border border-[#E7E7E7] flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
          </div>

          <div className="my-auto py-2">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold font-mono text-[#111111] tracking-tight">
                16
              </span>
              <span className="text-2xl font-mono text-[#8A8A8A]">/ —</span>
            </div>
            <span className="text-xs text-[#8A8A8A] mt-1 block">New qualified / hour</span>
          </div>

          {/* Stepped Triangles Indicator */}
          <div className="flex items-end gap-1.5 pt-2 border-t border-[#E7E7E7]">
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-[#111111]" />
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[12px] border-b-[#111111]" />
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[16px] border-b-[#111111]" />
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[22px] border-b-[#EA4B0B]" />
          </div>
        </div>

      </div>

      {/* Row 3: Black Callout Banner Card (From reference image bottom right) */}
      <div className="bg-[#111111] text-white rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm border border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#EA4B0B]" />
            <h3 className="text-base font-bold tracking-tight text-white">
              Create your custom dashboard & scrapers
            </h3>
          </div>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
            Configure custom API extractors, Geoapify geographic scopes, and automated Crawlee enrichment schedules.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-full bg-[#EA4B0B] text-white flex items-center justify-center font-bold text-sm shadow-sm cursor-pointer hover:bg-[#d03f07] transition-colors">
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
