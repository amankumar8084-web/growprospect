import React, { useState } from 'react';
import { storage } from '../services/storage';
import { Key, Shield, Sliders, Database, RotateCcw, Check, Sparkles } from 'lucide-react';

export default function SettingsView() {
  const currentSettings = storage.getSettings();
  const [settings, setSettings] = useState(currentSettings);
  const [saved, setSaved] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    storage.saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetData = () => {
    if (window.confirm('Reset all leads, runs, and scraper metrics to seed data?')) {
      storage.resetAll();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 2500);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111] tracking-tight">
          System & Engine Settings
        </h1>
        <p className="text-xs text-[#8A8A8A] mt-1">
          Manage API keys, worker concurrency limits, email verification gateways, and data persistence.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Geoapify API Key Section */}
        <div className="p-6 bg-white border border-[#E7E7E7] rounded-lg space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#E7E7E7]">
            <Key className="w-4 h-4 text-[#EA4B0B]" />
            <h2 className="text-sm font-semibold text-[#111111]">
              Geoapify Places API Integration
            </h2>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#111111] uppercase tracking-wider">
              API Key (Geoapify Places)
            </label>
            <input
              type="password"
              placeholder="Paste your Geoapify API Key (e.g. 518a28f...)"
              value={settings.geoapifyApiKey}
              onChange={(e) => setSettings({ ...settings, geoapifyApiKey: e.target.value })}
              className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E7E7E7] rounded text-xs font-mono focus:bg-white focus:border-[#111111] focus:outline-none"
            />
            <p className="text-[11px] text-[#8A8A8A]">
              <strong className="text-red-600">Required.</strong> Without a valid key, the No-Website Business Finder will not run and will return 0 leads. Get your key at <a href="https://myprojects.geoapify.com" target="_blank" rel="noreferrer" className="underline">myprojects.geoapify.com</a>.
            </p>
          </div>
        </div>

        {/* Worker Execution & Concurrency */}
        <div className="p-6 bg-white border border-[#E7E7E7] rounded-lg space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#E7E7E7]">
            <Sliders className="w-4 h-4 text-[#111111]" />
            <h2 className="text-sm font-semibold text-[#111111]">
              Worker Concurrency & Scraping Limits
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#111111] uppercase tracking-wider mb-1">
                Crawlee Concurrency
              </label>
              <select
                value={settings.concurrencyLimit}
                onChange={(e) => setSettings({ ...settings, concurrencyLimit: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E7E7E7] rounded text-xs focus:bg-white focus:outline-none"
              >
                <option value="2">2 parallel browser workers (Conservative)</option>
                <option value="4">4 parallel workers (Recommended)</option>
                <option value="8">8 parallel workers (High Performance)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#111111] uppercase tracking-wider mb-1">
                Default Export Format
              </label>
              <select
                value={settings.defaultExportFormat}
                onChange={(e) => setSettings({ ...settings, defaultExportFormat: e.target.value })}
                className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E7E7E7] rounded text-xs focus:bg-white focus:outline-none"
              >
                <option value="csv">Standard CSV (RFC 4180)</option>
                <option value="xls">Native Excel (.xls)</option>
                <option value="json">Structured JSON</option>
              </select>
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={settings.autoDeduplicate}
                onChange={(e) => setSettings({ ...settings, autoDeduplicate: e.target.checked })}
                className="rounded border-[#E7E7E7] text-[#EA4B0B] focus:ring-0"
              />
              <span className="text-[#111111] font-medium">Automatic Deterministic Deduplication</span>
              <span className="text-[#8A8A8A] text-[11px]">(Prevents identical business records across runs)</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={settings.autoVerifyEmails}
                onChange={(e) => setSettings({ ...settings, autoVerifyEmails: e.target.checked })}
                className="rounded border-[#E7E7E7] text-[#EA4B0B] focus:ring-0"
              />
              <span className="text-[#111111] font-medium">Run Email Verification Pipeline</span>
              <span className="text-[#8A8A8A] text-[11px]">(Validates DNS MX syntax and disposable filters)</span>
            </label>
          </div>
        </div>

        {/* Database & Persistence Info */}
        <div className="p-6 bg-white border border-[#E7E7E7] rounded-lg space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#E7E7E7]">
            <Database className="w-4 h-4 text-[#111111]" />
            <h2 className="text-sm font-semibold text-[#111111]">
              Database Architecture Status
            </h2>
          </div>

          <div className="text-xs text-[#8A8A8A] leading-relaxed space-y-2">
            <p>
              Current client state is persisted in resilient local reactive storage. As proposed in <code className="text-[#111111] font-mono">ARCHITECTURE.md</code>, backend synchronization targets PostgreSQL via the Node.js API layer.
            </p>
          </div>

          <div className="pt-2 border-t border-[#E7E7E7] flex items-center justify-between">
            <span className="text-xs text-[#8A8A8A]">Need to restore clean demo state?</span>
            <button
              type="button"
              onClick={handleResetData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-red-600 hover:bg-red-50 border border-red-200 rounded transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{resetSuccess ? 'Data Restored!' : 'Reset Seed Data'}</span>
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="flex items-center gap-1 text-xs font-mono text-emerald-600">
              <Check className="w-3.5 h-3.5" />
              Settings Saved
            </span>
          )}
          <button
            type="submit"
            className="px-5 py-2 bg-[#EA4B0B] hover:bg-[#d44000] text-white text-xs font-semibold rounded shadow-xs active:scale-95 transition-all"
          >
            Save Configuration
          </button>
        </div>

      </form>
    </div>
  );
}
