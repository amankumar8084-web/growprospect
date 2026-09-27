import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  ExternalLink, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Copy, 
  Check, 
  ChevronLeft, 
  ChevronRight,
  Eye,
  Globe,
  Phone,
  Mail,
  Trash2,
  Cpu,
  Key,
  Layers,
  X,
  AlertTriangle
} from 'lucide-react';
import { exportLeadsToCsv, exportLeadsToExcel, exportLeadsToJson } from '../services/exportService';

const STANDARD_SCRAPERS = [
  { id: 'no-website-biz', name: 'No-Website Business Finder' },
  { id: 'outdated-website-biz', name: 'Outdated-Website Business Finder' },
  { id: 'tech-hiring', name: 'Tech Hiring Finder' },
  { id: 'freelance-req', name: 'Freelancer Requirement Finder' }
];

const STANDARD_PROVIDERS = [
  'Google Maps / Places API',
  'Geoapify Places API',
  'OpenStreetMap (Nominatim)',
  'Crawlee + Playwright',
  'Job Boards API',
  'Contract RSS'
];

export default function LeadsTable({ 
  leads = [], 
  onSelectLead, 
  onDeleteLead,
  onDeleteLeads,
  title = "Discovered Leads & Opportunities", 
  description = "Normalized prospects ready for filtering, verification inspection, and CSV/Excel export.",
  initialScraper = 'ALL',
  initialSource = 'ALL'
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScraper, setSelectedScraper] = useState(initialScraper);
  const [selectedProvider, setSelectedProvider] = useState(initialSource);
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedVerification, setSelectedVerification] = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [selectedWebsiteStatus, setSelectedWebsiteStatus] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Deletion confirmation modal states
  const [leadToDelete, setLeadToDelete] = useState(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const itemsPerPage = 8;

  // Sync if initial props change (e.g. navigation tab clicked)
  useEffect(() => {
    if (initialScraper) {
      setSelectedScraper(initialScraper);
      setCurrentPage(1);
    }
  }, [initialScraper]);

  useEffect(() => {
    if (initialSource) {
      setSelectedProvider(initialSource);
      setCurrentPage(1);
    }
  }, [initialSource]);

  // Clean up selected IDs that no longer exist in leads
  useEffect(() => {
    const currentLeadIdSet = new Set(leads.map(l => l.id));
    setSelectedIds(prev => {
      let changed = false;
      const next = new Set();
      prev.forEach(id => {
        if (currentLeadIdSet.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [leads]);

  // Available scrapers derived from standard list + actual leads data
  const availableScrapers = useMemo(() => {
    const map = new Map(STANDARD_SCRAPERS.map(s => [s.id, s.name]));
    leads.forEach(l => {
      if (l.scraperId) {
        map.set(l.scraperId, l.scraperName || l.scraperId);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [leads]);

  // Available providers/sources derived from standard list + actual leads data
  const availableProviders = useMemo(() => {
    const set = new Set(STANDARD_PROVIDERS);
    leads.forEach(l => {
      if (l.source) set.add(l.source);
    });
    return Array.from(set);
  }, [leads]);

  // Opportunity types derived from leads
  const opportunityTypes = useMemo(() => {
    const types = new Set(leads.map((l) => l.opportunityType).filter(Boolean));
    return Array.from(types);
  }, [leads]);

  // Locations derived from leads
  const availableLocations = useMemo(() => {
    return Array.from(new Set(leads.map(l => l.location))).filter(Boolean);
  }, [leads]);

  const websiteStatuses = [
    'Unknown', 'No Website', 'Website Exists', 'Website Unreachable', 'Outdated Website', 'Modern Website'
  ];

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (lead.name && lead.name.toLowerCase().includes(q)) ||
        (lead.location && lead.location.toLowerCase().includes(q)) ||
        (lead.category && lead.category.toLowerCase().includes(q)) ||
        (lead.email && lead.email.toLowerCase().includes(q)) ||
        (lead.phone && lead.phone.includes(q)) ||
        (lead.source && lead.source.toLowerCase().includes(q)) ||
        (lead.scraperName && lead.scraperName.toLowerCase().includes(q));

      // Exact Scraper filter
      const leadScraper = lead.scraperId || 'no-website-biz';
      const matchesScraper = selectedScraper === 'ALL' || leadScraper === selectedScraper;

      // Exact API Provider / Key Source filter
      const leadSource = lead.source || '';
      const matchesProvider = selectedProvider === 'ALL' || 
        leadSource === selectedProvider || 
        leadSource.toLowerCase().includes(selectedProvider.toLowerCase());

      const matchesType = selectedType === 'ALL' || lead.opportunityType === selectedType;
      const matchesVerification = 
        selectedVerification === 'ALL' || 
        lead.emailVerificationStatus === selectedVerification;
      const matchesLocation = selectedLocation === 'ALL' || lead.location === selectedLocation;
      const matchesWebsiteStatus = selectedWebsiteStatus === 'ALL' || (lead.website_status === selectedWebsiteStatus || (!lead.website_status && selectedWebsiteStatus === 'Unknown'));

      return matchesSearch && matchesScraper && matchesProvider && matchesType && matchesVerification && matchesLocation && matchesWebsiteStatus;
    });
  }, [leads, searchQuery, selectedScraper, selectedProvider, selectedType, selectedVerification, selectedLocation, selectedWebsiteStatus]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLeads.slice(start, start + itemsPerPage);
  }, [filteredLeads, currentPage]);

  // Selection handlers
  const isAllPageSelected = paginatedLeads.length > 0 && paginatedLeads.every(l => selectedIds.has(l.id));
  const isSomePageSelected = paginatedLeads.some(l => selectedIds.has(l.id)) && !isAllPageSelected;
  const isAllFilteredSelected = filteredLeads.length > 0 && filteredLeads.every(l => selectedIds.has(l.id));

  const toggleSelectRow = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectPage = () => {
    if (isAllPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginatedLeads.forEach(l => next.delete(l.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginatedLeads.forEach(l => next.add(l.id));
        return next;
      });
    }
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredLeads.map(l => l.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Delete actions
  const confirmDeleteSingle = () => {
    if (!leadToDelete) return;
    if (onDeleteLead) {
      onDeleteLead(leadToDelete.id);
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(leadToDelete.id);
      return next;
    });
    setLeadToDelete(null);
  };

  const confirmDeleteBulk = () => {
    if (selectedIds.size === 0) return;
    const idsList = Array.from(selectedIds);
    if (onDeleteLeads) {
      onDeleteLeads(idsList);
    } else if (onDeleteLead) {
      idsList.forEach(id => onDeleteLead(id));
    }
    setSelectedIds(new Set());
    setIsBulkDeleting(false);
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Badge helper functions
  const getProviderBadge = (source) => {
    if (!source) return { label: 'Unknown Provider', color: 'bg-[#F5F5F5] text-[#8A8A8A] border-[#E7E7E7]' };
    const s = source.toLowerCase();
    if (s.includes('google')) {
      return { label: 'Google Places API', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    if (s.includes('geoapify')) {
      return { label: 'Geoapify API', color: 'bg-[#FFF5F0] text-[#EA4B0B] border-[#FFE2D5]' };
    }
    if (s.includes('openstreetmap') || s.includes('nominatim') || s.includes('osm')) {
      return { label: 'OpenStreetMap', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (s.includes('crawlee') || s.includes('playwright')) {
      return { label: 'Crawlee + Browser', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    }
    if (s.includes('job') || s.includes('hiring')) {
      return { label: 'Job Boards API', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
    }
    if (s.includes('rss') || s.includes('contract') || s.includes('rfp')) {
      return { label: 'Contract RSS', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    return { label: source, color: 'bg-gray-100 text-gray-800 border-gray-200' };
  };

  const getScraperBadge = (scraperId, scraperName) => {
    const s = (scraperId || '').toLowerCase();
    if (s.includes('no-website')) {
      return { label: 'No-Website Finder', color: 'bg-[#111111] text-white border-[#111111]' };
    }
    if (s.includes('outdated')) {
      return { label: 'Outdated Website', color: 'bg-[#FFF1EB] text-[#EA4B0B] border-orange-200' };
    }
    if (s.includes('hiring') || s.includes('tech')) {
      return { label: 'Tech Hiring', color: 'bg-blue-900 text-white border-blue-900' };
    }
    if (s.includes('freelance') || s.includes('rfp')) {
      return { label: 'Freelancer RFP', color: 'bg-zinc-700 text-white border-zinc-700' };
    }
    return { label: scraperName || 'Custom Scraper', color: 'bg-gray-800 text-white border-gray-800' };
  };

  const selectedLeadsList = useMemo(() => {
    return leads.filter(l => selectedIds.has(l.id));
  }, [leads, selectedIds]);

  const hasActiveFilters = searchQuery || selectedScraper !== 'ALL' || selectedProvider !== 'ALL' || selectedType !== 'ALL' || selectedVerification !== 'ALL' || selectedLocation !== 'ALL' || selectedWebsiteStatus !== 'ALL';

  return (
    <div className="bg-white border border-[#E7E7E7] rounded-2xl overflow-hidden mb-8 shadow-sm">
      {/* Table Header Controls */}
      <div className="p-6 border-b border-[#E7E7E7] bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-extrabold text-[#111111] tracking-tight">
              {title}
            </h2>
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#111111] text-white">
              {filteredLeads.length}
            </span>
            {selectedIds.size > 0 && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#EA4B0B] text-white animate-pulse">
                {selectedIds.size} Selected
              </span>
            )}
          </div>
          <p className="text-sm text-[#8A8A8A] mt-1">
            {description}
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportLeadsToCsv(selectedIds.size > 0 ? selectedLeadsList : filteredLeads)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#E7E7E7] border border-[#E7E7E7] rounded text-xs font-mono font-medium text-[#111111] transition-colors cursor-pointer"
            title={selectedIds.size > 0 ? `Export ${selectedIds.size} selected leads to CSV` : "Export filtered records to standard CSV"}
          >
            <Download className="w-3.5 h-3.5 text-[#EA4B0B]" />
            <span>{selectedIds.size > 0 ? `Export CSV (${selectedIds.size})` : 'Export CSV'}</span>
          </button>

          <button
            onClick={() => exportLeadsToExcel(selectedIds.size > 0 ? selectedLeadsList : filteredLeads)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#217346] hover:bg-[#1a5c38] border border-[#217346] rounded-lg text-xs font-medium text-white transition-colors cursor-pointer shadow-sm"
            title={selectedIds.size > 0 ? `Export ${selectedIds.size} selected leads to Excel` : "Export to native Excel format"}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
            <span>{selectedIds.size > 0 ? `Export Excel (${selectedIds.size})` : 'Export Excel'}</span>
          </button>

          <button
            onClick={() => exportLeadsToJson(selectedIds.size > 0 ? selectedLeadsList : filteredLeads)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#E7E7E7] border border-[#E7E7E7] rounded text-xs font-mono font-medium text-[#111111] transition-colors cursor-pointer"
            title="Export to JSON"
          >
            <FileText className="w-3.5 h-3.5 text-[#8A8A8A]" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* ── Filter and Search Bar ── */}
      <div className="px-6 py-4 border-b border-[#E7E7E7] flex flex-wrap items-center justify-between gap-3 bg-white">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
            <input
              type="text"
              placeholder="Search company, location, email, source..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-2 text-sm bg-[#F5F5F5] border border-[#E7E7E7] rounded-xl focus:bg-white focus:border-[#111111] focus:outline-none placeholder:text-[#8A8A8A]"
            />
          </div>

          {/* EXACT FILTER 1: Scraper Engine */}
          <div className="flex items-center gap-1.5 bg-[#F5F5F5] px-2.5 py-1 rounded-lg border border-[#E7E7E7]">
            <Cpu className="w-3.5 h-3.5 text-[#EA4B0B]" />
            <span className="text-xs font-mono font-semibold text-[#111111]">Scraper:</span>
            <select
              value={selectedScraper}
              onChange={(e) => {
                setSelectedScraper(e.target.value);
                setCurrentPage(1);
              }}
              className="py-1 px-1.5 text-xs bg-transparent border-0 focus:outline-none font-medium text-[#111111] cursor-pointer"
            >
              <option value="ALL">All Scrapers</option>
              {availableScrapers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* EXACT FILTER 2: API Provider / Key Source */}
          <div className="flex items-center gap-1.5 bg-[#F5F5F5] px-2.5 py-1 rounded-lg border border-[#E7E7E7]">
            <Key className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-mono font-semibold text-[#111111]">API / Provider:</span>
            <select
              value={selectedProvider}
              onChange={(e) => {
                setSelectedProvider(e.target.value);
                setCurrentPage(1);
              }}
              className="py-1 px-1.5 text-xs bg-transparent border-0 focus:outline-none font-medium text-[#111111] cursor-pointer"
            >
              <option value="ALL">All API Providers & Sources</option>
              {availableProviders.map((prov) => (
                <option key={prov} value={prov}>{prov}</option>
              ))}
            </select>
          </div>

          {/* Opportunity Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono text-[#8A8A8A]">Type:</span>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-[#F5F5F5] border border-[#E7E7E7] rounded focus:bg-white focus:border-[#111111] focus:outline-none"
            >
              <option value="ALL">All Types</option>
              {opportunityTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Verification Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono text-[#8A8A8A]">Status:</span>
            <select
              value={selectedVerification}
              onChange={(e) => {
                setSelectedVerification(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-[#F5F5F5] border border-[#E7E7E7] rounded focus:bg-white focus:border-[#111111] focus:outline-none"
            >
              <option value="ALL">All Verification</option>
              <option value="verified">Verified Email</option>
              <option value="unverified">Unverified</option>
              <option value="pending">Pending Enrichment</option>
              <option value="not_applicable">N/A (No Website)</option>
            </select>
          </div>

          {/* Location Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono text-[#8A8A8A]">Location:</span>
            <select
              value={selectedLocation}
              onChange={(e) => {
                setSelectedLocation(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-[#F5F5F5] border border-[#E7E7E7] rounded focus:bg-white focus:border-[#111111] focus:outline-none max-w-[140px]"
            >
              <option value="ALL">All Locations</option>
              {availableLocations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Website Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono text-[#8A8A8A]">Web Status:</span>
            <select
              value={selectedWebsiteStatus}
              onChange={(e) => {
                setSelectedWebsiteStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-[#F5F5F5] border border-[#E7E7E7] rounded focus:bg-white focus:border-[#111111] focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              {websiteStatuses.map((ws) => (
                <option key={ws} value={ws}>{ws}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters Reset */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedScraper('ALL');
              setSelectedProvider('ALL');
              setSelectedType('ALL');
              setSelectedVerification('ALL');
              setSelectedLocation('ALL');
              setSelectedWebsiteStatus('ALL');
              setCurrentPage(1);
            }}
            className="text-xs font-mono text-[#EA4B0B] hover:underline font-semibold"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Bulk Actions Floating Toolbar (When Leads Are Selected) ── */}
      {selectedIds.size > 0 && (
        <div className="bg-[#111111] text-white px-6 py-3 flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EA4B0B] animate-ping" />
              <span className="text-xs font-mono font-bold tracking-wider uppercase text-[#E7E7E7]">
                {selectedIds.size} of {filteredLeads.length} leads selected
              </span>
            </div>

            {selectedIds.size < filteredLeads.length && (
              <button
                onClick={selectAllFiltered}
                className="text-xs font-semibold text-[#EA4B0B] hover:text-white underline transition-colors cursor-pointer"
              >
                Select all {filteredLeads.length} leads
              </button>
            )}

            <button
              onClick={deselectAll}
              className="text-xs text-[#8A8A8A] hover:text-white transition-colors cursor-pointer ml-2"
            >
              Deselect All
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Bulk Delete Button */}
            <button
              onClick={() => setIsBulkDeleting(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm hover:shadow"
              title="Permanently delete all selected leads"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Permanently ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Main Leads Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E7E7E7] bg-[#F5F5F5] text-[11px] font-mono text-[#8A8A8A] uppercase tracking-wider">
              {/* Select All Checkbox Column */}
              <th className="py-3.5 pl-5 pr-2 w-10">
                <input
                  type="checkbox"
                  checked={isAllPageSelected}
                  ref={el => {
                    if (el) el.indeterminate = isSomePageSelected;
                  }}
                  onChange={toggleSelectPage}
                  className="w-4 h-4 rounded border-[#CCCCCC] text-[#EA4B0B] focus:ring-[#EA4B0B] cursor-pointer"
                  title={isAllPageSelected ? "Deselect page" : "Select all on page"}
                />
              </th>
              <th className="py-3.5 px-4 font-semibold">Company / Name</th>
              <th className="py-3.5 px-4 font-semibold">Scraper Engine</th>
              <th className="py-3.5 px-4 font-semibold">API Provider / Source</th>
              <th className="py-3.5 px-4 font-semibold">Category</th>
              <th className="py-3.5 px-4 font-semibold">Location</th>
              <th className="py-3.5 px-4 font-semibold">Contact</th>
              <th className="py-3.5 px-4 font-semibold">Website Status</th>
              <th className="py-3.5 px-4 font-semibold">Lead Status</th>
              <th className="py-3.5 pr-5 pl-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F0] text-sm">
            {paginatedLeads.length > 0 ? (
              paginatedLeads.map((lead) => {
                const isSelected = selectedIds.has(lead.id);
                const providerBadge = getProviderBadge(lead.source);
                const scraperBadge = getScraperBadge(lead.scraperId, lead.scraperName);

                return (
                  <tr 
                    key={lead.id} 
                    className={`transition-colors group ${
                      isSelected 
                        ? 'bg-[#FFF8F5] hover:bg-[#FFF3EC]' 
                        : 'hover:bg-[#FAFAFA]'
                    }`}
                  >
                    
                    {/* Row Selection Checkbox */}
                    <td className="py-3.5 pl-5 pr-2 w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(lead.id)}
                        className="w-4 h-4 rounded border-[#CCCCCC] text-[#EA4B0B] focus:ring-[#EA4B0B] cursor-pointer"
                      />
                    </td>

                    {/* Name & Website */}
                    <td className="py-3.5 px-4 font-semibold text-[#111111] text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#F5F5F5] border border-[#E7E7E7] flex items-center justify-center text-[11px] font-bold text-[#111] shrink-0">
                          {(lead.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-gray-900">{lead.name}</span>
                            {lead.website && (
                              <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-[#8A8A8A] hover:text-[#EA4B0B] transition-colors" title={`Visit ${lead.website}`}>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Scraper Engine Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-medium border ${scraperBadge.color}`}>
                        <Cpu className="w-3 h-3 shrink-0 opacity-80" />
                        <span>{scraperBadge.label}</span>
                      </span>
                    </td>

                    {/* API Provider / Key Source Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-medium border ${providerBadge.color}`}>
                        <Key className="w-3 h-3 shrink-0 opacity-80" />
                        <span>{providerBadge.label}</span>
                      </span>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 text-[#8A8A8A] text-sm max-w-[150px] truncate" title={lead.category}>
                      {lead.category || 'Commercial Services'}
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-4 text-[#111111] text-sm max-w-[160px] truncate" title={lead.location}>
                      {lead.location}
                    </td>

                    {/* Contact Details */}
                    <td className="py-3.5 px-4 text-sm">
                      <div className="space-y-0.5">
                        {lead.email ? (
                          <div className="flex items-center gap-1.5 text-[#111111]">
                            <Mail className="w-3 h-3 text-[#8A8A8A] shrink-0" />
                            <span className="truncate max-w-[150px] text-xs font-mono">{lead.email}</span>
                            <button
                              onClick={() => handleCopy(lead.email, `mail-${lead.id}`)}
                              className="text-[#8A8A8A] hover:text-[#111111]"
                              title="Copy email"
                            >
                              {copiedId === `mail-${lead.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[#8A8A8A] italic text-xs">—</span>
                        )}

                        {lead.phone && (
                          <div className="flex items-center gap-1.5 text-[#8A8A8A] text-xs font-mono">
                            <Phone className="w-3 h-3 shrink-0" />
                            <span>{lead.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Website Status */}
                    <td className="py-3.5 px-4">
                      {(() => {
                        const ws = lead.website_status || (lead.website ? 'Website Exists' : 'No Website');
                        const wsStyles = {
                          'No Website': 'bg-[#111111] text-white',
                          'Website Exists': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
                          'Modern Website': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
                          'Outdated Website': 'bg-[#FFF1EB] text-[#EA4B0B] border border-orange-200',
                          'Website Unreachable': 'bg-amber-50 text-amber-700 border border-amber-200',
                          'Unknown': 'bg-[#F5F5F5] text-[#8A8A8A] border border-[#E7E7E7]',
                        };
                        return (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-mono font-medium ${wsStyles[ws] || wsStyles['Unknown']}`}>
                            {ws}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Lead Status */}
                    <td className="py-3.5 px-4">
                      {(() => {
                        const status = lead.opportunityType || lead.lead_status || 'new';
                        const statusStyles = {
                          'no website': 'bg-[#111111] text-white border border-[#111111]',
                          'outdated website ui': 'bg-[#FFF1EB] text-[#EA4B0B] border border-orange-200',
                          'new': 'bg-[#F5F5F5] text-[#111111] border border-[#E7E7E7]',
                          'contacted': 'bg-amber-50 text-amber-800 border border-amber-200',
                          'qualified': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
                          'converted': 'bg-[#111111] text-white border border-[#111111]',
                          'in review': 'bg-[#EA4B0B]/10 text-[#EA4B0B] border border-[#EA4B0B]/20',
                        };
                        const style = statusStyles[status.toLowerCase()] || 'bg-[#F5F5F5] text-[#111111] border border-[#E7E7E7]';
                        return (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${style}`}>
                            {status}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Actions: Inspect & Delete */}
                    <td className="py-3.5 pr-5 pl-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => onSelectLead(lead)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#E7E7E7] hover:bg-[#111111] hover:text-white hover:border-[#111111] transition-all cursor-pointer"
                          title="Inspect full lead signals and provenance"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>

                        <button
                          onClick={() => setLeadToDelete(lead)}
                          className="p-1.5 text-[#8A8A8A] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Permanently delete this lead"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="10" className="py-14 text-center text-sm text-[#8A8A8A]">
                  <AlertCircle className="w-7 h-7 mx-auto mb-2 text-[#CCCCCC]" />
                  <p className="font-semibold text-gray-700">No leads match your active filters.</p>
                  <p className="text-xs text-gray-500 mt-1">Try clearing search, adjusting your scraper/API provider filter, or launching a new scraper run.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-6 py-4 border-t border-[#E7E7E7] bg-[#F5F5F5] flex items-center justify-between text-xs font-mono">
        <span className="text-[#8A8A8A] font-medium">
          Page {currentPage} of {totalPages} ({filteredLeads.length} total leads matching filters)
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded border border-[#E7E7E7] bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#FAFAFA]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded border border-[#E7E7E7] bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#FAFAFA]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Single Lead Permanent Deletion Confirmation Modal ── */}
      {leadToDelete && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7E7E7] animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#111111]">Permanently Delete Lead?</h3>
                <p className="text-xs text-[#8A8A8A]">This action is irreversible.</p>
              </div>
            </div>

            <div className="bg-[#F5F5F5] border border-[#E7E7E7] rounded-xl p-3 mb-5 space-y-1.5 text-xs font-mono">
              <div className="font-bold text-[#111111]">{leadToDelete.name}</div>
              <div className="text-[#8A8A8A]">Location: {leadToDelete.location}</div>
              <div className="text-[#8A8A8A]">Scraper: {leadToDelete.scraperName || leadToDelete.scraperId}</div>
              <div className="text-[#8A8A8A]">API Source: {leadToDelete.source}</div>
            </div>

            <p className="text-xs text-gray-600 mb-6">
              Are you sure you want to permanently delete this lead? It will be removed from your database and storage permanently.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setLeadToDelete(null)}
                className="px-4 py-2 border border-[#E7E7E7] rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteSingle}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                Yes, Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Delete Permanent Confirmation Modal ── */}
      {isBulkDeleting && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E7E7E7] animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#111111]">Delete {selectedIds.size} Leads Permanently?</h3>
                <p className="text-xs text-[#8A8A8A]">This bulk action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 mb-6">
              You are about to permanently delete <strong className="text-red-600 font-bold">{selectedIds.size} selected leads</strong> from your storage. These records will be removed immediately.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBulkDeleting(false)}
                className="px-4 py-2 border border-[#E7E7E7] rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteBulk}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                Delete {selectedIds.size} Leads Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
