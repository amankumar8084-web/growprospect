import React, { useState, useMemo } from 'react';
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
  Mail
} from 'lucide-react';
import { exportLeadsToCsv, exportLeadsToExcel, exportLeadsToJson } from '../services/exportService';

export default function LeadsTable({ leads, onSelectLead, title = "Discovered Leads & Opportunities", description = "Normalized prospects ready for filtering, verification inspection, and CSV/Excel export." }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedVerification, setSelectedVerification] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [selectedWebsiteStatus, setSelectedWebsiteStatus] = useState('ALL');
  const [activeScraperTab, setActiveScraperTab] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState(null);
  const itemsPerPage = 8;

  // Filter options derived from current dataset
  const opportunityTypes = useMemo(() => {
    const types = new Set(leads.map((l) => l.opportunityType));
    return Array.from(types);
  }, [leads]);

  const availableScrapers = useMemo(() => {
    const map = new Map();
    leads.forEach(l => {
      if (l.scraperId) map.set(l.scraperId, l.scraperName || l.source);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [leads]);

  const availableSources = useMemo(() => {
    return Array.from(new Set(leads.map(l => l.source))).filter(Boolean);
  }, [leads]);

  const availableLocations = useMemo(() => {
    return Array.from(new Set(leads.map(l => l.location))).filter(Boolean);
  }, [leads]);

  const websiteStatuses = [
    'Unknown', 'No Website', 'Website Exists', 'Website Unreachable', 'Outdated Website', 'Modern Website'
  ];

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch = 
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lead.email && lead.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (lead.phone && lead.phone.includes(searchQuery));

      const matchesType = selectedType === 'ALL' || lead.opportunityType === selectedType;
      const matchesVerification = 
        selectedVerification === 'ALL' || 
        lead.emailVerificationStatus === selectedVerification;
      const matchesSource = selectedSource === 'ALL' || lead.source === selectedSource;
      const matchesLocation = selectedLocation === 'ALL' || lead.location === selectedLocation;
      const matchesWebsiteStatus = selectedWebsiteStatus === 'ALL' || (lead.website_status === selectedWebsiteStatus || (!lead.website_status && selectedWebsiteStatus === 'Unknown'));

      return matchesSearch && matchesType && matchesVerification && matchesSource && matchesLocation && matchesWebsiteStatus;
    });
  }, [leads, searchQuery, selectedType, selectedVerification, selectedSource, selectedLocation, selectedWebsiteStatus]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage) || 1;
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLeads.slice(start, start + itemsPerPage);
  }, [filteredLeads, currentPage]);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

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
          </div>
          <p className="text-sm text-[#8A8A8A] mt-1">
            {description}
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportLeadsToCsv(filteredLeads)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#E7E7E7] border border-[#E7E7E7] rounded text-xs font-mono font-medium text-[#111111] transition-colors cursor-pointer"
            title="Export filtered records to standard CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#EA4B0B]" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => exportLeadsToExcel(filteredLeads)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#217346] hover:bg-[#1a5c38] border border-[#217346] rounded-lg text-xs font-medium text-white transition-colors cursor-pointer shadow-sm"
            title="Export to native Excel format"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => exportLeadsToJson(filteredLeads)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#E7E7E7] border border-[#E7E7E7] rounded text-xs font-mono font-medium text-[#111111] transition-colors cursor-pointer"
            title="Export to JSON"
          >
            <FileText className="w-3.5 h-3.5 text-[#8A8A8A]" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-4 border-b border-[#E7E7E7] flex flex-wrap items-center justify-between gap-3 bg-white">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
            <input
              type="text"
              placeholder="Search company, location, email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-2 text-sm bg-[#F5F5F5] border border-[#E7E7E7] rounded-xl focus:bg-white focus:border-[#111111] focus:outline-none placeholder:text-[#8A8A8A]"
            />
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

          {/* Source Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono text-[#8A8A8A]">Source:</span>
            <select
              value={selectedSource}
              onChange={(e) => {
                setSelectedSource(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2.5 py-1.5 text-xs bg-[#F5F5F5] border border-[#E7E7E7] rounded focus:bg-white focus:border-[#111111] focus:outline-none"
            >
              <option value="ALL">All Sources</option>
              {availableSources.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
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
              className="px-2.5 py-1.5 text-xs bg-[#F5F5F5] border border-[#E7E7E7] rounded focus:bg-white focus:border-[#111111] focus:outline-none max-w-[150px]"
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
        {(searchQuery || selectedType !== 'ALL' || selectedVerification !== 'ALL' || selectedSource !== 'ALL' || selectedLocation !== 'ALL' || selectedWebsiteStatus !== 'ALL') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedType('ALL');
              setSelectedVerification('ALL');
              setSelectedSource('ALL');
              setSelectedLocation('ALL');
              setSelectedWebsiteStatus('ALL');
              setCurrentPage(1);
            }}
            className="text-xs font-mono text-[#EA4B0B] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E7E7E7] bg-[#F5F5F5] text-[11px] font-mono text-[#8A8A8A] uppercase tracking-wider">
              <th className="py-3.5 px-5 font-semibold">Company / Name</th>
              <th className="py-3.5 px-5 font-semibold">Source</th>
              <th className="py-3.5 px-5 font-semibold">Category</th>
              <th className="py-3.5 px-5 font-semibold">Location</th>
              <th className="py-3.5 px-5 font-semibold">Contact</th>
              <th className="py-3.5 px-5 font-semibold">Website Status</th>
              <th className="py-3.5 px-5 font-semibold">Lead Status</th>
              <th className="py-3.5 px-5 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F0] text-sm">
            {paginatedLeads.length > 0 ? (
              paginatedLeads.map((lead) => {
                const isNoWebsite = lead.opportunityType === 'No Website' || !lead.website;
                return (
                  <tr key={lead.id} className="hover:bg-[#FAFAFA] transition-colors group">
                    
                    {/* Name & Website */}
                    <td className="py-3.5 px-5 font-semibold text-[#111111] text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#F5F5F5] border border-[#E7E7E7] flex items-center justify-center text-[11px] font-bold text-[#111] shrink-0">
                          {(lead.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span>{lead.name}</span>
                            {lead.website && (
                              <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-[#8A8A8A] hover:text-[#EA4B0B] transition-colors" title={`Visit ${lead.website}`}>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Source Badge */}
                    <td className="py-3.5 px-5">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-[#F5F5F5] border border-[#E7E7E7] text-[#111111]">
                        {lead.source}
                      </span>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-5 text-[#8A8A8A] text-sm">
                      {lead.category}
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-5 text-[#111111] text-sm">
                      {lead.location}
                    </td>

                    {/* Contact Details */}
                    <td className="py-3.5 px-5 text-sm">
                      <div className="space-y-0.5">
                        {lead.email ? (
                          <div className="flex items-center gap-1.5 text-[#111111]">
                            <Mail className="w-3 h-3 text-[#8A8A8A] shrink-0" />
                            <span className="truncate max-w-[160px] text-sm">{lead.email}</span>
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
                          <span className="text-[#8A8A8A] italic text-sm">—</span>
                        )}

                        {lead.phone && (
                          <div className="flex items-center gap-1.5 text-[#8A8A8A] text-xs">
                            <Phone className="w-3 h-3 shrink-0" />
                            <span>{lead.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Website Status */}
                    <td className="py-3.5 px-5">
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
                    <td className="py-3.5 px-5">
                      {(() => {
                        const status = lead.opportunityType || lead.lead_status || 'new';
                        const statusStyles = {
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

                    {/* Action */}
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => onSelectLead(lead)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E7E7E7] hover:bg-[#111111] hover:text-white hover:border-[#111111] transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>

                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" className="py-12 text-center text-sm text-[#8A8A8A]">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2 text-[#CCCCCC]" />
                  No leads match your active filters. Try clearing search or run a new scraper.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-6 py-4 border-t border-[#E7E7E7] bg-[#F5F5F5] flex items-center justify-between text-xs font-mono">
        <span className="text-[#8A8A8A] font-medium">
          Page {currentPage} of {totalPages} ({filteredLeads.length} total leads)
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
    </div>
  );
}
