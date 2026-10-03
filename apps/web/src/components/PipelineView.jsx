import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  DndContext, 
  DragOverlay, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  useDroppable, 
  useDraggable 
} from '@dnd-kit/core';
import { crmService } from '../services/crmService';
import { storage } from '../services/storage';
import { sessionManager } from '../services/sessionManager';
import { PIPELINE_STAGES } from '../constants/crm';
import { 
  Search, 
  Filter, 
  User, 
  DollarSign, 
  Clock, 
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Tag,
  ChevronDown,
  X,
  Lock,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Layers,
  TrendingUp,
  Briefcase,
  Sparkles
} from 'lucide-react';

// Enhanced Pipeline Stage Themes matching Dashboard
const STAGE_THEMES = {
  New: {
    label: 'New',
    color: '#94a3b8',
    dotBg: 'bg-slate-400',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    columnBorder: 'border-slate-200',
    columnBg: 'bg-slate-50/50'
  },
  Contacted: {
    label: 'Contacted',
    color: '#2563eb',
    dotBg: 'bg-blue-500',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    columnBorder: 'border-blue-200',
    columnBg: 'bg-blue-50/30'
  },
  Replied: {
    label: 'Replied',
    color: '#f59e0b',
    dotBg: 'bg-amber-500',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    columnBorder: 'border-amber-200',
    columnBg: 'bg-amber-50/30'
  },
  Meeting: {
    label: 'Meeting',
    color: '#8b5cf6',
    dotBg: 'bg-purple-500',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    columnBorder: 'border-purple-200',
    columnBg: 'bg-purple-50/30'
  },
  Proposal: {
    label: 'Proposal',
    color: '#6366f1',
    dotBg: 'bg-indigo-500',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    columnBorder: 'border-indigo-200',
    columnBg: 'bg-indigo-50/30'
  },
  Won: {
    label: 'Won',
    color: '#16a34a',
    dotBg: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    columnBorder: 'border-emerald-200',
    columnBg: 'bg-emerald-50/30'
  },
  Lost: {
    label: 'Lost',
    color: '#f43f5e',
    dotBg: 'bg-rose-500',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    columnBorder: 'border-rose-200',
    columnBg: 'bg-rose-50/30'
  }
};

const LOST_REASONS = [
  'no budget',
  'no response',
  'chose competitor',
  'not a fit',
  'other'
];

/**
 * Enhanced Draggable Kanban Card Component
 */
function KanbanCard({ lead, stageName, isOverlay = false, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead, stageName }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 999
  } : undefined;

  // Overdue check
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const isOverdue = lead.next_followup && new Date(lead.next_followup).setHours(0, 0, 0, 0) < now.getTime();
  const formattedFollowup = lead.next_followup ? new Date(lead.next_followup).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  }) : null;

  const dealValueNum = lead.deal_value ? Number(lead.deal_value) : null;
  const locationStr = lead.city ? `${lead.city}, ${lead.country || 'US'}` : lead.location || null;
  const ownerName = lead.assigned_to_name || lead.owner_name || 'Unassigned';
  const ownerInitial = ownerName ? ownerName.trim().charAt(0).toUpperCase() : 'U';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (!isDragging && onClick) {
          onClick(lead);
        }
      }}
      className={`p-3.5 bg-white border rounded-xl transition-all cursor-grab active:cursor-grabbing select-none group relative ${
        isOverlay 
          ? 'border-[#ea580c] shadow-2xl rotate-1 scale-105 z-50 ring-4 ring-[#ea580c]/10' 
          : isDragging 
            ? 'opacity-25 border-dashed border-[#ea580c]' 
            : 'border-gray-100 hover:border-gray-300 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md'
      }`}
    >
      {/* Top Header: Company Name & Deal Value */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="font-bold text-xs text-gray-900 group-hover:text-[#ea580c] transition-colors line-clamp-1">
          {lead.company_name || lead.name}
        </div>
        {dealValueNum !== null && !isNaN(dealValueNum) && dealValueNum > 0 && (
          <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md shrink-0">
            ${dealValueNum.toLocaleString()}
          </div>
        )}
      </div>

      {/* Contact & Location */}
      <div className="space-y-1 mb-2">
        {lead.name && lead.name !== lead.company_name && (
          <div className="text-[11px] text-gray-600 truncate font-medium">
            {lead.name} {lead.job_title ? `· ${lead.job_title}` : ''}
          </div>
        )}
        {locationStr && (
          <div className="flex items-center gap-1 text-[11px] text-gray-400 truncate">
            <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="truncate">{locationStr}</span>
          </div>
        )}
      </div>

      {/* Tags Pill Bar */}
      {Array.isArray(lead.tags) && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {lead.tags.slice(0, 2).map((tag) => (
            <span 
              key={tag} 
              className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-600"
            >
              {tag}
            </span>
          ))}
          {lead.tags.length > 2 && (
            <span className="text-[10px] font-medium px-1 py-0.5 text-gray-400">
              +{lead.tags.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Card Footer: Owner Avatar & Next Follow-up */}
      <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 text-[11px]">
        {/* Owner Avatar */}
        <div className="flex items-center gap-1.5 text-gray-600 truncate max-w-[120px]">
          <div 
            className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${
              lead.assigned_to || lead.owner_id ? 'bg-gray-900' : 'bg-gray-400'
            }`}
          >
            {ownerInitial}
          </div>
          <span className="truncate font-medium text-gray-700">{ownerName}</span>
        </div>

        {/* Next Follow-up */}
        {formattedFollowup ? (
          <div 
            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-semibold shrink-0 ${
              isOverdue 
                ? 'bg-rose-50 border border-rose-200 text-rose-700' 
                : 'bg-gray-50 border border-gray-200 text-gray-600'
            }`}
            title={isOverdue ? `Overdue since ${formattedFollowup}` : `Next follow-up: ${formattedFollowup}`}
          >
            <Clock className={`w-3 h-3 ${isOverdue ? 'text-rose-600' : 'text-gray-400'}`} />
            <span>{formattedFollowup}</span>
          </div>
        ) : (
          <span className="text-[10px] text-gray-400 italic">No follow-up</span>
        )}
      </div>
    </div>
  );
}

/**
 * Enhanced Droppable Stage Column Component
 */
function KanbanColumn({ 
  stageName, 
  leads = [], 
  visibleCount = 25, 
  onLoadMore, 
  onSelectLead 
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stageName
  });

  const theme = STAGE_THEMES[stageName] || STAGE_THEMES.New;

  // Compute total deal value for this stage
  const stageTotalValue = useMemo(() => {
    return leads.reduce((sum, l) => {
      const val = l.deal_value ? Number(l.deal_value) : 0;
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [leads]);

  const visibleLeads = leads.slice(0, visibleCount);
  const hasMore = leads.length > visibleCount;

  return (
    <div 
      ref={setNodeRef}
      className={`flex-1 min-w-[270px] max-w-[320px] flex flex-col bg-gray-50/70 border rounded-2xl p-3.5 transition-all ${
        isOver 
          ? 'border-[#ea580c] bg-orange-50/30 ring-2 ring-[#ea580c]/20' 
          : 'border-gray-200'
      }`}
    >
      {/* Column Header */}
      <div className="pb-3 mb-3 border-b border-gray-200/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${theme.dotBg}`} />
            <span className="text-xs font-bold text-gray-900 tracking-tight">
              {stageName}
            </span>
          </div>

          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-bold ${theme.badgeClass}`}>
            {leads.length}
          </span>
        </div>

        {/* Total deal value badge */}
        {stageTotalValue > 0 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200/60 text-[11px]">
            <span className="text-gray-400 font-medium">Stage Value:</span>
            <span className="font-bold text-gray-800">
              ${stageTotalValue.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Cards List Container */}
      <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[calc(100vh-290px)] pr-1 custom-scrollbar">
        {visibleLeads.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-xl bg-white/60">
            <p className="text-xs text-gray-400 font-medium">No deals in this stage</p>
          </div>
        ) : (
          visibleLeads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              stageName={stageName}
              onClick={onSelectLead}
            />
          ))
        )}

        {hasMore && (
          <button
            onClick={() => onLoadMore && onLoadMore(stageName)}
            className="w-full py-2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            Load More ({leads.length - visibleCount} remaining)
          </button>
        )}
      </div>
    </div>
  );
}

export default function PipelineView({ onSelectLead }) {
  const [pipelineSummary, setPipelineSummary] = useState(null);
  const [allLeads, setAllLeads] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [selectedTag, setSelectedTag] = useState('ALL');
  const [visibleCounts, setVisibleCounts] = useState({});

  // Active DnD Drag Lead
  const [activeLead, setActiveLead] = useState(null);

  // Lost Reason Modal State
  const [lostModalData, setLostModalData] = useState(null);
  const [selectedLostReason, setSelectedLostReason] = useState('no budget');
  const [customLostNote, setCustomLostNote] = useState('');
  const [isSubmittingLost, setIsSubmittingLost] = useState(false);

  const currentUser = sessionManager.getSessionInfo()?.user;
  const currentUserId = currentUser?.id || 'usr_anonymous';
  const currentRole = sessionManager.getRole();

  // Sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    })
  );

  // Fetch Pipeline Data
  const fetchPipeline = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedLeads = storage.getLeads();
      setAllLeads(storedLeads || []);

      const [summaryData, membersData, locsData] = await Promise.all([
        crmService.getPipelineSummary().catch(() => null),
        crmService.getTeamMembers().catch(() => []),
        crmService.getLocations().catch(() => [])
      ]);

      if (summaryData) setPipelineSummary(summaryData);
      if (membersData) setTeamMembers(membersData);
      if (locsData) setLocationOptions(locsData);
    } catch (err) {
      console.error('[PipelineView] Failed to load pipeline:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  // Subscribe to storage changes
  useEffect(() => {
    const unsub = storage.subscribe(() => {
      const stored = storage.getLeads();
      setAllLeads(stored || []);
    });
    return unsub;
  }, []);

  // Filtered Leads per Stage
  const filteredStages = useMemo(() => {
    const stageMap = {};
    PIPELINE_STAGES.forEach(s => {
      stageMap[s] = [];
    });

    allLeads.forEach(lead => {
      const rawStage = (lead.pipeline_stage || lead.status || 'New').toLowerCase();
      let matchedStage = PIPELINE_STAGES.find(s => s.toLowerCase() === rawStage) || 'New';

      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (lead.name || lead.company_name || '').toLowerCase().includes(q);
        const matchesEmail = (lead.email || '').toLowerCase().includes(q);
        const matchesPhone = (lead.phone || '').includes(q);
        const matchesLoc = (lead.location || lead.city || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesLoc) return;
      }

      // 2. Owner Filter
      if (selectedOwner !== 'ALL') {
        if (selectedOwner === 'my') {
          const isMine = lead.owner_id === currentUserId || lead.assigned_to === currentUserId;
          if (!isMine) return;
        } else if (selectedOwner === 'unassigned') {
          if (lead.owner_id || lead.assigned_to) return;
        } else {
          if (lead.owner_id !== selectedOwner && lead.assigned_to !== selectedOwner) return;
        }
      }

      // 3. Location Filter
      if (selectedLocation !== 'ALL') {
        const loc = (lead.city ? `${lead.city}, ${lead.country || 'US'}` : lead.location || '').toLowerCase();
        if (!loc.includes(selectedLocation.toLowerCase())) return;
      }

      // 4. Tag Filter
      if (selectedTag !== 'ALL') {
        const tags = Array.isArray(lead.tags) ? lead.tags : [];
        if (!tags.includes(selectedTag)) return;
      }

      stageMap[matchedStage].push(lead);
    });

    return stageMap;
  }, [allLeads, searchQuery, selectedOwner, selectedLocation, selectedTag, currentUserId]);

  // Global Pipeline Summary Metrics
  const { totalFilteredCount, totalFilteredValue, wonValue, activeValue } = useMemo(() => {
    let count = 0;
    let totalVal = 0;
    let wonVal = 0;
    let activeVal = 0;

    Object.entries(filteredStages).forEach(([stage, leadsArr]) => {
      leadsArr.forEach(l => {
        count++;
        const val = l.deal_value ? Number(l.deal_value) : 0;
        const validVal = isNaN(val) ? 0 : val;
        totalVal += validVal;
        if (stage === 'Won') wonVal += validVal;
        else if (stage !== 'Lost') activeVal += validVal;
      });
    });

    return { totalFilteredCount: count, totalFilteredValue: totalVal, wonValue: wonVal, activeValue: activeVal };
  }, [filteredStages]);

  // Tag options
  const tagOptions = useMemo(() => {
    const set = new Set();
    allLeads.forEach(l => {
      if (Array.isArray(l.tags)) l.tags.forEach(t => set.add(t));
    });
    return Array.from(set).sort();
  }, [allLeads]);

  // Load More handler
  const handleLoadMore = (stageName) => {
    setVisibleCounts(prev => ({
      ...prev,
      [stageName]: (prev[stageName] || 25) + 25
    }));
  };

  // Drag Handlers
  const handleDragStart = (event) => {
    const { active } = event;
    const lead = active.data.current?.lead;
    if (lead) {
      setActiveLead(lead);
    }
  };

  const performStageUpdate = async (leadId, targetStage, sourceStage, extraFields = {}) => {
    // Optimistic UI Update
    setAllLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          pipeline_stage: targetStage,
          status: targetStage.toLowerCase(),
          ...extraFields,
          last_activity_at: new Date().toISOString()
        };
      }
      return l;
    }));

    try {
      await crmService.editLead(leadId, {
        status: targetStage.toLowerCase(),
        pipeline_stage: targetStage,
        ...extraFields
      });
    } catch (err) {
      // Rollback on error
      console.error('[PipelineView] Stage update failed, rolling back:', err);
      setAllLeads(prev => prev.map(l => {
        if (l.id === leadId) {
          return {
            ...l,
            pipeline_stage: sourceStage,
            status: sourceStage.toLowerCase()
          };
        }
        return l;
      }));
      alert(`Error updating stage: ${err.message}`);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveLead(null);

    if (!over) return;

    const leadId = active.id;
    const sourceStage = active.data.current?.stageName;
    const targetStage = over.id;

    if (!sourceStage || !targetStage || sourceStage === targetStage) return;
    if (!PIPELINE_STAGES.includes(targetStage)) return;

    const draggedLead = active.data.current?.lead;

    // Rep role validation
    if (currentRole === 'rep') {
      const isOwned = draggedLead.owner_id === currentUserId || draggedLead.assigned_to === currentUserId;
      const isUnassigned = !draggedLead.owner_id && !draggedLead.assigned_to;
      if (!isOwned && !isUnassigned) {
        alert('Permission Denied: Sales reps may only update leads assigned to them or unassigned leads.');
        return;
      }
    }

    // Lost modal if dropping into Lost
    if (targetStage === 'Lost') {
      setLostModalData({
        lead: draggedLead,
        sourceStage,
        targetStage
      });
      setSelectedLostReason('no budget');
      setCustomLostNote('');
      return;
    }

    await performStageUpdate(leadId, targetStage, sourceStage);
  };

  const handleConfirmLost = async () => {
    if (!lostModalData) return;
    const finalReason = selectedLostReason === 'other'
      ? (customLostNote.trim() || 'other')
      : (customLostNote.trim() ? `${selectedLostReason}: ${customLostNote.trim()}` : selectedLostReason);

    setIsSubmittingLost(true);
    try {
      await performStageUpdate(
        lostModalData.lead.id,
        lostModalData.targetStage,
        lostModalData.sourceStage,
        { lost_reason: finalReason }
      );
      setLostModalData(null);
    } finally {
      setIsSubmittingLost(false);
    }
  };

  return (
    <div className="space-y-5 font-sans">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Pipeline
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 font-normal">
            Drag cards between columns to advance stages across your sales pipeline.
          </p>
        </div>

        {/* Refresh / Sync Button */}
        <button
          onClick={fetchPipeline}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs sm:text-sm font-semibold rounded-lg shadow-2xs transition-all cursor-pointer self-start sm:self-auto"
          title="Refresh Kanban"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Sync Pipeline</span>
        </button>
      </div>

      {/* 4 Top Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Deals */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            <span>TOTAL DEALS</span>
            <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 leading-none my-1">
            {totalFilteredCount}
          </div>
          <div className="text-[11px] text-gray-500">
            Across {PIPELINE_STAGES.length} pipeline stages
          </div>
        </div>

        {/* Total Pipeline Value */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            <span>TOTAL PIPELINE VALUE</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-600 leading-none my-1">
            ${totalFilteredValue.toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-500">
            All active & closed opportunities
          </div>
        </div>

        {/* Active Pipeline */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            <span>ACTIVE OPPORTUNITIES</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-600 leading-none my-1">
            ${activeValue.toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-500">
            In progress (excl. Won/Lost)
          </div>
        </div>

        {/* Won Value */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            <span>CLOSED WON</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-600 leading-none my-1">
            ${wonValue.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <span>Closed contract revenue</span>
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="p-3.5 bg-white border border-gray-100 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative w-56 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search company, contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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

          {/* Owner Filter */}
          <div className="relative">
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className="py-1.5 pl-3 pr-8 bg-gray-50/70 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:bg-white focus:outline-none appearance-none cursor-pointer"
            >
              <option value="ALL">All Team Deals</option>
              <option value="my">My Leads</option>
              <option value="unassigned">Unassigned Only</option>
              {teamMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Location Filter */}
          <div className="relative">
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="py-1.5 pl-3 pr-8 bg-gray-50/70 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:bg-white focus:outline-none appearance-none cursor-pointer max-w-[170px] truncate"
            >
              <option value="ALL">All Locations ({locationOptions.length})</option>
              {locationOptions.map(({ loc, count }) => (
                <option key={loc} value={loc}>
                  {loc} ({count})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Tag Filter */}
          {tagOptions.length > 0 && (
            <div className="relative">
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="py-1.5 pl-3 pr-8 bg-gray-50/70 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:bg-white focus:outline-none appearance-none cursor-pointer max-w-[150px] truncate"
              >
                <option value="ALL">All Tags ({tagOptions.length})</option>
                {tagOptions.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>

        {(searchQuery || selectedOwner !== 'ALL' || selectedLocation !== 'ALL' || selectedTag !== 'ALL') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedOwner('ALL');
              setSelectedLocation('ALL');
              setSelectedTag('ALL');
            }}
            className="text-xs text-[#ea580c] hover:underline font-semibold cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* DndContext Kanban Board */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-6">
          <div className="flex gap-4 min-w-[1850px]">
            {PIPELINE_STAGES.map((stageName) => (
              <KanbanColumn
                key={stageName}
                stageName={stageName}
                leads={filteredStages[stageName] || []}
                visibleCount={visibleCounts[stageName] || 25}
                onLoadMore={handleLoadMore}
                onSelectLead={onSelectLead}
              />
            ))}
          </div>
        </div>

        {/* Drag Overlay for smooth preview */}
        <DragOverlay>
          {activeLead ? (
            <KanbanCard
              lead={activeLead}
              stageName={activeLead.pipeline_stage || 'New'}
              isOverlay={true}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Dropping into Lost: Modal */}
      {lostModalData && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-gray-100 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 font-sans">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200">
                  STAGE: LOST
                </span>
                <h3 className="text-base font-bold text-gray-900 mt-1">
                  Why was this deal lost?
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Select a category or add context for team audit records.
                </p>
              </div>
              <button
                onClick={() => setLostModalData(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason Category
                </label>
                <select
                  value={selectedLostReason}
                  onChange={(e) => setSelectedLostReason(e.target.value)}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:bg-white focus:outline-none cursor-pointer"
                >
                  {LOST_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Lead went with competitor due to pricing difference..."
                  value={customLostNote}
                  onChange={(e) => setCustomLostNote(e.target.value)}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setLostModalData(null)}
                className="px-3.5 py-2 border border-gray-200 text-xs font-semibold text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLost}
                disabled={isSubmittingLost}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSubmittingLost ? 'Saving...' : 'Confirm Lost'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
