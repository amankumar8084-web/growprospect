/**
 * AIAgentsView — GrowProspect CRM
 *
 * Central command panel for all 10 AI-powered agents.
 * Each agent card is independently usable, toggleable by admins,
 * and feeds from the existing CRM lead store.
 *
 * Workflow coverage:
 *  New Lead → Research → Scoring → CRM → Outreach → Follow-up
 *  → Meeting → Proposal → Sale → Onboarding → Retention → Upsell
 */

import React, { useState, useEffect, useCallback } from 'react';
import { aiAgentService } from '../services/aiAgentService';
import { crmService } from '../services/crmService';
import { storage } from '../services/storage';
import { sessionManager } from '../services/sessionManager';
import {
  Search, Star, Mail, Calendar, Database, FileText,
  Headphones, RefreshCw, TrendingUp, BarChart2,
  Play, Copy, Check, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, Loader2, Zap, Settings,
  Brain, ArrowRight, X, MessageSquare, Phone, Linkedin
} from 'lucide-react';

// ─── Agent metadata registry (client-side) ────────────────────────────────────

const AGENT_META = {
  research:  { icon: Search,      color: 'indigo',  gradient: 'from-indigo-500 to-blue-600',     step: 1 },
  scoring:   { icon: Star,        color: 'amber',   gradient: 'from-amber-500 to-orange-500',    step: 2 },
  outreach:  { icon: Mail,        color: 'emerald', gradient: 'from-emerald-500 to-teal-600',    step: 3 },
  followup:  { icon: Calendar,    color: 'violet',  gradient: 'from-violet-500 to-purple-600',   step: 4 },
  crmupdate: { icon: Database,    color: 'cyan',    gradient: 'from-cyan-500 to-sky-600',        step: 5 },
  proposal:  { icon: FileText,    color: 'rose',    gradient: 'from-rose-500 to-pink-600',       step: 6 },
  support:   { icon: Headphones,  color: 'lime',    gradient: 'from-lime-500 to-green-600',      step: 7 },
  reengage:  { icon: RefreshCw,   color: 'orange',  gradient: 'from-orange-500 to-red-500',      step: 8 },
  recommend: { icon: TrendingUp,  color: 'fuchsia', gradient: 'from-fuchsia-500 to-purple-600',  step: 9 },
  analyze:   { icon: BarChart2,   color: 'blue',    gradient: 'from-blue-500 to-indigo-600',     step: 10 },
};

const CHANNEL_ICONS = { email: Mail, whatsapp: Phone, linkedin: Linkedin };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Badge({ children, variant = 'gray' }) {
  const styles = {
    gray:    'bg-gray-100 text-gray-700',
    green:   'bg-emerald-100 text-emerald-700',
    amber:   'bg-amber-100 text-amber-700',
    red:     'bg-red-100 text-red-700',
    indigo:  'bg-indigo-100 text-indigo-700',
    purple:  'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[variant] || styles.gray}`}>
      {children}
    </span>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(typeof text === 'object' ? JSON.stringify(text, null, 2) : String(text));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="Copy">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function ResultSection({ title, children, collapsible = false }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-3 border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => collapsible && setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-700 uppercase tracking-wider ${collapsible ? 'cursor-pointer hover:bg-gray-100' : 'cursor-default'}`}
      >
        {title}
        {collapsible && (open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
      </button>
      {open && <div className="p-3 text-sm text-gray-700 space-y-1.5">{children}</div>}
    </div>
  );
}

// ─── Lead Picker ──────────────────────────────────────────────────────────────

function LeadPicker({ value, onChange, placeholder = 'Select a lead…' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const leads = storage.getLeads();
  const filtered = leads
    .filter(l => !query || (l.name || l.company_name || '').toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  const selected = leads.find(l => l.id === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm hover:border-gray-300 transition-colors"
      >
        <span className={selected ? 'text-gray-900 font-medium' : 'text-gray-400'}>
          {selected ? (selected.name || selected.company_name) : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search leads…"
              className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-300"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-3">No leads found</p>
            )}
            {filtered.map(l => (
              <button
                key={l.id}
                onClick={() => { onChange(l.id); setOpen(false); setQuery(''); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${l.id === value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}
              >
                <div className="font-medium truncate">{l.name || l.company_name || 'Unnamed Lead'}</div>
                <div className="text-xs text-gray-400 truncate">{l.email || l.city || l.status || ''}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, meta, isAdmin, onToggle, children }) {
  const Icon = meta?.icon || Zap;
  const isEnabled = agent.enabled;

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all duration-200 ${isEnabled ? 'border-gray-200 shadow-sm hover:shadow-md' : 'border-gray-100 opacity-60'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3.5 bg-gradient-to-r ${meta?.gradient || 'from-gray-500 to-gray-600'}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">{agent.name}</p>
            <p className="text-xs text-white/70">Step {meta?.step || '?'} in workflow</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isEnabled ? 'green' : 'gray'}>{isEnabled ? 'Active' : 'Disabled'}</Badge>
          {isAdmin && (
            <button
              onClick={() => onToggle(agent.id, !isEnabled)}
              className="text-xs text-white/80 hover:text-white underline underline-offset-2"
            >
              {isEnabled ? 'Disable' : 'Enable'}
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
        <p className="text-xs text-gray-500">{agent.description}</p>
      </div>

      {/* Body: agent-specific controls + results */}
      <div className="px-4 py-4 space-y-3">
        {isEnabled ? children : (
          <p className="text-sm text-gray-400 text-center py-2">This agent is disabled by an admin.</p>
        )}
      </div>
    </div>
  );
}

// ─── Result Renderer ──────────────────────────────────────────────────────────

function ScoreBar({ value, max = 100 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-7 text-right">{value}</span>
    </div>
  );
}

function StringList({ items }) {
  if (!Array.isArray(items) || items.length === 0) return <span className="text-gray-400 text-xs">None</span>;
  return (
    <ul className="space-y-0.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
          <ArrowRight className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" />
          {item}
        </li>
      ))}
    </ul>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIAgentsView() {
  const userRole = sessionManager.getRole();
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'admin' || userRole === 'manager';

  const [agents, setAgents] = useState([]);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  // Per-agent state: { [agentId]: { running, result, error, params } }
  const [agentState, setAgentState] = useState({});

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await aiAgentService.getAgents();
      setAgents(data.agents || []);
      setGeminiConfigured(data.gemini_configured || false);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const setAgentParams = (agentId, key, value) => {
    setAgentState(prev => ({
      ...prev,
      [agentId]: { ...prev[agentId], params: { ...(prev[agentId]?.params || {}), [key]: value } }
    }));
  };

  const setAgentRunning = (agentId, running) => {
    setAgentState(prev => ({ ...prev, [agentId]: { ...prev[agentId], running, error: null } }));
  };

  const setAgentResult = (agentId, result) => {
    setAgentState(prev => ({ ...prev, [agentId]: { ...prev[agentId], running: false, result } }));
  };

  const setAgentError = (agentId, error) => {
    setAgentState(prev => ({ ...prev, [agentId]: { ...prev[agentId], running: false, error } }));
  };

  const getParam = (agentId, key, def = '') => agentState[agentId]?.params?.[key] ?? def;

  const handleToggle = async (agentId, enabled) => {
    try {
      await aiAgentService.toggleAgent(agentId, enabled);
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, enabled } : a));
    } catch (err) {
      alert(`Failed to toggle agent: ${err.message}`);
    }
  };

  // ─── Agent runner functions ──────────────────────────────────────────────

  const run = async (agentId, fn) => {
    setAgentRunning(agentId, true);
    try {
      const data = await fn();
      setAgentResult(agentId, data?.result || data);
    } catch (err) {
      setAgentError(agentId, err.message);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mr-3" />
        <span className="text-gray-500 text-sm">Loading AI agents…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">AI Agents</h1>
            <Badge variant={geminiConfigured ? 'green' : 'amber'}>
              {geminiConfigured ? '✓ Gemini Connected' : '⚠ API Key Required'}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 ml-12">
            10 modular AI agents integrated into your CRM workflow.{' '}
            <span className="font-medium text-gray-700">New Lead → Research → Scoring → Outreach → Proposal → Sale → Upsell</span>
          </p>
        </div>
        {!geminiConfigured && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 max-w-xs shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Set <code className="font-mono bg-amber-100 px-1 rounded">GEMINI_API_KEY</code> in <code className="font-mono bg-amber-100 px-1 rounded">apps/api/.env</code>
          </div>
        )}
      </div>

      {/* Workflow Pipeline */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-4 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {['New Lead', 'Research', 'Scoring', 'CRM', 'Outreach', 'Follow-up', 'Meeting', 'Proposal', 'Sale', 'Retention', 'Upsell'].map((step, i, arr) => (
            <React.Fragment key={step}>
              <div className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${i === 0 ? 'bg-indigo-400' : i === arr.length - 1 ? 'bg-fuchsia-400' : 'bg-emerald-400'}`} />
                <span className="text-xs font-medium text-white/80 whitespace-nowrap">{step}</span>
              </div>
              {i < arr.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-white/30 shrink-0" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ─── Agent 1: Lead Research ────────────────────────────────────────── */}
        {agents.map(agent => {
          if (agent.id !== 'research') return null;
          const meta = AGENT_META.research;
          const st = agentState.research || {};
          const result = st.result;
          return (
            <AgentCard key="research" agent={agent} meta={meta} isAdmin={isAdmin} onToggle={handleToggle}>
              <LeadPicker value={getParam('research', 'leadId')} onChange={v => setAgentParams('research', 'leadId', v)} />
              <textarea
                placeholder="Additional context (optional)…"
                rows={2}
                value={getParam('research', 'context')}
                onChange={e => setAgentParams('research', 'context', e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
              <button
                disabled={st.running || !getParam('research', 'leadId')}
                onClick={() => run('research', () => aiAgentService.researchLead(getParam('research', 'leadId'), null, getParam('research', 'context')))}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {st.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Run Research
              </button>
              {st.error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">⚠ {st.error}</p>}
              {result && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Research Results</span>
                    <CopyButton text={result} />
                  </div>
                  <ResultSection title="Company Overview">{result.company_overview}</ResultSection>
                  <ResultSection title="Pain Points" collapsible>
                    <StringList items={result.pain_points} />
                  </ResultSection>
                  <ResultSection title="Buying Signals" collapsible>
                    <StringList items={result.buying_signals} />
                  </ResultSection>
                  <ResultSection title="Recommended Approach">
                    <p className="text-sm text-gray-700">{result.recommended_approach}</p>
                  </ResultSection>
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant={result.research_confidence === 'high' ? 'green' : 'amber'}>
                      Confidence: {result.research_confidence}
                    </Badge>
                    <Badge variant="indigo">Priority: {result.priority_score}/10</Badge>
                  </div>
                </div>
              )}
            </AgentCard>
          );
        })}

        {/* ─── Agent 2: Lead Scoring ─────────────────────────────────────────── */}
        {agents.map(agent => {
          if (agent.id !== 'scoring') return null;
          const meta = AGENT_META.scoring;
          const st = agentState.scoring || {};
          const result = st.result;
          return (
            <AgentCard key="scoring" agent={agent} meta={meta} isAdmin={isAdmin} onToggle={handleToggle}>
              <LeadPicker value={getParam('scoring', 'leadId')} onChange={v => setAgentParams('scoring', 'leadId', v)} />
              <button
                disabled={st.running || !getParam('scoring', 'leadId')}
                onClick={() => run('scoring', () => aiAgentService.scoreLead(getParam('scoring', 'leadId')))}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {st.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                Score Lead
              </button>
              {st.error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">⚠ {st.error}</p>}
              {result && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex flex-col items-center justify-center text-white shadow-sm">
                      <span className="text-xl font-black leading-none">{result.score}</span>
                      <span className="text-xs opacity-80">score</span>
                    </div>
                    <div className="flex-1">
                      <ScoreBar value={result.score} />
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant={result.tier === 'A' ? 'green' : result.tier === 'B' ? 'indigo' : result.tier === 'C' ? 'amber' : 'red'}>
                          Tier {result.tier}
                        </Badge>
                        <Badge variant="gray">{result.urgency}</Badge>
                      </div>
                    </div>
                  </div>
                  {result.qualification && (
                    <ResultSection title="BANT Qualification">
                      {Object.entries(result.qualification).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-32 capitalize">{k.replace(/_/g, ' ')}</span>
                          <div className="flex-1"><ScoreBar value={v} max={10} /></div>
                        </div>
                      ))}
                    </ResultSection>
                  )}
                  <ResultSection title="Recommended Action">
                    <p className="text-sm text-gray-700">{result.recommended_action}</p>
                  </ResultSection>
                  {result.disqualifying_factors?.length > 0 && (
                    <ResultSection title="Risks / Concerns" collapsible>
                      <StringList items={result.disqualifying_factors} />
                    </ResultSection>
                  )}
                </div>
              )}
            </AgentCard>
          );
        })}

        {/* ─── Agent 3: Sales Outreach ───────────────────────────────────────── */}
        {agents.map(agent => {
          if (agent.id !== 'outreach') return null;
          const meta = AGENT_META.outreach;
          const st = agentState.outreach || {};
          const result = st.result;
          return (
            <AgentCard key="outreach" agent={agent} meta={meta} isAdmin={isAdmin} onToggle={handleToggle}>
              <LeadPicker value={getParam('outreach', 'leadId')} onChange={v => setAgentParams('outreach', 'leadId', v)} />
              <div className="flex gap-2">
                {['email', 'whatsapp', 'linkedin'].map(ch => {
                  const ChIcon = CHANNEL_ICONS[ch];
                  const selected = getParam('outreach', 'channel', 'email') === ch;
                  return (
                    <button
                      key={ch}
                      onClick={() => setAgentParams('outreach', 'channel', ch)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-colors ${selected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-200 text-gray-600 hover:border-emerald-300'}`}
                    >
                      <ChIcon className="w-3.5 h-3.5" />
                      {ch.charAt(0).toUpperCase() + ch.slice(1)}
                    </button>
                  );
                })}
              </div>
              <input
                placeholder="Product / service context (optional)…"
                value={getParam('outreach', 'productContext')}
                onChange={e => setAgentParams('outreach', 'productContext', e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-300"
              />
              <button
                disabled={st.running || !getParam('outreach', 'leadId')}
                onClick={() => run('outreach', () => aiAgentService.generateOutreach(
                  getParam('outreach', 'leadId'),
                  getParam('outreach', 'channel', 'email'),
                  getParam('outreach', 'productContext')
                ))}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {st.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Generate Outreach
              </button>
              {st.error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">⚠ {st.error}</p>}
              {result && (
                <div className="space-y-2">
                  {result.subject && (
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-xs">
                      <span className="text-gray-500 font-medium shrink-0">Subject:</span>
                      <span className="text-gray-900 font-semibold">{result.subject}</span>
                      <CopyButton text={result.subject} />
                    </div>
                  )}
                  <ResultSection title="Message">
                    <div className="relative">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{result.message}</pre>
                      <div className="absolute top-0 right-0"><CopyButton text={result.message} /></div>
                    </div>
                  </ResultSection>
                  {result.follow_up_message && (
                    <ResultSection title="Follow-up Variation" collapsible>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">{result.follow_up_message}</pre>
                    </ResultSection>
                  )}
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="gray">{result.tone}</Badge>
                    {result.estimated_open_rate && <Badge variant="green">Est. open rate: {result.estimated_open_rate}</Badge>}
                  </div>
                </div>
              )}
            </AgentCard>
          );
        })}

        {/* ─── Agent 4: Follow-up Scheduler ─────────────────────────────────── */}
        {agents.map(agent => {
          if (agent.id !== 'followup') return null;
          const meta = AGENT_META.followup;
          const st = agentState.followup || {};
          const result = st.result;
          return (
            <AgentCard key="followup" agent={agent} meta={meta} isAdmin={isAdmin} onToggle={handleToggle}>
              <LeadPicker value={getParam('followup', 'leadId')} onChange={v => setAgentParams('followup', 'leadId', v)} />
              <div className="flex items-center gap-3 text-xs text-gray-600">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={getParam('followup', 'responseReceived', false)}
                    onChange={e => setAgentParams('followup', 'responseReceived', e.target.checked)}
                    className="rounded"
                  />
                  Response received
                </label>
              </div>
              <button
                disabled={st.running || !getParam('followup', 'leadId')}
                onClick={() => run('followup', () => aiAgentService.scheduleFollowup(
                  getParam('followup', 'leadId'), 1, getParam('followup', 'responseReceived', false)
                ))}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {st.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                Plan Follow-up
              </button>
              {st.error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">⚠ {st.error}</p>}
              {result && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={result.should_followup ? 'green' : 'red'}>
                      {result.should_followup ? '✓ Should Follow Up' : '✗ Do Not Follow Up'}
                    </Badge>
                    {result.escalation_flag && <Badge variant="red">⚠ Escalate to Manager</Badge>}
                    {result.next_followup_date && <Badge variant="indigo">Next: {result.next_followup_date?.slice(0, 10)}</Badge>}
                  </div>
                  <p className="text-xs text-gray-600 italic">{result.reason}</p>
                  {result.sequence?.length > 0 && (
                    <ResultSection title={`Follow-up Sequence (${result.sequence.length} steps)`} collapsible>
                      {result.sequence.map(step => (
                        <div key={step.step} className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
                          <div className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">
                            {step.step}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-gray-700">Day {step.delay_days} — {step.channel}</span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">{step.objective}</p>
                            <p className="text-xs text-gray-700 mt-0.5 line-clamp-2">{step.message_template}</p>
                          </div>
                        </div>
                      ))}
                    </ResultSection>
                  )}
                  <p className="text-xs text-gray-400">Stop when: {result.stop_condition}</p>
                </div>
              )}
            </AgentCard>
          );
        })}

        {/* ─── Agent 5: AI CRM Update ────────────────────────────────────────── */}
        {agents.map(agent => {
          if (agent.id !== 'crmupdate') return null;
          const meta = AGENT_META.crmupdate;
          const st = agentState.crmupdate || {};
          const result = st.result;
          return (
            <AgentCard key="crmupdate" agent={agent} meta={meta} isAdmin={isAdmin} onToggle={handleToggle}>
              <LeadPicker value={getParam('crmupdate', 'leadId')} onChange={v => setAgentParams('crmupdate', 'leadId', v)} />
              <textarea
                placeholder="Describe the latest interaction (call summary, email reply, etc.)…"
                rows={2}
                value={getParam('crmupdate', 'latestInteraction')}
                onChange={e => setAgentParams('crmupdate', 'latestInteraction', e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-cyan-300"
              />
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={getParam('crmupdate', 'autoApply', false)}
                  onChange={e => setAgentParams('crmupdate', 'autoApply', e.target.checked)}
                  className="rounded"
                />
                Auto-apply changes to CRM (writes stage + note)
              </label>
              <button
                disabled={st.running || !getParam('crmupdate', 'leadId')}
                onClick={() => run('crmupdate', () => aiAgentService.updateCRM(
                  getParam('crmupdate', 'leadId'),
                  getParam('crmupdate', 'latestInteraction'),
                  getParam('crmupdate', 'autoApply', false)
                ))}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-sky-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {st.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                Update CRM
              </button>
              {st.error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">⚠ {st.error}</p>}
              {result && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="indigo">Stage: {result.recommended_stage}</Badge>
                    <Badge variant={result.priority === 'urgent' ? 'red' : result.priority === 'high' ? 'amber' : 'gray'}>
                      Priority: {result.priority}
                    </Badge>
                    <Badge variant="gray">Confidence: {result.automation_confidence}%</Badge>
                  </div>
                  <ResultSection title="CRM Note to Log">
                    <p className="text-xs text-gray-700">{result.crm_note}</p>
                  </ResultSection>
                  <ResultSection title="Next Action">
                    <p className="text-sm font-medium text-cyan-700">{result.next_action}</p>
                    {result.next_followup_date && <p className="text-xs text-gray-500 mt-1">Due: {result.next_followup_date?.slice(0, 10)}</p>}
                  </ResultSection>
                  {result.tags_to_add?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {result.tags_to_add.map(t => <Badge key={t} variant="cyan">{t}</Badge>)}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 italic">{result.stage_change_reason}</p>
                </div>
              )}
            </AgentCard>
          );
        })}

        {/* ─── Agent 6: Proposal Generator ──────────────────────────────────── */}
        {agents.map(agent => {
          if (agent.id !== 'proposal') return null;
          const meta = AGENT_META.proposal;
          const st = agentState.proposal || {};
          const result = st.result;
          return (
            <AgentCard key="proposal" agent={agent} meta={meta} isAdmin={isAdmin} onToggle={handleToggle}>
              <LeadPicker value={getParam('proposal', 'leadId')} onChange={v => setAgentParams('proposal', 'leadId', v)} />
              <input
                placeholder="Services to propose (comma-separated)…"
                value={getParam('proposal', 'services')}
                onChange={e => setAgentParams('proposal', 'services', e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-300"
              />
              <textarea
                placeholder="Custom requirements or special notes…"
                rows={2}
                value={getParam('proposal', 'customRequirements')}
                onChange={e => setAgentParams('proposal', 'customRequirements', e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-rose-300"
              />
              <button
                disabled={st.running || !getParam('proposal', 'leadId')}
                onClick={() => {
                  const services = getParam('proposal', 'services').split(',').map(s => s.trim()).filter(Boolean);
                  run('proposal', () => aiAgentService.generateProposal(
                    getParam('proposal', 'leadId'), services, getParam('proposal', 'customRequirements')
                  ));
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {st.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Generate Proposal
              </button>
              {st.error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">⚠ {st.error}</p>}
              {result && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900">{result.proposal_title}</p>
                    <CopyButton text={result} />
                  </div>
                  <ResultSection title="Executive Summary">
                    <p className="text-xs text-gray-700">{result.executive_summary}</p>
                  </ResultSection>
                  <ResultSection title="Deliverables" collapsible>
                    <StringList items={result.deliverables} />
                  </ResultSection>
                  {result.investment && (
                    <ResultSection title="Investment">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-rose-600">${result.investment.base_price?.toLocaleString()}</span>
                        <span className="text-xs text-gray-400">{result.investment.payment_terms}</span>
                      </div>
                    </ResultSection>
                  )}
                  {result.timeline && (
                    <ResultSection title="Timeline" collapsible>
                      <p className="text-xs text-gray-600 mb-1">Total: {result.timeline.total_weeks} weeks</p>
                      {result.timeline.phases?.map((p, i) => (
                        <div key={i} className="text-xs text-gray-700 mb-0.5">
                          <span className="font-semibold">{p.phase}</span> — {p.duration}
                        </div>
                      ))}
                    </ResultSection>
                  )}
                  <ResultSection title="Next Steps" collapsible>
                    <StringList items={result.next_steps} />
                  </ResultSection>
                </div>
              )}
            </AgentCard>
          );
        })}

        {/* ─── Agent 7: Support Agent ────────────────────────────────────────── */}
        {agents.map(agent => {
          if (agent.id !== 'support') return null;
          const meta = AGENT_META.support;
          const st = agentState.support || {};
          const result = st.result;
          return (
            <AgentCard key="support" agent={agent} meta={meta} isAdmin={isAdmin} onToggle={handleToggle}>
              <LeadPicker value={getParam('support', 'leadId')} onChange={v => setAgentParams('support', 'leadId', v)} placeholder="Select customer (optional)…" />
              <textarea
                placeholder="Type the customer query or support ticket…"
                rows={3}
                value={getParam('support', 'query')}
                onChange={e => setAgentParams('support', 'query', e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-lime-300"
              />
              <button
                disabled={st.running || !getParam('support', 'query')}
                onClick={() => run('support', () => aiAgentService.handleSupport(
                  getParam('support', 'query'), getParam('support', 'leadId') || null
                ))}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-lime-500 to-green-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {st.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Headphones className="w-4 h-4" />}
                Get Answer
              </button>
              {st.error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">⚠ {st.error}</p>}
              {result && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={result.requires_human ? 'red' : 'green'}>
                      {result.requires_human ? '⚠ Needs Human' : '✓ AI Handled'}
                    </Badge>
                    <Badge variant="gray">{result.query_category}</Badge>
                    <Badge variant={result.sentiment_detected === 'urgent' ? 'red' : result.sentiment_detected === 'frustrated' ? 'amber' : 'green'}>
                      {result.sentiment_detected}
                    </Badge>
                    <Badge variant="indigo">Confidence: {result.confidence}%</Badge>
                  </div>
                  <ResultSection title="Response (ready to send)">
                    <div className="relative">
                      <p className="text-sm text-gray-800 leading-relaxed pr-8">{result.answer}</p>
                      <div className="absolute top-0 right-0"><CopyButton text={result.answer} /></div>
                    </div>
                  </ResultSection>
                  {result.requires_human && result.escalation_reason && (
                    <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      Escalation: {result.escalation_reason}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">Next: {result.follow_up_action}</p>
                </div>
              )}
            </AgentCard>
          );
        })}

        {/* ─── Agent 8: Re-engagement (manager+) ────────────────────────────── */}
        {agents.map(agent => {
          if (agent.id !== 'reengage') return null;
          if (!isManager) return (
            <AgentCard key="reengage" agent={agent} meta={AGENT_META.reengage} isAdmin={isAdmin} onToggle={handleToggle}>
              <p className="text-xs text-gray-400 text-center py-2">Requires Manager or Admin role.</p>
            </AgentCard>
          );
          const meta = AGENT_META.reengage;
          const st = agentState.reengage || {};
          const result = st.result;
          return (
            <AgentCard key="reengage" agent={agent} meta={meta} isAdmin={isAdmin} onToggle={handleToggle}>
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-600 shrink-0">Inactive threshold:</label>
                <input
                  type="number"
                  min={1}
                  value={getParam('reengage', 'days', 30)}
                  onChange={e => setAgentParams('reengage', 'days', Number(e.target.value))}
                  className="w-20 text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-300"
                />
                <span className="text-xs text-gray-400">days</span>
              </div>
              <button
                disabled={st.running}
                onClick={() => run('reengage', () => aiAgentService.reengageCustomers(getParam('reengage', 'days', 30)))}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {st.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Scan & Re-engage
              </button>
              {st.error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">⚠ {st.error}</p>}
              {result && (
                <div className="space-y-2">
                  <Badge variant="amber">{result.inactive_count} inactive customers found</Badge>
                  {result.high_risk_leads?.length > 0 && (
                    <ResultSection title="High-Risk Accounts" collapsible>
                      {result.high_risk_leads.map((l, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                          <span className="font-medium text-gray-800">{l.name}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400">{l.days_inactive}d</span>
                            <Badge variant={l.risk_level === 'critical' ? 'red' : 'amber'}>{l.risk_level}</Badge>
                          </div>
                        </div>
                      ))}
                    </ResultSection>
                  )}
                  {result.re_engagement_campaign && (
                    <ResultSection title={`Campaign: ${result.re_engagement_campaign.campaign_name}`} collapsible>
                      <p className="text-xs text-gray-600 mb-2">{result.re_engagement_campaign.strategy}</p>
                      {result.re_engagement_campaign.messages?.map((m, i) => (
                        <div key={i} className="mb-2 p-2 bg-orange-50 rounded-lg">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Badge variant="amber">{m.segment}</Badge>
                            <Badge variant="gray">{m.channel}</Badge>
                          </div>
                          <p className="text-xs text-gray-700">{m.message}</p>
                        </div>
                      ))}
                    </ResultSection>
                  )}
                </div>
              )}
            </AgentCard>
          );
        })}

        {/* ─── Agent 9: Upsell/Cross-sell ───────────────────────────────────── */}
        {agents.map(agent => {
          if (agent.id !== 'recommend') return null;
          const meta = AGENT_META.recommend;
          const st = agentState.recommend || {};
          const result = st.result;
          return (
            <AgentCard key="recommend" agent={agent} meta={meta} isAdmin={isAdmin} onToggle={handleToggle}>
              <LeadPicker value={getParam('recommend', 'leadId')} onChange={v => setAgentParams('recommend', 'leadId', v)} />
              <input
                placeholder="Current services (comma-separated)…"
                value={getParam('recommend', 'currentServices')}
                onChange={e => setAgentParams('recommend', 'currentServices', e.target.value)}
                className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-fuchsia-300"
              />
              <button
                disabled={st.running || !getParam('recommend', 'leadId')}
                onClick={() => {
                  const svc = getParam('recommend', 'currentServices').split(',').map(s => s.trim()).filter(Boolean);
                  run('recommend', () => aiAgentService.recommendUpsell(getParam('recommend', 'leadId'), svc));
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {st.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                Find Opportunities
              </button>
              {st.error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">⚠ {st.error}</p>}
              {result && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="green">Total Opportunity: ${result.total_opportunity_value?.toLocaleString()}</Badge>
                    <Badge variant={result.risk_of_churn === 'high' ? 'red' : result.risk_of_churn === 'medium' ? 'amber' : 'green'}>
                      Churn Risk: {result.risk_of_churn}
                    </Badge>
                  </div>
                  {result.upsell_opportunities?.length > 0 && (
                    <ResultSection title="Upsell Opportunities" collapsible>
                      {result.upsell_opportunities.map((o, i) => (
                        <div key={i} className="py-1.5 border-b border-gray-50 last:border-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-800">{o.service}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-fuchsia-600">${o.estimated_value?.toLocaleString()}</span>
                              <Badge variant="purple">{o.probability}%</Badge>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{o.rationale}</p>
                        </div>
                      ))}
                    </ResultSection>
                  )}
                  <ResultSection title="Conversation Starter">
                    <p className="text-sm text-gray-700 italic">&ldquo;{result.conversation_starter}&rdquo;</p>
                  </ResultSection>
                </div>
              )}
            </AgentCard>
          );
        })}

        {/* ─── Agent 10: Business Analyst (manager+) ────────────────────────── */}
        {agents.map(agent => {
          if (agent.id !== 'analyze') return null;
          if (!isManager) return (
            <AgentCard key="analyze" agent={agent} meta={AGENT_META.analyze} isAdmin={isAdmin} onToggle={handleToggle}>
              <p className="text-xs text-gray-400 text-center py-2">Requires Manager or Admin role.</p>
            </AgentCard>
          );
          const meta = AGENT_META.analyze;
          const st = agentState.analyze || {};
          const result = st.result;
          return (
            <AgentCard key="analyze" agent={agent} meta={meta} isAdmin={isAdmin} onToggle={handleToggle}>
              <div className="flex gap-2">
                {[['today', 'Today'], ['7d', '7 Days'], ['30d', '30 Days'], ['all', 'All Time']].map(([val, label]) => {
                  const selected = getParam('analyze', 'range', '7d') === val;
                  return (
                    <button
                      key={val}
                      onClick={() => setAgentParams('analyze', 'range', val)}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors ${selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={st.running}
                onClick={() => run('analyze', () => aiAgentService.analyzePerformance(getParam('analyze', 'range', '7d')))}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {st.running ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart2 className="w-4 h-4" />}
                Analyze Performance
              </button>
              {st.error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">⚠ {st.error}</p>}
              {result && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={
                      result.pipeline_health === 'excellent' ? 'green' :
                      result.pipeline_health === 'good' ? 'indigo' :
                      result.pipeline_health === 'fair' ? 'amber' : 'red'
                    }>Pipeline: {result.pipeline_health}</Badge>
                    <CopyButton text={result} />
                  </div>
                  <ResultSection title="Executive Summary">
                    <p className="text-sm text-gray-700 leading-relaxed">{result.executive_summary}</p>
                  </ResultSection>
                  {result.key_metrics?.length > 0 && (
                    <ResultSection title="Key Metrics" collapsible>
                      {result.key_metrics.map((m, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                          <span className="text-gray-600">{m.metric}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{m.value}</span>
                            <span className={m.trend === 'up' ? 'text-emerald-500' : m.trend === 'down' ? 'text-red-500' : 'text-gray-400'}>
                              {m.trend === 'up' ? '↑' : m.trend === 'down' ? '↓' : '→'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </ResultSection>
                  )}
                  {result.revenue_forecast && (
                    <ResultSection title="Revenue Forecast">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-xs text-gray-400">Conservative</p>
                          <p className="text-sm font-bold text-gray-700">${result.revenue_forecast.conservative?.toLocaleString()}</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2">
                          <p className="text-xs text-blue-500">Realistic</p>
                          <p className="text-sm font-bold text-blue-700">${result.revenue_forecast.realistic?.toLocaleString()}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-lg p-2">
                          <p className="text-xs text-emerald-500">Optimistic</p>
                          <p className="text-sm font-bold text-emerald-700">${result.revenue_forecast.optimistic?.toLocaleString()}</p>
                        </div>
                      </div>
                    </ResultSection>
                  )}
                  <ResultSection title="Weekly Priorities" collapsible>
                    <StringList items={result.weekly_priorities} />
                  </ResultSection>
                  {result.recommendations?.length > 0 && (
                    <ResultSection title="Recommendations" collapsible>
                      {result.recommendations.map((r, i) => (
                        <div key={i} className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-gray-800">{r.title}</span>
                              <Badge variant={r.impact === 'high' ? 'green' : r.impact === 'medium' ? 'indigo' : 'gray'}>
                                {r.impact} impact
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-500">{r.action}</p>
                          </div>
                        </div>
                      ))}
                    </ResultSection>
                  )}
                </div>
              )}
            </AgentCard>
          );
        })}

      </div>
    </div>
  );
}
