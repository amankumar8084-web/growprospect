import React, { useState } from 'react';
import { 
  Terminal, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  Pause, 
  Play, 
  Square, 
  ChevronDown, 
  ChevronUp,
  RotateCcw,
  Search
} from 'lucide-react';

export default function RunsView({ runs, onPauseRun, onStopRun, onRerun }) {
  const [expandedRunId, setExpandedRunId] = useState(runs[0]?.id || null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  const filteredRuns = runs.filter((run) => {
    const matchesStatus = filterStatus === 'ALL' || run.status === filterStatus;
    const matchesSearch = 
      run.id.toLowerCase().includes(search.toLowerCase()) ||
      run.scraperName.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#EA4B0B] text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            RUNNING
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            COMPLETED
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium text-amber-700 bg-amber-50 border border-amber-200">
            <Pause className="w-3 h-3 text-amber-600" />
            PAUSED
          </span>
        );
      case 'stopped':
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium text-red-700 bg-red-50 border border-red-200">
            <XCircle className="w-3 h-3 text-red-600" />
            {status.toUpperCase()}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-[#F5F5F5] border border-[#E7E7E7] text-[#8A8A8A]">
            <Clock className="w-3 h-3" />
            {status.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111111] tracking-tight">
            Scraper Execution Runs
          </h1>
          <p className="text-xs text-[#8A8A8A] mt-1">
            Audit long-running background worker lifecycles, progress logs, and error diagnostic traces.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
            <input
              type="text"
              placeholder="Search run ID or scraper..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-[#F5F5F5] border border-[#E7E7E7] rounded focus:bg-white focus:outline-none w-56 placeholder:text-[#8A8A8A]"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 text-xs bg-[#F5F5F5] border border-[#E7E7E7] rounded focus:bg-white focus:outline-none font-mono"
          >
            <option value="ALL">All Statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
            <option value="stopped">Stopped</option>
            <option value="queued">Queued</option>
          </select>
        </div>
      </div>

      {/* Runs List */}
      <div className="space-y-3">
        {filteredRuns.map((run) => {
          const isExpanded = expandedRunId === run.id;
          const isRunning = run.status === 'running';

          return (
            <div 
              key={run.id}
              className={`rounded-lg border bg-white transition-all overflow-hidden ${
                isRunning ? 'border-[#EA4B0B] ring-1 ring-[#EA4B0B]/20' : 'border-[#E7E7E7]'
              }`}
            >
              {/* Row Bar */}
              <div 
                className="p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-[#FAFAFA] transition-colors"
                onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-xs text-[#111111] bg-[#F5F5F5] px-2 py-1 rounded border border-[#E7E7E7]">
                    #{run.id}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-[#111111]">
                      {run.scraperName}
                    </h3>
                    <div className="text-[11px] text-[#8A8A8A] font-mono mt-0.5">
                      Started {new Date(run.startedAt).toLocaleTimeString()} • 
                      {run.completedAt ? ` Completed in ${Math.round((new Date(run.completedAt) - new Date(run.startedAt)) / 1000)}s` : ' In Progress'}
                    </div>
                  </div>
                </div>

                {/* Status + Metrics Summary */}
                <div className="flex items-center gap-6">
                  <div className="hidden md:flex items-center gap-4 text-xs font-mono">
                    <span className="text-[#111111]">Yield: <strong>{run.recordsSaved}</strong> saved</span>
                    <span className="text-[#8A8A8A]">({run.duplicates} dupes)</span>
                    {run.errors > 0 ? (
                      <span className="text-red-500 font-semibold">{run.errors} errors</span>
                    ) : (
                      <span className="text-emerald-600">0 errors</span>
                    )}
                  </div>

                  <div>
                    {getStatusBadge(run.status)}
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[#8A8A8A]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#8A8A8A]" />
                  )}
                </div>
              </div>

              {/* Expanded Detail Panel */}
              {isExpanded && (
                <div className="border-t border-[#E7E7E7] bg-[#F5F5F5] p-5 space-y-4">
                  {/* Progress & Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded border border-[#E7E7E7]">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span>Worker Progress</span>
                        <span>{run.progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-[#F5F5F5] rounded-full overflow-hidden border border-[#E7E7E7]">
                        <div
                          className="h-full bg-[#EA4B0B] transition-all duration-300"
                          style={{ width: `${run.progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isRunning && (
                        <>
                          <button
                            onClick={() => onPauseRun(run.id)}
                            className="px-3 py-1.5 text-xs font-mono bg-[#F5F5F5] hover:bg-[#E7E7E7] rounded border border-[#E7E7E7] text-[#111111]"
                          >
                            Pause
                          </button>
                          <button
                            onClick={() => onStopRun(run.id)}
                            className="px-3 py-1.5 text-xs font-mono bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200"
                          >
                            Stop
                          </button>
                        </>
                      )}

                      {!isRunning && (
                        <button
                          onClick={() => onRerun(run.scraperId, run.filters)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-[#111111] hover:bg-[#EA4B0B] text-white rounded transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Re-run Scraper</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Active Filter Parameters */}
                  {run.filters && (
                    <div className="p-3 bg-white rounded border border-[#E7E7E7] text-xs font-mono">
                      <span className="text-[#8A8A8A] block mb-1">Run Parameter Manifest:</span>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(run.filters).map(([k, v]) => (
                          <span key={k} className="px-2 py-0.5 rounded bg-[#F5F5F5] text-[#111111] border border-[#E7E7E7]">
                            {k}: <strong className="text-[#EA4B0B]">{String(v)}</strong>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Terminal Execution Logs */}
                  <div className="rounded border border-[#E7E7E7] bg-[#111111] text-zinc-200 p-4 font-mono text-[11px] leading-relaxed max-h-56 overflow-y-auto">
                    <div className="text-[10px] text-[#8A8A8A] pb-2 mb-2 border-b border-[#333333] flex justify-between">
                      <span>CONSOLE LOGS FOR #{run.id}</span>
                      <span>{run.logs?.length || 0} events recorded</span>
                    </div>

                    <div className="space-y-1">
                      {run.logs && run.logs.length > 0 ? (
                        run.logs.map((log, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-[#8A8A8A] shrink-0 select-none">[{log.time}]</span>
                            <span
                              className={
                                log.level === 'success'
                                  ? 'text-emerald-400 font-semibold'
                                  : log.level === 'warn'
                                  ? 'text-amber-400'
                                  : log.level === 'error'
                                  ? 'text-red-400 font-semibold'
                                  : 'text-zinc-300'
                              }
                            >
                              {log.message}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-[#8A8A8A] italic">No logs recorded for this run.</div>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
