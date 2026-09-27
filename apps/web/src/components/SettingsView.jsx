import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { providerService } from '../services/providerService';
import { 
  Key, 
  MapPin, 
  Sliders, 
  Database, 
  RotateCcw, 
  Check, 
  Activity, 
  AlertCircle, 
  Loader2, 
  Globe, 
  Sparkles,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

export default function SettingsView() {
  const currentSettings = storage.getSettings();
  const [settings, setSettings] = useState(currentSettings);
  const [saved, setSaved] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // API Providers state
  const [providerConfig, setProviderConfig] = useState({
    activeProvider: 'geoapify',
    providers: {
      google_places: { name: 'Google Maps / Places API', enabled: true, hasKey: false, maskedKey: '', apiKey: '' },
      geoapify: { name: 'Geoapify Places API', enabled: true, hasKey: false, maskedKey: '', apiKey: '' },
      osm: { name: 'OpenStreetMap (Nominatim)', enabled: true, endpoint: 'https://nominatim.openstreetmap.org/search' }
    }
  });

  const [providerKeys, setProviderKeys] = useState({
    google_places: '',
    geoapify: '',
    osm_endpoint: ''
  });

  const [testStates, setTestStates] = useState({});
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await providerService.getConfig();
        if (config && config.providers) {
          setProviderConfig(config);
          setProviderKeys({
            google_places: config.providers.google_places?.maskedKey || '',
            geoapify: config.providers.geoapify?.maskedKey || '',
            osm_endpoint: config.providers.osm?.endpoint || 'https://nominatim.openstreetmap.org/search'
          });
        }
      } catch (err) {
        console.error('Failed to load provider config from backend:', err);
      } finally {
        setIsLoadingConfig(false);
      }
    }
    loadConfig();
  }, []);

  const handleActiveProviderChange = (providerId) => {
    setProviderConfig(prev => ({
      ...prev,
      activeProvider: providerId,
      providers: {
        ...prev.providers,
        [providerId]: {
          ...prev.providers[providerId],
          enabled: true // auto-enable if set as active
        }
      }
    }));
  };

  const handleToggleProvider = (providerId, enabled) => {
    setProviderConfig(prev => ({
      ...prev,
      providers: {
        ...prev.providers,
        [providerId]: {
          ...prev.providers[providerId],
          enabled
        }
      }
    }));
  };

  const handleTestConnection = async (providerId) => {
    setTestStates(prev => ({
      ...prev,
      [providerId]: { loading: true, success: null, message: 'Testing connection...' }
    }));

    try {
      const apiKey = providerKeys[providerId];
      const endpoint = providerId === 'osm' ? providerKeys.osm_endpoint : undefined;

      const result = await providerService.testConnection(providerId, { apiKey, endpoint });

      setTestStates(prev => ({
        ...prev,
        [providerId]: {
          loading: false,
          success: result.success,
          message: result.message,
          latencyMs: result.latencyMs
        }
      }));
    } catch (err) {
      setTestStates(prev => ({
        ...prev,
        [providerId]: {
          loading: false,
          success: false,
          message: err.message || 'Connection test failed'
        }
      }));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    // Prepare provider update payload (send updated keys only if entered)
    const payload = {
      activeProvider: providerConfig.activeProvider,
      providers: {
        google_places: {
          enabled: providerConfig.providers.google_places.enabled,
          apiKey: providerKeys.google_places
        },
        geoapify: {
          enabled: providerConfig.providers.geoapify.enabled,
          apiKey: providerKeys.geoapify
        },
        osm: {
          enabled: providerConfig.providers.osm.enabled,
          endpoint: providerKeys.osm_endpoint
        }
      }
    };

    try {
      const res = await providerService.saveConfig(payload);
      if (res && res.config) {
        setProviderConfig(res.config);
      }
    } catch (err) {
      alert(`Error saving provider configuration to backend: ${err.message}`);
    }

    storage.saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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
          Configure location data providers, active discovery engines, credentials, and worker pipeline limits.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* NEW SECTION: Location & Business Data Providers */}
        <div className="p-6 bg-white border border-[#E7E7E7] rounded-xl shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E7E7E7]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#EA4B0B]/10 flex items-center justify-center text-[#EA4B0B]">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#111111]">
                  Location & Business Data Providers
                </h2>
                <p className="text-[11px] text-[#8A8A8A]">
                  Select the active provider used by all business scrapers. Credentials are encrypted and securely stored on the backend.
                </p>
              </div>
            </div>
            
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-[10px] font-mono font-medium">
              <ShieldCheck className="w-3 h-3" />
              Backend Secured
            </span>
          </div>

          {/* Active Provider Selector Grid */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#111111] uppercase tracking-wider">
              Select Active Discovery Provider
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'google_places', name: 'Google Maps / Places', tag: 'Global High Accuracy', badge: 'Google Cloud' },
                { id: 'geoapify', name: 'Geoapify Places API', tag: 'Fast Commercial DB', badge: 'Places V2' },
                { id: 'osm', name: 'OpenStreetMap', tag: 'Free & Open Source', badge: 'Nominatim' }
              ].map((prov) => {
                const isSelected = providerConfig.activeProvider === prov.id;
                const isEnabled = providerConfig.providers[prov.id]?.enabled !== false;

                return (
                  <div
                    key={prov.id}
                    onClick={() => handleActiveProviderChange(prov.id)}
                    className={`relative p-3.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#EA4B0B] bg-[#EA4B0B]/5 shadow-2xs'
                        : 'border-[#E7E7E7] hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <input
                        type="radio"
                        name="activeProvider"
                        checked={isSelected}
                        onChange={() => handleActiveProviderChange(prov.id)}
                        className="mt-0.5 text-[#EA4B0B] focus:ring-0"
                      />
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-[#EA4B0B] text-white font-bold' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {isSelected ? 'ACTIVE' : prov.badge}
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="text-xs font-bold text-[#111111]">{prov.name}</div>
                      <div className="text-[10px] text-[#8A8A8A] mt-0.5">{prov.tag}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Provider Configurations */}
          <div className="space-y-4 pt-2">
            
            {/* 1. Google Maps / Places API Card */}
            <div className={`p-4 rounded-lg border transition-colors ${
              providerConfig.activeProvider === 'google_places' ? 'border-[#EA4B0B]/40 bg-[#FAFAFA]' : 'border-[#E7E7E7] bg-white'
            }`}>
              <div className="flex items-center justify-between pb-3 border-b border-[#E7E7E7]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <h3 className="text-xs font-bold text-[#111111]">Google Maps / Places API</h3>
                  {providerConfig.activeProvider === 'google_places' && (
                    <span className="text-[9px] bg-[#EA4B0B] text-white px-2 py-0.5 rounded-full font-bold">
                      ACTIVE
                    </span>
                  )}
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <span className="text-[11px] text-[#8A8A8A]">Enable:</span>
                  <input
                    type="checkbox"
                    checked={providerConfig.providers.google_places?.enabled ?? true}
                    onChange={(e) => handleToggleProvider('google_places', e.target.checked)}
                    className="rounded border-[#E7E7E7] text-[#EA4B0B] focus:ring-0"
                  />
                </label>
              </div>

              <div className="mt-3 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-gray-700">API Key</label>
                    <a
                      href="https://console.cloud.google.com/google/maps-apis/credentials"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                    >
                      <span>Get Google Places Key</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Paste Google Maps API Key (e.g. AIzaSy...)"
                      value={providerKeys.google_places}
                      onChange={(e) => setProviderKeys({ ...providerKeys, google_places: e.target.value })}
                      className="flex-1 px-3 py-2 bg-white border border-[#E7E7E7] rounded text-xs font-mono focus:border-[#111111] focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={testStates.google_places?.loading}
                      onClick={() => handleTestConnection('google_places')}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-medium rounded border border-[#E7E7E7] flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {testStates.google_places?.loading && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>Test Connection</span>
                    </button>
                  </div>
                </div>

                {/* Test Result Feedback */}
                {testStates.google_places && (
                  <div className={`p-2.5 rounded text-[11px] font-mono flex items-start gap-2 ${
                    testStates.google_places.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {testStates.google_places.success ? (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div>{testStates.google_places.message}</div>
                      {testStates.google_places.latencyMs && (
                        <div className="text-[10px] opacity-75 mt-0.5">Latency: {testStates.google_places.latencyMs}ms</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Geoapify Places API Card */}
            <div className={`p-4 rounded-lg border transition-colors ${
              providerConfig.activeProvider === 'geoapify' ? 'border-[#EA4B0B]/40 bg-[#FAFAFA]' : 'border-[#E7E7E7] bg-white'
            }`}>
              <div className="flex items-center justify-between pb-3 border-b border-[#E7E7E7]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <h3 className="text-xs font-bold text-[#111111]">Geoapify Places API</h3>
                  {providerConfig.activeProvider === 'geoapify' && (
                    <span className="text-[9px] bg-[#EA4B0B] text-white px-2 py-0.5 rounded-full font-bold">
                      ACTIVE
                    </span>
                  )}
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <span className="text-[11px] text-[#8A8A8A]">Enable:</span>
                  <input
                    type="checkbox"
                    checked={providerConfig.providers.geoapify?.enabled ?? true}
                    onChange={(e) => handleToggleProvider('geoapify', e.target.checked)}
                    className="rounded border-[#E7E7E7] text-[#EA4B0B] focus:ring-0"
                  />
                </label>
              </div>

              <div className="mt-3 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-gray-700">API Key</label>
                    <a
                      href="https://myprojects.geoapify.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-amber-700 hover:underline flex items-center gap-0.5"
                    >
                      <span>Get Geoapify Key</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Paste Geoapify API Key (e.g. 518a28f...)"
                      value={providerKeys.geoapify}
                      onChange={(e) => setProviderKeys({ ...providerKeys, geoapify: e.target.value })}
                      className="flex-1 px-3 py-2 bg-white border border-[#E7E7E7] rounded text-xs font-mono focus:border-[#111111] focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={testStates.geoapify?.loading}
                      onClick={() => handleTestConnection('geoapify')}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-medium rounded border border-[#E7E7E7] flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {testStates.geoapify?.loading && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>Test Connection</span>
                    </button>
                  </div>
                </div>

                {/* Test Result Feedback */}
                {testStates.geoapify && (
                  <div className={`p-2.5 rounded text-[11px] font-mono flex items-start gap-2 ${
                    testStates.geoapify.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {testStates.geoapify.success ? (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div>{testStates.geoapify.message}</div>
                      {testStates.geoapify.latencyMs && (
                        <div className="text-[10px] opacity-75 mt-0.5">Latency: {testStates.geoapify.latencyMs}ms</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. OpenStreetMap Card */}
            <div className={`p-4 rounded-lg border transition-colors ${
              providerConfig.activeProvider === 'osm' ? 'border-[#EA4B0B]/40 bg-[#FAFAFA]' : 'border-[#E7E7E7] bg-white'
            }`}>
              <div className="flex items-center justify-between pb-3 border-b border-[#E7E7E7]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <h3 className="text-xs font-bold text-[#111111]">OpenStreetMap (Nominatim API)</h3>
                  {providerConfig.activeProvider === 'osm' && (
                    <span className="text-[9px] bg-[#EA4B0B] text-white px-2 py-0.5 rounded-full font-bold">
                      ACTIVE
                    </span>
                  )}
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <span className="text-[11px] text-[#8A8A8A]">Enable:</span>
                  <input
                    type="checkbox"
                    checked={providerConfig.providers.osm?.enabled ?? true}
                    onChange={(e) => handleToggleProvider('osm', e.target.checked)}
                    className="rounded border-[#E7E7E7] text-[#EA4B0B] focus:ring-0"
                  />
                </label>
              </div>

              <div className="mt-3 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-gray-700">Nominatim Endpoint URL</label>
                    <span className="text-[10px] text-emerald-700 font-mono">No API Key Required (Free)</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://nominatim.openstreetmap.org/search"
                      value={providerKeys.osm_endpoint}
                      onChange={(e) => setProviderKeys({ ...providerKeys, osm_endpoint: e.target.value })}
                      className="flex-1 px-3 py-2 bg-white border border-[#E7E7E7] rounded text-xs font-mono focus:border-[#111111] focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={testStates.osm?.loading}
                      onClick={() => handleTestConnection('osm')}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-medium rounded border border-[#E7E7E7] flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {testStates.osm?.loading && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>Test Connection</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Uses OpenStreetMap global geographic data. Supports custom or self-hosted Nominatim instances.
                  </p>
                </div>

                {/* Test Result Feedback */}
                {testStates.osm && (
                  <div className={`p-2.5 rounded text-[11px] font-mono flex items-start gap-2 ${
                    testStates.osm.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {testStates.osm.success ? (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div>{testStates.osm.message}</div>
                      {testStates.osm.latencyMs && (
                        <div className="text-[10px] opacity-75 mt-0.5">Latency: {testStates.osm.latencyMs}ms</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Worker Execution & Concurrency */}
        <div className="p-6 bg-white border border-[#E7E7E7] rounded-xl shadow-xs space-y-4">
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
        <div className="p-6 bg-white border border-[#E7E7E7] rounded-xl shadow-xs space-y-4">
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-red-600 hover:bg-red-50 border border-red-200 rounded transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{resetSuccess ? 'Data Restored!' : 'Reset Seed Data'}</span>
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3 sticky bottom-4 bg-white/95 backdrop-blur-xs p-4 rounded-xl border border-[#E7E7E7] shadow-md">
          {saved && (
            <span className="flex items-center gap-1 text-xs font-mono text-emerald-600 font-semibold">
              <Check className="w-4 h-4" />
              Configuration Saved to Backend!
            </span>
          )}
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#EA4B0B] hover:bg-[#d44000] text-white text-xs font-bold rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            Save All Changes
          </button>
        </div>

      </form>
    </div>
  );
}
