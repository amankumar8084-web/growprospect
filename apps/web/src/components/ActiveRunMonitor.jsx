import React from 'react';
import { Terminal, Pause, Square, Play, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';

export default function ActiveRunMonitor({ activeRun, onPause, onStop, onViewAllRuns }) {
  if (!activeRun) {
    return (
      <div className="p-6 rounded-lg border border-[#E7E7E7] bg-white mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded bg-[#F5F5F5] border border-[#E7E7E7] text-[#8A8A8A]">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#111111]">Scraper Execution Pool Idle</h3>
              <p className="text-xs text-[#8A8A8A] mt-0.5">All background workers are in standby. Dispatch a new scraper above to stream real-time events.</p>
            </div>
          </div>
          <button
            onClick={onViewAllRuns}
            className="text-xs font-mono font-medium text-[#111111] hover:text-[#EA4B0B] underline"
          >
            View Execution History →
          </button>
        </div>
      </div>
    );
  }

  const isRunning = activeRun.status === 'running';
  const isPaused = activeRun.status === 'paused';

  return (
    <div className="rounded-lg border border-[#E7E7E7] bg-white mb-8 overflow-hidden shadow-xs">
      {/* Top Status Strip */}
      <div className="px-5 py-3 bg-[#F5F5F5] border-b border-[#E7E7E7] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EA4B0B] animate-ping" />
            <span className="font-mono font-bold text-xs text-[#111111]">
              #{activeRun.id}
            </span>
          </div>
          <span className="text-[#8A8A8A] text-xs">•</span>
          <span className="text-xs font-medium text-[#111111]">
            {activeRun.scraperName}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#EA4B0B] text-white font-semibold">
            {activeRun.status}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              onClick={() => onPause(activeRun.id)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-white hover:bg-[#E7E7E7] border border-[#E7E7E7] rounded text-[#111111] transition-colors"
            >
              <Pause className="w-3 h-3" />
              <span>Pause</span>
            </button>
          )}

          <button
            onClick={() => onStop(activeRun.id)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded transition-colors"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop Run</span>
          </button>

          <button
            onClick={onViewAllRuns}
            className="text-xs font-mono text-[#8A8A8A] hover:text-[#111111] ml-2"
          >
            Runs Log →
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Progress Bar & Numerical stats */}
        <div className="mb-4">
          <div className="flex justify-between items-baseline mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-[#111111]">PROGRESS</span>
              <span className="text-xs font-mono text-[#8A8A8A]">{activeRun.progress}% complete</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-[#111111]">Found: <strong>{activeRun.recordsFound}</strong></span>
              <span className="text-[#111111]">Saved: <strong className="text-emerald-600">{activeRun.recordsSaved}</strong></span>
              <span className="text-[#8A8A8A]">Dupes: <strong>{activeRun.duplicates}</strong></span>
              <span className="text-red-500">Errors: <strong>{activeRun.errors}</strong></span>
            </div>
          </div>

          <div className="w-full h-2 bg-[#F5F5F5] rounded-full overflow-hidden border border-[#E7E7E7]">
            <div
              className="h-full bg-[#EA4B0B] transition-all duration-300 rounded-full"
              style={{ width: `${activeRun.progress}%` }}
            />
          </div>
        </div>

        {/* Live Streaming Log Terminal */}
        <div className="rounded border border-[#E7E7E7] bg-[#111111] text-white p-3 font-mono text-[11px] leading-relaxed max-h-40 overflow-y-auto">
          <div className="flex items-center justify-between text-[#8A8A8A] text-[10px] pb-2 mb-2 border-b border-[#333333]">
            <span>STDOUT EVENT LOG STREAM</span>
            <span className="flex items-center gap-1">
              <RefreshCw className="w-2.5 h-2.5 animate-spin text-[#EA4B0B]" />
              STREAMING
            </span>
          </div>

          <div className="space-y-1">
            {activeRun.logs && activeRun.logs.length > 0 ? (
              activeRun.logs.slice(-6).map((log, index) => (
                <div key={index} className="flex items-start gap-2">
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
              <div className="text-[#8A8A8A] italic">Awaiting worker log messages...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
