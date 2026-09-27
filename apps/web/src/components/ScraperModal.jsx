import React, { useState, useMemo } from 'react';
import { X, Play, Globe, MapPin, Briefcase, FileCode2, ShieldAlert, Info } from 'lucide-react';
import { Country, State, City } from 'country-state-city';

export default function ScraperModal({ isOpen, onClose, scraper, onLaunch }) {
  if (!isOpen || !scraper) return null;

  const [selectedCountryCode, setSelectedCountryCode] = useState(scraper.parameters?.country || 'US');
  const [selectedStateCode, setSelectedStateCode] = useState('');
  const [selectedCity, setSelectedCity] = useState(scraper.parameters?.city || '');

  const [formData, setFormData] = useState({
    country: scraper.parameters?.country || 'US',
    city: scraper.parameters?.city || 'Austin, TX',
    category: scraper.parameters?.category || 'Commercial & Local Services',
    maxResults: scraper.parameters?.maxResults || 30,
    roleQuery: scraper.parameters?.roleQuery || 'React, Node.js, Cloud',
    companySize: scraper.parameters?.companySize || 'Startup & Mid-size',
    excludeEnterprise: scraper.parameters?.excludeEnterprise ?? true,
    minBudget: scraper.parameters?.minBudget || 2500,
    checkMobileViewport: scraper.parameters?.checkMobileViewport ?? true,
    checkSsl: scraper.parameters?.checkSsl ?? true
  });

  const allCountries = useMemo(() => Country.getAllCountries(), []);
  const states = useMemo(() => selectedCountryCode ? State.getStatesOfCountry(selectedCountryCode) : [], [selectedCountryCode]);
  const cities = useMemo(() => (selectedCountryCode && selectedStateCode) ? City.getCitiesOfState(selectedCountryCode, selectedStateCode) : [], [selectedCountryCode, selectedStateCode]);

  const handleCountryChange = (isoCode) => {
    setSelectedCountryCode(isoCode);
    setSelectedStateCode('');
    setSelectedCity('');
    const country = Country.getCountryByCode(isoCode);
    setFormData(prev => ({ ...prev, country: isoCode, city: '' }));
  };

  const handleStateChange = (stateCode) => {
    setSelectedStateCode(stateCode);
    setSelectedCity('');
    setFormData(prev => ({ ...prev, city: '' }));
  };

  const handleCityChange = (cityName) => {
    setSelectedCity(cityName);
    setFormData(prev => ({ ...prev, city: cityName }));
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onLaunch(scraper.id, formData);
    onClose();
  };

  const selectClass = "w-full px-3 py-2 bg-[#F5F5F5] border border-[#E7E7E7] rounded text-xs focus:bg-white focus:border-[#111111] focus:outline-none";
  const labelClass = "block text-xs font-semibold text-[#111111] uppercase tracking-wider mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div 
        className="bg-white border border-[#E7E7E7] rounded-lg max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E7E7E7] bg-[#F5F5F5]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-white border border-[#E7E7E7] text-[#111111]">
                {scraper.engineBadge}
              </span>
              <span className="text-xs text-[#8A8A8A] font-mono">Run Configuration</span>
            </div>
            <h2 className="text-lg font-bold text-[#111111] mt-1">
              Configure {scraper.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8A8A8A] hover:text-[#111111] rounded-md hover:bg-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm max-h-[80vh] overflow-y-auto">
          
          {/* Architecture flow indicator */}
          <div className="p-3 bg-[#F5F5F5] rounded border border-[#E7E7E7] flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#EA4B0B] shrink-0 mt-0.5" />
            <p className="text-xs text-[#8A8A8A] leading-relaxed">
              {scraper.id === 'no-website-biz' && (
                <>Business discovery runs through <strong>Geoapify Places API</strong>. Entities with public web links are pruned; leads without a website bypass crawling directly into normalized storage.</>
              )}
              {scraper.id === 'outdated-website-biz' && (
                <>Domains discovered will be audited via <strong>Crawlee</strong>, activating <strong>Playwright</strong> for JavaScript rendering, mobile viewport inspection, and contact extraction.</>
              )}
              {scraper.id === 'tech-hiring' && (
                <>Discovers tech hiring signals from public job repositories, applying mid-market filters and enterprise exclusion rules.</>
              )}
              {scraper.id === 'freelance-req' && (
                <>Aggregates high-budget client RFP postings from public contract feeds filtered by minimum budget thresholds.</>
              )}
            </p>
          </div>

          {/* Business & Outdated Scrapers Filters */}
          {(scraper.id === 'no-website-biz' || scraper.id === 'outdated-website-biz') && (
            <>
              {/* Country */}
              <div>
                <label className={labelClass}>Country</label>
                <select
                  value={selectedCountryCode}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className={selectClass}
                >
                  <option value="">— Select Country —</option>
                  {allCountries.map(c => (
                    <option key={c.isoCode} value={c.isoCode}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* State */}
              <div>
                <label className={labelClass}>State / Province</label>
                <select
                  value={selectedStateCode}
                  onChange={(e) => handleStateChange(e.target.value)}
                  disabled={!selectedCountryCode || states.length === 0}
                  className={`${selectClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value="">
                    {!selectedCountryCode ? '— Select Country first —' : states.length === 0 ? '— No states available —' : '— Select State —'}
                  </option>
                  {states.map(s => (
                    <option key={s.isoCode} value={s.isoCode}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* City */}
              <div>
                <label className={labelClass}>City</label>
                <select
                  value={selectedCity}
                  onChange={(e) => handleCityChange(e.target.value)}
                  disabled={!selectedStateCode || cities.length === 0}
                  className={`${selectClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value="">
                    {!selectedStateCode ? '— Select State first —' : cities.length === 0 ? '— No cities available —' : '— Select City —'}
                  </option>
                  {cities.map(city => (
                    <option key={city.name} value={city.name}>{city.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] uppercase tracking-wider mb-1">
                  Place Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E7E7E7] rounded text-xs focus:bg-white focus:border-[#111111] focus:outline-none"
                >
                  <option value="Commercial & Local Services">Commercial & Local Services (Plumbing, Roofing, HVAC)</option>
                  <option value="Healthcare & Dental">Healthcare & Dental Clinics</option>
                  <option value="Catering & Restaurants">Catering & Restaurants</option>
                  <option value="Beauty & Personal Care">Barber Shops & Salons</option>
                  <option value="Automotive Services">Auto Repair & Detailing</option>
                  <option value="Legal & Professional">Legal & Consulting Offices</option>
                </select>
              </div>

              {scraper.id === 'outdated-website-biz' && (
                <div className="pt-2 border-t border-[#E7E7E7] space-y-2">
                  <span className="text-xs font-mono font-semibold text-[#111111]">Audit Signals:</span>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.checkMobileViewport}
                        onChange={(e) => handleChange('checkMobileViewport', e.target.checked)}
                        className="rounded border-[#E7E7E7] text-[#EA4B0B] focus:ring-0"
                      />
                      <span>Check Viewport Meta</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.checkSsl}
                        onChange={(e) => handleChange('checkSsl', e.target.checked)}
                        className="rounded border-[#E7E7E7] text-[#EA4B0B] focus:ring-0"
                      />
                      <span>Flag Insecure HTTP</span>
                    </label>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Tech Hiring Scraper Filters */}
          {scraper.id === 'tech-hiring' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#111111] uppercase tracking-wider mb-1">
                  Role Search Query
                </label>
                <input
                  type="text"
                  value={formData.roleQuery}
                  onChange={(e) => handleChange('roleQuery', e.target.value)}
                  placeholder="e.g. React, Next.js, Node.js"
                  className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E7E7E7] rounded text-xs focus:bg-white focus:border-[#111111] focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#111111] uppercase tracking-wider mb-1">
                    Company Size
                  </label>
                  <select
                    value={formData.companySize}
                    onChange={(e) => handleChange('companySize', e.target.value)}
                    className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E7E7E7] rounded text-xs focus:bg-white focus:border-[#111111] focus:outline-none"
                  >
                    <option value="Seed / Series A">Seed / Series A (1-25)</option>
                    <option value="Startup & Mid-size">Startup & Mid-size (25-200)</option>
                    <option value="Bootstrapped">Bootstrapped / Profitable</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={formData.excludeEnterprise}
                      onChange={(e) => handleChange('excludeEnterprise', e.target.checked)}
                      className="rounded border-[#E7E7E7] text-[#EA4B0B] focus:ring-0"
                    />
                    <span className="font-semibold text-[#111111]">Exclude Enterprise MNCs</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Freelance RFP Scraper Filters */}
          {scraper.id === 'freelance-req' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#111111] uppercase tracking-wider mb-1">
                  Service Domain
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E7E7E7] rounded text-xs focus:bg-white focus:border-[#111111] focus:outline-none"
                >
                  <option value="UI/UX & Web Development">UI/UX & Modern Web Development</option>
                  <option value="Shopify & E-commerce Migration">Shopify & E-commerce Migration</option>
                  <option value="Fullstack React & Mobile MVP">Fullstack React & Mobile MVP</option>
                  <option value="API & Backend Architecture">API & Backend Architecture</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#111111] uppercase tracking-wider mb-1">
                  Minimum Budget ($ USD)
                </label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  value={formData.minBudget}
                  onChange={(e) => handleChange('minBudget', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#F5F5F5] border border-[#E7E7E7] rounded text-xs focus:bg-white focus:border-[#111111] focus:outline-none"
                />
              </div>
            </>
          )}

          {/* Max results slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-[#111111] uppercase tracking-wider">
                Max Yield Records
              </label>
              <span className="text-xs font-mono font-bold text-[#EA4B0B]">{formData.maxResults} leads</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={formData.maxResults}
              onChange={(e) => handleChange('maxResults', Number(e.target.value))}
              className="w-full accent-[#EA4B0B]"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-[#E7E7E7] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#111111] hover:bg-[#F5F5F5] rounded border border-[#E7E7E7] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-[#EA4B0B] hover:bg-[#d44000] text-white text-xs font-semibold rounded shadow-xs active:scale-95 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Dispatch Worker Run</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
