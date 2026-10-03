import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Upload,
  ChevronDown, 
  ChevronsUpDown, 
  Globe, 
  Mail, 
  Phone, 
  MapPin, 
  Eye, 
  Trash2, 
  X, 
  AlertTriangle,
  Building2,
  DollarSign,
  Tag,
  Clock,
  User,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { PIPELINE_STAGES } from '../constants/crm';
import { crmService } from '../services/crmService';
import { storage } from '../services/storage';
import { sessionManager } from '../services/sessionManager';
import { soundService } from '../services/soundService';
import CsvImportModal from './CsvImportModal';

// Modern status badge styling matching Dashboard theme
const STATUS_STYLES = {
  new: {
    label: 'New',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
  },
  contacted: {
    label: 'Contacted',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  'follow-up': {
    label: 'Follow-up',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  followup: {
    label: 'Follow-up',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  replied: {
    label: 'Follow-up',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  interested: {
    label: 'Interested',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
  meeting: {
    label: 'Interested',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
  proposal: {
    label: 'Interested',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
  closed: {
    label: 'Closed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  won: {
    label: 'Closed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  lost: {
    label: 'Lost',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  }
};

export default function LeadsTable({ 
  leads = [], 
  onSelectLead, 
  onDeleteLead,
  onDeleteLeads,
  onLeadsUpdated,
  title = "Clients", 
  description = null,
  initialScraper = 'ALL'
}) {
  const currentUser = sessionManager.getSessionInfo()?.user;
  const currentUserId = currentUser?.id || 'usr_anonymous';
  const userRole = sessionManager.getRole();
  const isManagerOrAdmin = userRole === 'admin' || userRole === 'manager';

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('updated'); // 'client' | 'status' | 'updated'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

  // Modals & Notifications
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importNotification, setImportNotification] = useState(null);
  const [lostModalLeadId, setLostModalLeadId] = useState(null);
  const [lostReasonInput, setLostReasonInput] = useState('');
  const [claimingId, setClaimingId] = useState(null);

  // Add Client Form State
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    location: '',
    category: '',
    deal_value: '',
    status: 'new',
    notes: ''
  });
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);

  // Handle Add Client Submit
  const handleAddClient = async (e) => {
    e.preventDefault();
    if (!newClientForm.company_name.trim() && !newClientForm.name.trim()) {
      alert('Please enter at least a company name or contact name');
      return;
    }

    setIsSubmittingClient(true);
    try {
      const newLead = {
        id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: newClientForm.name.trim() || 'Direct Client',
        company_name: newClientForm.company_name.trim() || newClientForm.name.trim(),
        email: newClientForm.email.trim(),
        phone: newClientForm.phone.trim(),
        location: newClientForm.location.trim(),
        city: newClientForm.location.trim(),
        tags: newClientForm.category.trim() ? [newClientForm.category.trim()] : [],
        opportunityType: newClientForm.category.trim(),
        deal_value: Number(newClientForm.deal_value) || 0,
        status: newClientForm.status,
        pipeline_stage: newClientForm.status === 'closed' ? 'Won' : newClientForm.status.charAt(0).toUpperCase() + newClientForm.status.slice(1),
        notes: newClientForm.notes.trim(),
        source: 'Manual Client Entry',
        created_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        org_id: sessionManager.getOrgId() || 'org_default'
      };

      storage.addLead(newLead);
      soundService.playSuccessSound();
      setIsAddClientOpen(false);
      setNewClientForm({
        name: '',
        company_name: '',
        email: '',
        phone: '',
        location: '',
        category: '',
        deal_value: '',
        status: 'new',
        notes: ''
      });
    } catch (err) {
      alert('Failed to add client: ' + err.message);
    } finally {
      setIsSubmittingClient(false);
    }
  };

  // Filter & Search Logic
  const filteredClients = useMemo(() => {
    return leads.filter((lead) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL') {
        const leadStatus = (lead.status || lead.pipeline_stage || 'new').toLowerCase();
        if (statusFilter === 'follow-up') {
          if (leadStatus !== 'follow-up' && leadStatus !== 'followup' && leadStatus !== 'replied') return false;
        } else if (statusFilter === 'interested') {
          if (leadStatus !== 'interested' && leadStatus !== 'meeting' && leadStatus !== 'proposal') return false;
        } else if (statusFilter === 'closed') {
          if (leadStatus !== 'closed' && leadStatus !== 'won') return false;
        } else if (leadStatus !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (lead.name || lead.company_name || '').toLowerCase().includes(q);
        const matchesEmail = (lead.email || '').toLowerCase().includes(q);
        const matchesPhone = (lead.phone || '').includes(q);
        const matchesLoc = (lead.location || lead.city || '').toLowerCase().includes(q);
        const matchesCategory = Array.isArray(lead.tags) && lead.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesLoc && !matchesCategory) return false;
      }

      return true;
    });
  }, [leads, statusFilter, searchQuery]);

  // Sorting
  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => {
      if (sortField === 'client') {
        const nameA = (a.company_name || a.name || '').toLowerCase();
        const nameB = (b.company_name || b.name || '').toLowerCase();
        return sortDirection === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      }
      if (sortField === 'status') {
        const statusA = (a.status || 'new').toLowerCase();
        const statusB = (b.status || 'new').toLowerCase();
        return sortDirection === 'asc' ? statusA.localeCompare(statusB) : statusB.localeCompare(statusA);
      }
      // default: updated date
      const dateA = new Date(a.last_activity_at || a.created_at || a.scrapedAt || 0).getTime();
      const dateB = new Date(b.last_activity_at || b.created_at || b.scrapedAt || 0).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [filteredClients, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedClients.length / itemsPerPage) || 1;
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedClients.slice(start, start + itemsPerPage);
  }, [sortedClients, currentPage, itemsPerPage]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Inline status change handler
  const handleInlineStatusChange = async (lead, newStatus) => {
    if (newStatus === 'lost') {
      setLostModalLeadId(lead.id);
      return;
    }
    try {
      await crmService.editLead(lead.id, { status: newStatus });
    } catch (err) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  const handleConfirmLostStatus = async () => {
    if (!lostReasonInput.trim()) {
      alert('Please provide a lost reason');
      return;
    }
    try {
      await crmService.editLead(lostModalLeadId, { status: 'lost', lost_reason: lostReasonInput.trim() });
      setLostModalLeadId(null);
      setLostReasonInput('');
    } catch (err) {
      alert(`Error setting lost status: ${err.message}`);
    }
  };

  // Rep Claim Handler
  const handleClaimLead = async (leadId) => {
    setClaimingId(leadId);
    try {
      await crmService.claimLead(leadId);
    } catch (err) {
      alert(err.message);
    } finally {
      setClaimingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Top Header: Title, Total Clients subtitle, Import CSV & + Add Client Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            {title}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5 font-normal">
            {leads.length} total clients
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs sm:text-sm font-semibold rounded-lg shadow-2xs active:scale-95 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4 text-gray-500" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => setIsAddClientOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* Import Notification Banner */}
      {importNotification && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{importNotification}</span>
          </div>
          <button 
            onClick={() => setImportNotification(null)}
            className="text-emerald-700 hover:text-emerald-900 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main White Rounded Card */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        {/* Filter Bar */}
        <div className="p-3.5 border-b border-gray-100 flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative min-w-[240px] sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search company, contact, email..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-8 py-1.5 bg-gray-50/70 border border-gray-200 rounded-lg text-xs font-normal focus:bg-white focus:border-gray-400 focus:outline-none placeholder:text-gray-400 text-gray-800 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="py-1.5 pl-3 pr-8 bg-gray-50/70 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:bg-white focus:outline-none appearance-none cursor-pointer"
            >
              <option value="ALL">All statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="follow-up">Follow-up</option>
              <option value="interested">Interested</option>
              <option value="closed">Closed</option>
              <option value="lost">Lost</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Per Page Dropdown */}
          <div className="relative">
            <select
              value={itemsPerPage}
              onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="py-1.5 pl-3 pr-8 bg-gray-50/70 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:bg-white focus:outline-none appearance-none cursor-pointer"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Table / Empty State */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                <th 
                  className="py-3 px-4 cursor-pointer select-none hover:text-gray-600 transition-colors"
                  onClick={() => handleSort('client')}
                >
                  <div className="flex items-center gap-1">
                    <span>CLIENT</span>
                    <ChevronsUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">CONTACT</th>
                <th className="py-3 px-4">LOCATION</th>
                <th className="py-3 px-4">CATEGORY</th>
                <th 
                  className="py-3 px-4 cursor-pointer select-none hover:text-gray-600 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    <span>STATUS</span>
                    <ChevronsUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">OWNER</th>
                <th 
                  className="py-3 px-4 cursor-pointer select-none hover:text-gray-600 transition-colors"
                  onClick={() => handleSort('updated')}
                >
                  <div className="flex items-center gap-1">
                    <span>UPDATED</span>
                    <ChevronDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>

            {paginatedClients.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={8} className="py-24 text-center">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-900">No clients found</p>
                      <p className="text-xs text-gray-400">Get started by adding your first client.</p>
                      <button
                        onClick={() => setIsAddClientOpen(true)}
                        className="mt-3 inline-flex items-center gap-1 px-3.5 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Add Client</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-gray-100">
                {paginatedClients.map((client) => {
                  const isUnassigned = !client.owner_id && !client.assigned_to;
                  const isOwnedByMe = client.owner_id === currentUserId || client.assigned_to === currentUserId;
                  const isReadOnlyForRep = userRole === 'rep' && !isOwnedByMe && !isUnassigned;

                  const rawStatus = (client.status || client.pipeline_stage || 'new').toLowerCase();
                  const statusConfig = STATUS_STYLES[rawStatus] || STATUS_STYLES.new;

                  const categoryTag = Array.isArray(client.tags) && client.tags.length > 0
                    ? client.tags[0]
                    : client.opportunityType || 'General';

                  return (
                    <tr 
                      key={client.id}
                      className="hover:bg-gray-50/60 transition-colors group"
                    >
                      {/* CLIENT */}
                      <td className="py-3.5 px-4 min-w-[180px]">
                        <div 
                          className="font-semibold text-sm text-gray-900 hover:text-[#ea580c] cursor-pointer truncate transition-colors"
                          onClick={() => onSelectLead && onSelectLead(client)}
                        >
                          {client.company_name || client.name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                          {client.website ? (
                            <a
                              href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline text-gray-400 hover:text-[#ea580c] flex items-center gap-1 truncate max-w-[140px]"
                            >
                              <Globe className="w-3 h-3 shrink-0" />
                              <span className="truncate">{client.website.replace(/^https?:\/\//, '')}</span>
                            </a>
                          ) : (
                            <span className="italic text-[10px]">No website</span>
                          )}

                          {client.deal_value > 0 && (
                            <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px] border border-emerald-200">
                              ${Number(client.deal_value).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* CONTACT */}
                      <td className="py-3.5 px-4 min-w-[140px]">
                        <div className="text-gray-800 font-medium truncate">
                          {client.name && client.name !== client.company_name ? client.name : client.job_title || '—'}
                        </div>
                        <div className="text-[11px] text-gray-400 flex flex-col mt-0.5 space-y-0.5">
                          {client.email && (
                            <a href={`mailto:${client.email}`} className="hover:text-[#ea580c] truncate flex items-center gap-1">
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="truncate">{client.email}</span>
                            </a>
                          )}
                          {client.phone && (
                            <a href={`tel:${client.phone}`} className="hover:text-[#ea580c] flex items-center gap-1">
                              <Phone className="w-3 h-3 shrink-0" />
                              <span>{client.phone}</span>
                            </a>
                          )}
                        </div>
                      </td>

                      {/* LOCATION */}
                      <td className="py-3.5 px-4 text-gray-600 text-xs font-normal">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                          <span>{client.city ? `${client.city}, ${client.country || 'US'}` : client.location || '—'}</span>
                        </div>
                      </td>

                      {/* CATEGORY */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-600 rounded-md text-[11px] font-medium">
                          {categoryTag}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="py-3.5 px-4">
                        <select
                          value={rawStatus}
                          onChange={(e) => handleInlineStatusChange(client, e.target.value)}
                          disabled={isReadOnlyForRep}
                          className={`py-1 px-2.5 rounded-full border text-xs font-medium focus:outline-none cursor-pointer transition-all disabled:opacity-50 ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="follow-up">Follow-up</option>
                          <option value="interested">Interested</option>
                          <option value="closed">Closed</option>
                          <option value="lost">Lost</option>
                        </select>
                      </td>

                      {/* OWNER */}
                      <td className="py-3.5 px-4">
                        {isUnassigned ? (
                          userRole === 'rep' ? (
                            <button
                              onClick={() => handleClaimLead(client.id)}
                              disabled={claimingId === client.id}
                              className="px-2 py-1 bg-orange-50 hover:bg-orange-100 text-[#ea580c] border border-orange-200 rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              {claimingId === client.id ? 'Claiming...' : '+ Claim'}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400 italic font-normal">Unassigned</span>
                          )
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-[9px] shrink-0">
                              {(client.assigned_to_name || client.owner_id || 'U').charAt(0).toUpperCase()}
                            </span>
                            <span className="text-gray-700 font-medium truncate max-w-[90px]">
                              {isOwnedByMe ? 'You' : client.assigned_to_name || client.owner_id}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* UPDATED */}
                      <td className="py-3.5 px-4 text-gray-400 text-xs">
                        {formatDate(client.last_activity_at || client.created_at || client.scrapedAt)}
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onSelectLead && onSelectLead(client)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {isManagerOrAdmin && (
                            <button
                              onClick={() => {
                                if (confirm(`Delete client "${client.company_name || client.name}"?`)) {
                                  if (onDeleteLead) onDeleteLead(client.id);
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Client"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>

        {/* Pagination Footer */}
        {sortedClients.length > 0 && (
          <div className="p-3.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span className="font-normal">
              Showing <strong className="text-gray-800">{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong className="text-gray-800">{Math.min(currentPage * itemsPerPage, sortedClients.length)}</strong> of <strong className="text-gray-800">{sortedClients.length}</strong> clients
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none text-xs font-medium text-gray-700 cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 font-semibold text-gray-800">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none text-xs font-medium text-gray-700 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Client Modal */}
      {isAddClientOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#ea580c] flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Add New Client</h3>
                  <p className="text-xs text-gray-400">Directly add a new client to your CRM pipeline</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddClientOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddClient} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Company / Client Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Acme Corp"
                    value={newClientForm.company_name}
                    onChange={(e) => setNewClientForm({ ...newClientForm, company_name: e.target.value })}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-gray-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Contact Person Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah Jenkins"
                    value={newClientForm.name}
                    onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-gray-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="sarah@acmecorp.com"
                    value={newClientForm.email}
                    onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-gray-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={newClientForm.phone}
                    onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-gray-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Location / City</label>
                  <input
                    type="text"
                    placeholder="New York, US"
                    value={newClientForm.location}
                    onChange={(e) => setNewClientForm({ ...newClientForm, location: e.target.value })}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-gray-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Category / Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. SaaS, Healthcare, E-commerce"
                    value={newClientForm.category}
                    onChange={(e) => setNewClientForm({ ...newClientForm, category: e.target.value })}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-gray-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Deal Value ($)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="5000"
                    value={newClientForm.deal_value}
                    onChange={(e) => setNewClientForm({ ...newClientForm, deal_value: e.target.value })}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-gray-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Initial Status</label>
                  <select
                    value={newClientForm.status}
                    onChange={(e) => setNewClientForm({ ...newClientForm, status: e.target.value })}
                    className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-gray-900 focus:outline-none cursor-pointer"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="follow-up">Follow-up</option>
                    <option value="interested">Interested</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1 text-xs">Notes / Deal Brief</label>
                <textarea
                  rows={2}
                  placeholder="Key background info or client requirements..."
                  value={newClientForm.notes}
                  onChange={(e) => setNewClientForm({ ...newClientForm, notes: e.target.value })}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-gray-900 focus:outline-none text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddClientOpen(false)}
                  className="px-4 py-2 border border-gray-200 text-xs font-semibold text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClient}
                  className="px-4 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingClient ? 'Saving...' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lost Reason Modal */}
      {lostModalLeadId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-gray-900">Why was this client lost?</h3>
            </div>
            <textarea
              required
              rows={3}
              placeholder="e.g. Budget constraints, chose competitor, unreachable"
              value={lostReasonInput}
              onChange={(e) => setLostReasonInput(e.target.value)}
              className="w-full text-xs p-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-gray-900 focus:outline-none font-normal"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLostModalLeadId(null)}
                className="px-3.5 py-2 border border-gray-200 text-xs font-semibold text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLostStatus}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Confirm Lost
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV / Excel Import Modal */}
      <CsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={(importedCount) => {
          setImportNotification(`Successfully imported ${importedCount} client${importedCount === 1 ? '' : 's'}!`);
          if (onLeadsUpdated) {
            onLeadsUpdated();
          }
          setTimeout(() => setImportNotification(null), 5000);
        }}
      />
    </div>
  );
}
