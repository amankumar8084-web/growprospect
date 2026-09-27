import React, { useState } from 'react';
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
  ArrowUpRight
} from 'lucide-react';

export default function LeadDetailDrawer({ lead, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!lead) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(lead, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/30 backdrop-blur-xs flex justify-end">
      <div 
        className="w-full max-w-md bg-white border-l border-[#E7E7E7] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-[#E7E7E7] bg-[#F5F5F5] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-white border border-[#E7E7E7] text-[#111111]">
                {lead.opportunityType}
              </span>
              <span className="text-xs font-mono text-[#8A8A8A]">
                {lead.id}
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#111111] tracking-tight">
              {lead.name}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-[#8A8A8A] mt-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>{lead.location}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white text-[#8A8A8A] hover:text-[#111111] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          
          {/* Contact Details Card */}
          <div className="p-4 rounded-lg bg-[#F5F5F5] border border-[#E7E7E7] space-y-3">
            <h3 className="text-xs font-mono font-semibold text-[#111111] uppercase tracking-wider">
              Contact & Digital Presence
            </h3>

            {/* Email */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#8A8A8A]">
                <Mail className="w-3.5 h-3.5 text-[#111111]" />
                <span>Email Address:</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[#111111] font-medium">
                <span>{lead.email || 'None available'}</span>
                {lead.emailVerificationStatus === 'verified' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" title="Verified active mailbox" />
                )}
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#8A8A8A]">
                <Phone className="w-3.5 h-3.5 text-[#111111]" />
                <span>Phone:</span>
              </div>
              <span className="font-mono text-[#111111] font-medium">{lead.phone || 'None listed'}</span>
            </div>

            {/* Website */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#8A8A8A]">
                <Globe className="w-3.5 h-3.5 text-[#111111]" />
                <span>Website:</span>
              </div>
              {lead.website ? (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[#EA4B0B] hover:underline flex items-center gap-1"
                >
                  <span className="truncate max-w-[160px]">{lead.website.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-[#8A8A8A] font-mono italic">No Website Found</span>
              )}
            </div>
          </div>

          {/* Scraper Source Attribution & Provenance */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-mono font-semibold text-[#111111] uppercase tracking-wider">
              Source Attribution & Traceability
            </h3>
            <div className="p-3 rounded border border-[#E7E7E7] bg-white space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[#8A8A8A]">Scraper Engine:</span>
                <span className="text-[#111111] font-semibold">{lead.source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8A8A8A]">Associated Run:</span>
                <span className="text-[#111111]">{lead.scraperRunId || 'RUN-INITIAL'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8A8A8A]">Discovered At:</span>
                <span className="text-[#111111]">
                  {lead.scrapedAt ? new Date(lead.scrapedAt).toLocaleString() : 'Recent'}
                </span>
              </div>
              {lead.sourceUrl && (
                <div className="pt-2 border-t border-[#E7E7E7]">
                  <span className="text-[#8A8A8A] block mb-1">Source URL / Query Endpoint:</span>
                  <span className="text-[10px] break-all text-[#8A8A8A] bg-[#F5F5F5] p-1.5 rounded block">
                    {lead.sourceUrl}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Signal Diagnostics */}
          {lead.signals && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-mono font-semibold text-[#111111] uppercase tracking-wider">
                Opportunity Signals & Audit Data
              </h3>
              <div className="p-3.5 rounded border border-[#E7E7E7] bg-[#F5F5F5] space-y-2 text-xs font-mono">
                {Object.entries(lead.signals).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-baseline gap-2">
                    <span className="text-[#8A8A8A] capitalize">
                      {key.replace(/([A-Z])/g, ' $1')}:
                    </span>
                    <span className="text-[#111111] font-semibold text-right">
                      {typeof value === 'boolean' ? (value ? 'YES' : 'NO') : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Raw JSON Payload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-semibold text-[#111111] uppercase tracking-wider">
                Raw JSON Schema
              </h3>
              <button
                onClick={handleCopyJson}
                className="text-xs font-mono text-[#EA4B0B] hover:underline flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>
            <pre className="p-3 rounded bg-[#111111] text-zinc-300 font-mono text-[10px] overflow-x-auto max-h-40 leading-snug">
              {JSON.stringify(lead, null, 2)}
            </pre>
          </div>

        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-[#E7E7E7] bg-[#F5F5F5] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-[#E7E7E7] border border-[#E7E7E7] text-xs font-medium text-[#111111] rounded transition-colors"
          >
            Close Drawer
          </button>

          <button
            onClick={handleCopyJson}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#111111] hover:bg-[#EA4B0B] text-white text-xs font-semibold rounded transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copy Full Lead</span>
          </button>
        </div>

      </div>
    </div>
  );
}
