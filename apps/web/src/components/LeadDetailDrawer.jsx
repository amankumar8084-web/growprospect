import React, { useState, useEffect } from 'react';
import { crmService } from '../services/crmService';
import { sessionManager } from '../services/sessionManager';
import { PIPELINE_STAGES, STAGE_CONFIG } from '../constants/crm';
import { 
  X, 
  ExternalLink, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Globe, 
  ShieldCheck, 
  Code, 
  Layers, 
  ArrowUpRight, 
  Trash2,
  Columns3,
  MessageSquare,
  Send,
  Clock,
  User,
  Plus,
  Lock,
  Tag,
  DollarSign
} from 'lucide-react';

export default function LeadDetailDrawer({ lead, onClose, onDeleteLead, onLeadUpdated }) {
  const [copied, setCopied] = useState(false);
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Editable lead fields state
  const [formData, setFormData] = useState({
    company_name: '',
    name: '',
    email: '',
    phone: '',
    website: '',
    deal_value: '',
    city: '',
    state: '',
    country: 'US',
    notes: '',
    next_followup: '',
    status: 'new',
    tags: []
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Lost reason prompt modal state
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReasonInput, setLostReasonInput] = useState('');

  // Quick Task Creation state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);

  const currentUser = sessionManager.getSessionInfo()?.user;
  const currentUserId = currentUser?.id || 'usr_anonymous';
  const userRole = sessionManager.getRole();

  // Check if current user is a Rep and lead is owned by someone else
  const isReadOnlyRep = userRole === 'rep' && Boolean(lead?.owner_id && lead.owner_id !== currentUserId);

  useEffect(() => {
    if (lead) {
      setFormData({
        company_name: lead.company_name || lead.name || '',
        name: lead.name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        website: lead.website || '',
        deal_value: lead.deal_value !== undefined && lead.deal_value !== null ? lead.deal_value : '',
        city: lead.city || '',
        state: lead.state || '',
        country: lead.country || 'US',
        notes: lead.notes || '',
        next_followup: lead.next_followup ? lead.next_followup.slice(0, 10) : '',
        status: (lead.status || lead.pipeline_stage || 'new').toLowerCase(),
        tags: Array.isArray(lead.tags) ? lead.tags : []
      });
      loadActivities(lead.id);
    }
  }, [lead]);

  const loadActivities = async (leadId) => {
    setLoadingActivities(true);
    try {
      const data = await crmService.getLeadActivities(leadId);
      setActivities(data);
    } catch (err) {
      console.error('Failed to load activities:', err);
    } finally {
      setLoadingActivities(false);
    }
  };

  if (!lead) return null;

  const currentStage = (formData.status.charAt(0).toUpperCase() + formData.status.slice(1));
  const stageConfig = STAGE_CONFIG[currentStage] || STAGE_CONFIG['New'];

  const handleFieldChange = (field, value) => {
    if (isReadOnlyRep) return;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveLead = async (overrideData = {}) => {
    if (isReadOnlyRep) return;
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        ...overrideData,
        deal_value: formData.deal_value ? Number(formData.deal_value) : null
      };

      const result = await crmService.editLead(lead.id, payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      if (onLeadUpdated && result.lead) {
        onLeadUpdated(result.lead);
      }
      loadActivities(lead.id);
    } catch (err) {
      alert(`Error saving lead: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (e) => {
    if (isReadOnlyRep) return;
    const newStatus = e.target.value.toLowerCase();
    if (newStatus === 'lost') {
      setShowLostModal(true);
      return;
    }
    setFormData(prev => ({ ...prev, status: newStatus }));
    await handleSaveLead({ status: newStatus });
  };

  const handleConfirmLost = async () => {
    if (!lostReasonInput.trim()) {
      alert('Please enter a reason for marking this lead as Lost');
      return;
    }
    setShowLostModal(false);
    setFormData(prev => ({ ...prev, status: 'lost', lost_reason: lostReasonInput.trim() }));
    await handleSaveLead({ status: 'lost', lost_reason: lostReasonInput.trim() });
    setLostReasonInput('');
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim() || isReadOnlyRep) return;

    setSavingNote(true);
    try {
      await crmService.addLeadActivity(lead.id, newNote.trim(), 'note');
      setNewNote('');
      loadActivities(lead.id);
    } catch (err) {
      alert(`Error adding note: ${err.message}`);
    } finally {
      setSavingNote(false);
    }
  };

  // Quick action logging
  const handleQuickAction = async (type) => {
    if (type === 'call') {
      if (lead.phone) window.open(`tel:${lead.phone}`, '_self');
      await crmService.addLeadActivity(lead.id, `Outbound phone call initiated to ${lead.phone || 'client'}`, 'call');
      loadActivities(lead.id);
    } else if (type === 'email') {
      if (lead.email) window.open(`mailto:${lead.email}`, '_self');
      await crmService.addLeadActivity(lead.id, `Email sent to ${lead.email || 'client'}`, 'email');
      loadActivities(lead.id);
    } else if (type === 'whatsapp') {
      const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
      if (cleanPhone) window.open(`https://wa.me/${cleanPhone}`, '_blank');
      await crmService.addLeadActivity(lead.id, `WhatsApp conversation opened with ${lead.phone}`, 'whatsapp');
      loadActivities(lead.id);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    setCreatingTask(true);
    try {
      await crmService.createTask({
        title: taskTitle.trim(),
        lead_id: lead.id,
        due_date: taskDueDate || null,
        assignee_id: currentUserId
      });
      setTaskTitle('');
      setTaskDueDate('');
      setShowTaskForm(false);
      await crmService.addLeadActivity(lead.id, `Scheduled task: "${taskTitle.trim()}"`, 'note');
      loadActivities(lead.id);
    } catch (err) {
      alert(`Error creating task: ${err.message}`);
    } finally {
      setCreatingTask(false);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(lead, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
      <div 
        className="w-full max-w-lg bg-white border-l border-[#E7E7E7] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-[#E7E7E7] bg-[#FAFAFA] flex items-start justify-between">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold ${stageConfig.badgeClass}`}>
                {currentStage}
              </span>
              {lead.tags && lead.tags.map((tag) => (
                <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-[#E7E7E7] text-[#111111]">
                  {tag}
                </span>
              ))}
            </div>

            <h2 className="text-xl font-bold text-[#111111] tracking-tight truncate">
              {lead.company_name || lead.name}
            </h2>

            <div className="flex items-center gap-1.5 text-xs text-[#8A8A8A] mt-1 font-mono">
              <MapPin className="w-3.5 h-3.5 text-[#EA4B0B]" />
              <span>{lead.city ? `${lead.city}, ${lead.country || 'US'}` : lead.location || 'Location Not Specified'}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white text-[#8A8A8A] hover:text-[#111111] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Read-Only Notice for Sales Reps */}
        {isReadOnlyRep && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-center gap-2 text-xs text-amber-800">
            <Lock className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              <strong>Read-Only:</strong> This lead is owned by <strong>{lead.assigned_to_name || lead.owner_id}</strong>. Sales reps may only edit leads assigned to them or unassigned leads.
            </span>
          </div>
        )}

        {/* Scrollable Drawer Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-sm">

          {/* Quick Outreach Action Bar */}
          <div className="flex items-center gap-2 p-2 bg-[#F5F5F5] border border-[#E7E7E7] rounded-lg">
            <button
              onClick={() => handleQuickAction('call')}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-emerald-50 text-[#111111] hover:text-emerald-700 text-xs font-semibold rounded border border-[#E7E7E7] transition-colors cursor-pointer"
              title="Call Lead"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Call</span>
            </button>

            <button
              onClick={() => handleQuickAction('email')}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-blue-50 text-[#111111] hover:text-blue-700 text-xs font-semibold rounded border border-[#E7E7E7] transition-colors cursor-pointer"
              title="Email Lead"
            >
              <Mail className="w-3.5 h-3.5 text-blue-600" />
              <span>Email</span>
            </button>

            <button
              onClick={() => handleQuickAction('whatsapp')}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-emerald-50 text-[#111111] hover:text-emerald-700 text-xs font-semibold rounded border border-[#E7E7E7] transition-colors cursor-pointer"
              title="Message on WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={() => setShowTaskForm(prev => !prev)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white hover:bg-orange-50 text-[#111111] hover:text-[#EA4B0B] text-xs font-semibold rounded border border-[#E7E7E7] transition-colors cursor-pointer"
              title="Create Task"
            >
              <Plus className="w-3.5 h-3.5 text-[#EA4B0B]" />
              <span>Task</span>
            </button>
          </div>

          {/* Quick Task Inline Form */}
          {showTaskForm && (
            <form onSubmit={handleCreateTask} className="p-3 bg-[#FFF9F6] border border-[#FFE7DE] rounded-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#EA4B0B] uppercase">Schedule Task</span>
                <button type="button" onClick={() => setShowTaskForm(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="What needs to be done?"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="w-full text-xs p-2 bg-white border border-[#E7E7E7] rounded focus:outline-none"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full text-xs p-1.5 bg-white border border-[#E7E7E7] rounded focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={creatingTask}
                  className="px-3 py-1.5 bg-[#EA4B0B] text-white text-xs font-semibold rounded hover:bg-[#d03f07] cursor-pointer"
                >
                  {creatingTask ? 'Saving...' : 'Add'}
                </button>
              </div>
            </form>
          )}

          {/* Status & Next Follow-Up Controller */}
          <div className="p-4 rounded-lg bg-white border border-[#E7E7E7] shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
                <Columns3 className="w-3.5 h-3.5 text-[#EA4B0B]" />
                <span>Status & Next Follow-Up</span>
              </label>
              {saveSuccess && <span className="text-[10px] font-mono text-emerald-600 font-bold">✓ Saved</span>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-[#8A8A8A] block mb-1">Pipeline Stage</span>
                <select
                  value={formData.status}
                  onChange={handleStatusChange}
                  disabled={isReadOnlyRep || isSaving}
                  className="w-full text-xs font-semibold p-2 bg-[#F5F5F5] border border-[#E7E7E7] rounded-md focus:outline-none focus:border-[#111111] cursor-pointer disabled:opacity-60"
                >
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s} value={s.toLowerCase()}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-[11px] text-[#8A8A8A] block mb-1">Next Follow-Up Date</span>
                <input
                  type="date"
                  value={formData.next_followup}
                  onChange={(e) => {
                    handleFieldChange('next_followup', e.target.value);
                    handleSaveLead({ next_followup: e.target.value });
                  }}
                  disabled={isReadOnlyRep || isSaving}
                  className="w-full text-xs p-2 bg-[#F5F5F5] border border-[#E7E7E7] rounded-md focus:outline-none focus:border-[#111111] disabled:opacity-60"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-[#F0F0F0] flex items-center justify-between text-xs">
              <span className="text-[#8A8A8A]">Owner:</span>
              <span className="font-semibold text-[#111111]">{lead.assigned_to_name || lead.owner_id || 'Unassigned'}</span>
            </div>
          </div>

          {/* Editable Lead Information Form */}
          <div className="p-4 rounded-lg bg-[#FAFAFA] border border-[#E7E7E7] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-semibold text-[#111111] uppercase tracking-wider">
                Lead Information
              </h3>
              {!isReadOnlyRep && (
                <button
                  type="button"
                  onClick={() => handleSaveLead()}
                  disabled={isSaving}
                  className="text-xs font-semibold text-[#EA4B0B] hover:underline cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[11px] text-[#8A8A8A] block mb-0.5">Company Name</label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => handleFieldChange('company_name', e.target.value)}
                  disabled={isReadOnlyRep}
                  className="w-full p-2 bg-white border border-[#E7E7E7] rounded focus:outline-none disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-[#8A8A8A] block mb-0.5">Contact Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    disabled={isReadOnlyRep}
                    className="w-full p-2 bg-white border border-[#E7E7E7] rounded focus:outline-none disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#8A8A8A] block mb-0.5">Deal Value ($)</label>
                  <input
                    type="number"
                    value={formData.deal_value}
                    onChange={(e) => handleFieldChange('deal_value', e.target.value)}
                    disabled={isReadOnlyRep}
                    placeholder="0.00"
                    className="w-full p-2 bg-white border border-[#E7E7E7] rounded focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-[#8A8A8A] block mb-0.5">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    disabled={isReadOnlyRep}
                    className="w-full p-2 bg-white border border-[#E7E7E7] rounded focus:outline-none disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#8A8A8A] block mb-0.5">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    disabled={isReadOnlyRep}
                    className="w-full p-2 bg-white border border-[#E7E7E7] rounded focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#8A8A8A] block mb-0.5">Website</label>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => handleFieldChange('website', e.target.value)}
                    disabled={isReadOnlyRep}
                    className="w-full p-2 bg-white border border-[#E7E7E7] rounded focus:outline-none disabled:opacity-60"
                  />
                  {formData.website && (
                    <a
                      href={formData.website.startsWith('http') ? formData.website : `https://${formData.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 border border-[#E7E7E7] bg-white rounded text-[#8A8A8A] hover:text-[#EA4B0B]"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-[#8A8A8A] block mb-0.5">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleFieldChange('city', e.target.value)}
                    disabled={isReadOnlyRep}
                    className="w-full p-2 bg-white border border-[#E7E7E7] rounded focus:outline-none disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#8A8A8A] block mb-0.5">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => handleFieldChange('state', e.target.value)}
                    disabled={isReadOnlyRep}
                    className="w-full p-2 bg-white border border-[#E7E7E7] rounded focus:outline-none disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#8A8A8A] block mb-0.5">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => handleFieldChange('country', e.target.value)}
                    disabled={isReadOnlyRep}
                    className="w-full p-2 bg-white border border-[#E7E7E7] rounded focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes Box */}
          <div className="p-4 rounded-lg bg-white border border-[#E7E7E7] space-y-3">
            <h3 className="text-xs font-mono font-semibold text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#EA4B0B]" />
              <span>Notes & Observations</span>
            </h3>

            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                rows={2}
                placeholder={isReadOnlyRep ? "Lead is read-only" : "Add a note or conversation summary..."}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                disabled={isReadOnlyRep}
                className="w-full text-xs p-2.5 bg-[#F5F5F5] border border-[#E7E7E7] rounded-md focus:outline-none focus:border-[#111111] disabled:opacity-60"
              />
              {!isReadOnlyRep && (
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingNote || !newNote.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-[#111111] hover:bg-black text-white text-xs font-medium rounded cursor-pointer disabled:opacity-40"
                  >
                    <Send className="w-3 h-3" />
                    <span>{savingNote ? 'Adding...' : 'Post Note'}</span>
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Activity Timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-semibold text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#111111]" />
                <span>Activity Timeline ({activities.length})</span>
              </h3>
            </div>

            {loadingActivities ? (
              <p className="text-xs text-[#8A8A8A] font-mono">Loading timeline...</p>
            ) : activities.length === 0 ? (
              <p className="text-xs text-[#8A8A8A] italic bg-[#F5F5F5] p-3 rounded border border-[#E7E7E7]">
                No recorded activities yet. Use the action buttons above or post a note to start the timeline.
              </p>
            ) : (
              <div className="space-y-2 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E7E7E7]">
                {activities.map((act) => {
                  const isStatus = act.type === 'status_change';
                  const isAssign = act.type === 'assignment';
                  const isCall = act.type === 'call';
                  const isEmail = act.type === 'email';
                  const isWhatsApp = act.type === 'whatsapp';

                  return (
                    <div key={act.id} className="relative pl-7 text-xs">
                      {/* Node circle */}
                      <span className={`absolute left-1.5 top-1.5 -translate-x-1/2 w-3.5 h-3.5 rounded-full border flex items-center justify-center bg-white ${
                        isStatus ? 'border-[#EA4B0B] text-[#EA4B0B]' : isAssign ? 'border-blue-500 text-blue-500' : 'border-gray-400 text-gray-500'
                      }`} />

                      <div className="p-2.5 rounded bg-[#FAFAFA] border border-[#E7E7E7]">
                        <div className="flex items-center justify-between text-[11px] text-[#8A8A8A] mb-1">
                          <span className="font-semibold text-[#111111] capitalize">
                            {act.user_name || act.user_id || 'Team Member'}
                          </span>
                          <span className="font-mono">
                            {act.created_at ? new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                          </span>
                        </div>
                        <p className="text-[#111111]">
                          {act.body || act.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Raw JSON Schema */}
          <div className="pt-2 border-t border-[#E7E7E7] flex items-center justify-between text-xs font-mono">
            <span className="text-[#8A8A8A]">Lead ID: {lead.id}</span>
            <button
              onClick={handleCopyJson}
              className="text-[#EA4B0B] hover:underline flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* Lost Reason Modal */}
      {showLostModal && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-[#111111]">Why was this lead lost?</h3>
            </div>
            <p className="text-xs text-[#8A8A8A]">
              A lost reason is required for team reporting and pipeline accuracy.
            </p>
            <textarea
              required
              rows={3}
              placeholder="e.g. Chose competitor, budget freeze, ghosted after proposal"
              value={lostReasonInput}
              onChange={(e) => setLostReasonInput(e.target.value)}
              className="w-full text-xs p-2.5 bg-[#F5F5F5] border border-[#E7E7E7] rounded-md focus:outline-none focus:border-[#111111]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLostModal(false)}
                className="px-3 py-1.5 border border-[#E7E7E7] text-xs font-medium rounded hover:bg-[#F5F5F5]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLost}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded"
              >
                Confirm Lost
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
