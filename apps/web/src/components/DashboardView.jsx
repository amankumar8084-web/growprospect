import React, { useState, useEffect, useMemo } from 'react';
import { crmService } from '../services/crmService';
import { storage } from '../services/storage';
import { sessionManager } from '../services/sessionManager';
import { soundService } from '../services/soundService';
import { useUser, UserButton } from '@clerk/clerk-react';
import { 
  Users, 
  UserPlus, 
  Phone, 
  ArrowUpRight, 
  Star, 
  CheckCircle2, 
  TrendingUp, 
  Search, 
  Bell, 
  Plus, 
  ChevronRight,
  X,
  Building2,
  Mail,
  DollarSign,
  Calendar,
  Sparkles
} from 'lucide-react';

export default function DashboardView({ onSelectLead, onNavigate }) {
  const { user } = useUser();
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);

  // New Client Form State
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    deal_value: '',
    status: 'new',
    notes: ''
  });
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);

  // Fetch dashboard data
  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const data = await crmService.getDashboard({ scope: 'all', range: 'all' });
      setDashboardData(data);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // Re-sync on storage changes
  useEffect(() => {
    const unsub = storage.subscribe(() => {
      loadDashboard();
    });
    return unsub;
  }, []);

  // Format today's date matching the screenshot
  const formattedDate = useMemo(() => {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return `${now.toLocaleDateString('en-US', options)} · Overview & Performance`;
  }, []);

  // Leads & Pipeline Stats computation
  const leads = useMemo(() => {
    return storage.getLeads() || [];
  }, [dashboardData]);

  const totalClients = leads.length;

  const statusCounts = useMemo(() => {
    const counts = {
      new: 0,
      contacted: 0,
      'follow-up': 0,
      interested: 0,
      closed: 0
    };

    leads.forEach(l => {
      const s = (l.status || l.pipeline_stage || 'new').toLowerCase();
      if (s === 'new') counts.new++;
      else if (s === 'contacted') counts.contacted++;
      else if (s === 'follow-up' || s === 'followup' || s === 'replied') counts['follow-up']++;
      else if (s === 'interested' || s === 'meeting' || s === 'proposal') counts.interested++;
      else if (s === 'closed' || s === 'won') counts.closed++;
      else counts.new++;
    });

    return counts;
  }, [leads]);

  const stagesData = [
    { key: 'new', label: 'New', count: statusCounts.new, color: '#94a3b8', dotColor: '#94a3b8' },
    { key: 'contacted', label: 'Contacted', count: statusCounts.contacted, color: '#2563eb', dotColor: '#2563eb' },
    { key: 'follow-up', label: 'Follow-up', count: statusCounts['follow-up'], color: '#f59e0b', dotColor: '#f59e0b' },
    { key: 'interested', label: 'Interested', count: statusCounts.interested, color: '#dc2626', dotColor: '#dc2626' },
    { key: 'closed', label: 'Closed', count: statusCounts.closed, color: '#16a34a', dotColor: '#16a34a' },
  ];

  // Calculate percentages
  const stagesWithPct = useMemo(() => {
    return stagesData.map(st => {
      const pct = totalClients > 0 ? Math.round((st.count / totalClients) * 100) : 0;
      return { ...st, pct };
    });
  }, [stagesData, totalClients]);

  // Max value for Y-axis scale (at least 4 to match image visual)
  const maxStageCount = Math.max(...stagesData.map(s => s.count), 4);
  const yTicks = [4, 3, 2, 1, 0];

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
        deal_value: Number(newClientForm.deal_value) || 0,
        status: newClientForm.status,
        pipeline_stage: newClientForm.status === 'closed' ? 'Won' : newClientForm.status.charAt(0).toUpperCase() + newClientForm.status.slice(1),
        notes: newClientForm.notes.trim(),
        source: 'Manual Dashboard Entry',
        created_at: new Date().toISOString(),
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
        deal_value: '',
        status: 'new',
        notes: ''
      });
      loadDashboard();
    } catch (err) {
      alert('Failed to add client: ' + err.message);
    } finally {
      setIsSubmittingClient(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Dashboard Title Row & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1 font-normal">
            {formattedDate}
          </p>
        </div>

        <div>
          <button
            onClick={() => setIsAddClientOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* 6 Top KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. TOTAL CLIENTS */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow flex flex-col justify-between min-h-[118px]">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              TOTAL CLIENTS
            </span>
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-gray-900 leading-none my-1">
            {totalClients}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+12%</span>
            <span className="text-gray-400 font-normal">vs last month</span>
          </div>
        </div>

        {/* 2. NEW */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow flex flex-col justify-between min-h-[118px]">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              NEW
            </span>
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
              <UserPlus className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-400 leading-none my-1">
            {statusCounts.new}
          </div>
          <div className="text-[11px] text-transparent select-none">-</div>
        </div>

        {/* 3. CONTACTED */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow flex flex-col justify-between min-h-[118px]">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              CONTACTED
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
              <Phone className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-blue-600 leading-none my-1">
            {statusCounts.contacted}
          </div>
          <div className="text-[11px] text-transparent select-none">-</div>
        </div>

        {/* 4. FOLLOW-UP */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow flex flex-col justify-between min-h-[118px]">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              FOLLOW-UP
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-500 leading-none my-1">
            {statusCounts['follow-up']}
          </div>
          <div className="text-[11px] text-transparent select-none">-</div>
        </div>

        {/* 5. INTERESTED */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow flex flex-col justify-between min-h-[118px]">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              INTERESTED
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
              <Star className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#ea580c] leading-none my-1">
            {statusCounts.interested}
          </div>
          <div className="text-[11px] text-transparent select-none">-</div>
        </div>

        {/* 6. CLOSED */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow flex flex-col justify-between min-h-[118px]">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              CLOSED
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-600 leading-none my-1">
            {statusCounts.closed}
          </div>
          <div className="text-[11px] text-transparent select-none">-</div>
        </div>
      </div>

      {/* 2-Column Section: Pipeline Distribution & Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
        {/* Left Column (8 cols) — Pipeline Distribution */}
        <div className="lg:col-span-8 bg-white border border-gray-100 rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between pb-4">
            <h2 className="text-sm sm:text-base font-bold text-gray-900">
              Pipeline Distribution
            </h2>
            <button
              onClick={() => onNavigate && onNavigate('pipeline')}
              className="text-xs text-gray-400 hover:text-gray-800 font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View Pipeline</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Chart Display Area */}
          <div className="mt-4 relative h-64 sm:h-72 w-full flex flex-col justify-between">
            {/* Horizontal Grid lines with Y-ticks */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
              {yTicks.map((tick) => (
                <div key={tick} className="flex items-center w-full">
                  <span className="w-6 text-[11px] text-gray-400 font-normal select-none">
                    {tick}
                  </span>
                  <div className="flex-1 border-b border-dashed border-gray-100 ml-2" />
                </div>
              ))}
            </div>

            {/* X-axis Bars / Visual Column Markers */}
            <div className="relative z-10 w-full h-full flex items-end pl-8 pr-2 pb-8">
              <div className="w-full grid grid-cols-5 h-[80%] items-end gap-2">
                {stagesWithPct.map((stage) => {
                  const barHeightPct = maxStageCount > 0 ? (stage.count / maxStageCount) * 100 : 0;
                  return (
                    <div key={stage.key} className="flex flex-col items-center justify-end h-full group">
                      {stage.count > 0 && (
                        <span className="text-[10px] font-bold text-gray-700 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {stage.count}
                        </span>
                      )}
                      <div 
                        className="w-12 sm:w-16 rounded-t-md transition-all duration-300 group-hover:opacity-90 cursor-pointer"
                        style={{
                          height: `${Math.max(barHeightPct, 2)}%`,
                          backgroundColor: stage.count > 0 ? stage.color : '#f1f5f9'
                        }}
                        title={`${stage.label}: ${stage.count} clients`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-axis Labels */}
            <div className="absolute bottom-0 left-0 right-0 pl-8 grid grid-cols-5 text-center">
              {stagesWithPct.map((stage) => (
                <span key={stage.key} className="text-xs text-gray-400 font-normal truncate px-1">
                  {stage.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) — Status Breakdown */}
        <div className="lg:col-span-4 bg-white border border-gray-100 rounded-xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-gray-900 pb-5">
              Status Breakdown
            </h2>

            {/* Status list */}
            <div className="space-y-4 pt-1">
              {stagesWithPct.map((stage) => (
                <div key={stage.key} className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-2.5">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: stage.dotColor }}
                    />
                    <span className="font-medium text-gray-700">
                      {stage.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900">
                      {stage.count}
                    </span>
                    <span className="text-xs text-gray-400 w-8 text-right font-normal">
                      {stage.pct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom subtle summary */}
          <div className="pt-6 border-t border-gray-50 mt-6 flex items-center justify-between text-xs text-gray-400">
            <span>Total Active Prospects</span>
            <span className="font-semibold text-gray-700">{totalClients}</span>
          </div>
        </div>
      </div>

      {/* Add Client Modal */}
      {isAddClientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-[#ea580c]">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Add New Client</h3>
                  <p className="text-xs text-gray-400">Add lead directly to your CRM dashboard</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddClientOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddClient} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Company / Organization <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="Acme Corp"
                    value={newClientForm.company_name}
                    onChange={(e) => setNewClientForm({ ...newClientForm, company_name: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-[#ea580c] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={newClientForm.name}
                    onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-[#ea580c] focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Deal Value ($)
                  </label>
                  <div className="relative">
                    <DollarSign className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      placeholder="5000"
                      value={newClientForm.deal_value}
                      onChange={(e) => setNewClientForm({ ...newClientForm, deal_value: e.target.value })}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-[#ea580c] focus:outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={newClientForm.email}
                    onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-[#ea580c] focus:outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={newClientForm.phone}
                    onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-[#ea580c] focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Pipeline Stage / Status
                </label>
                <select
                  value={newClientForm.status}
                  onChange={(e) => setNewClientForm({ ...newClientForm, status: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-[#ea580c] focus:outline-none transition-all cursor-pointer"
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="interested">Interested</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Initial Notes / Next Action
                </label>
                <textarea
                  rows={2}
                  placeholder="Key details or outreach context..."
                  value={newClientForm.notes}
                  onChange={(e) => setNewClientForm({ ...newClientForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-[#ea580c] focus:outline-none transition-all resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddClientOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClient}
                  className="px-4 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingClient ? 'Adding...' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
