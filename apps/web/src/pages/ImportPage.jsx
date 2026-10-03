import React, { useState, useEffect, useRef } from 'react';
import readXlsxFile from 'read-excel-file/browser';
import { storage } from '../services/storage';
import { crmService } from '../services/crmService';
import { sessionManager } from '../services/sessionManager';
import { PIPELINE_STAGES, STAGE_CONFIG } from '../constants/crm';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  PenSquare, 
  ArrowRight, 
  ArrowLeft,
  Check, 
  AlertCircle, 
  AlertTriangle,
  Download, 
  CheckCircle2, 
  XCircle, 
  Users, 
  Tag, 
  MapPin, 
  Globe, 
  Phone, 
  Mail, 
  FileText,
  Building2,
  Trash2,
  X,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

import { normalizeDomain, normalizePhone, normalizeEmail } from '../services/dedupService';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Auto-detect standard fields
const SYSTEM_FIELDS = [
  { value: '', label: '— Ignore this column' },
  { value: 'company_name', label: 'Company' },
  { value: 'name', label: 'Contact' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'website', label: 'Website' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'country', label: 'Country' },
  { value: 'notes', label: 'Notes' },
  { value: 'deal_value', label: 'Deal Value' },
  { value: 'job_title', label: 'Job Title' },
];

const AUTO_MAP_RULES = [
  { field: 'company_name', patterns: ['company', 'business', 'org', 'firm', 'agency', 'company_name', 'business_name', 'title'] },
  { field: 'name', patterns: ['contact', 'name', 'person', 'fullname', 'first_name', 'contact_name', 'owner'] },
  { field: 'email', patterns: ['email', 'mail', 'email_address', 'e-mail'] },
  { field: 'phone', patterns: ['phone', 'tel', 'mobile', 'telephone', 'cell', 'phone_number'] },
  { field: 'website', patterns: ['website', 'url', 'domain', 'web', 'site', 'link'] },
  { field: 'city', patterns: ['city', 'town', 'municipality'] },
  { field: 'state', patterns: ['state', 'province', 'region'] },
  { field: 'country', patterns: ['country', 'nation'] },
  { field: 'notes', patterns: ['note', 'notes', 'comment', 'comments', 'description', 'remarks'] },
  { field: 'deal_value', patterns: ['deal', 'value', 'amount', 'budget', 'price', 'revenue'] },
  { field: 'job_title', patterns: ['job', 'job_title', 'headline', 'position', 'role'] }
];

export default function ImportPage({ onViewLeads }) {
  const [mode, setMode] = useState('upload'); // 'upload' | 'manual'
  const [currentStep, setCurrentStep] = useState(1); // 1: Upload, 2: Map, 3: Review, 4: Finish

  // Step 1: Upload & Batch Config
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [defaultStatus, setDefaultStatus] = useState('new');
  const [ownerStrategy, setOwnerStrategy] = useState('unassigned'); // 'unassigned', 'round-robin', 'location-rule', or member user_id
  const [batchTag, setBatchTag] = useState('');
  const [sourceLabel, setSourceLabel] = useState(`Batch_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);
  const [teamMembers, setTeamMembers] = useState([]);

  // Parsed File Data
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({});

  // Step 3: Review & Deduplication
  const [duplicateHandling, setDuplicateHandling] = useState('skip'); // 'skip', 'update', 'import-anyway'
  const [processedRecords, setProcessedRecords] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Summary State after commit
  const [summary, setSummary] = useState(null);

  // Manual Lead Entry Form State
  const [manualForm, setManualForm] = useState({
    company_name: '',
    name: '',
    email: '',
    phone: '',
    website: '',
    city: '',
    state: '',
    country: 'US',
    status: 'new',
    owner_id: '',
    tags: '',
    notes: '',
    deal_value: ''
  });
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualMessage, setManualMessage] = useState(null);

  const fileInputRef = useRef(null);

  // Load team members on mount
  useEffect(() => {
    crmService.getTeamMembers().then(setTeamMembers).catch(() => {});
  }, []);

  // Handle file drop / select
  const handleFile = async (selectedFile) => {
    setFileError('');
    if (!selectedFile) return;

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setFileError('File exceeds the 10MB upload limit. Please upload a smaller file.');
      return;
    }

    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      setFileError('Unsupported file type. Please upload a CSV, XLSX, or XLS spreadsheet.');
      return;
    }

    setFile(selectedFile);
  };

  // Parse file and proceed to Step 2
  const handleProceedToMapping = async () => {
    if (!file) {
      setFileError('Please select a file to upload.');
      return;
    }

    setIsProcessing(true);
    setFileError('');

    try {
      let parsedHeaders = [];
      let parsedRows = [];

      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Parse with read-excel-file
        const rows = await readXlsxFile(file);
        if (!rows || rows.length < 2) {
          throw new Error('Spreadsheet must contain a header row and at least one data row.');
        }
        parsedHeaders = rows[0].map(h => String(h || '').trim());
        parsedRows = rows.slice(1).map(r => {
          const obj = {};
          parsedHeaders.forEach((h, idx) => {
            obj[h] = r[idx] !== null && r[idx] !== undefined ? String(r[idx]).trim() : '';
          });
          return obj;
        });
      } else {
        // Parse CSV
        const text = await file.text();
        const lines = [];
        let row = [];
        let inQuotes = false;
        let currentField = '';

        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const nextChar = text[i + 1];

          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              currentField += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            row.push(currentField.trim());
            currentField = '';
          } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            row.push(currentField.trim());
            if (row.length > 0 && row.some(f => f.length > 0)) lines.push(row);
            row = [];
            currentField = '';
          } else {
            currentField += char;
          }
        }
        if (currentField || row.length > 0) {
          row.push(currentField.trim());
          if (row.some(f => f.length > 0)) lines.push(row);
        }

        if (lines.length < 2) {
          throw new Error('CSV file must contain a header row and at least one record.');
        }

        parsedHeaders = lines[0].map(h => h.replace(/^["']|["']$/g, '').trim());
        parsedRows = lines.slice(1).map(r => {
          const obj = {};
          parsedHeaders.forEach((h, idx) => {
            obj[h] = (r[idx] || '').replace(/^["']|["']$/g, '').trim();
          });
          return obj;
        });
      }

      setHeaders(parsedHeaders);
      setRawRows(parsedRows);

      // Auto-detect columns
      const autoMap = {};
      parsedHeaders.forEach(header => {
        const clean = header.toLowerCase().replace(/[^a-z0-9]/g, '');
        let matched = '';
        for (const rule of AUTO_MAP_RULES) {
          if (rule.patterns.some(p => clean.includes(p.replace(/[^a-z0-9]/g, '')))) {
            matched = rule.field;
            break;
          }
        }
        autoMap[header] = matched;
      });
      setMapping(autoMap);

      setCurrentStep(2);
    } catch (err) {
      setFileError(err.message || 'Failed to parse file.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Process rows against existing database leads for Step 3
  const handleProceedToReview = () => {
    setIsProcessing(true);

    try {
      const existingLeads = storage.getLeads();
      const existingEmails = new Set();
      const existingPhones = new Set();
      const existingDomains = new Set();
      const existingLeadMap = new Map(); // key -> lead

      existingLeads.forEach(lead => {
        if (lead.email) {
          const e = normalizeEmail(lead.email);
          existingEmails.add(e);
          existingLeadMap.set(`email:${e}`, lead);
        }
        if (lead.phone) {
          const p = normalizePhone(lead.phone);
          if (p.length >= 7) {
            existingPhones.add(p);
            existingLeadMap.set(`phone:${p}`, lead);
          }
        }
        if (lead.website) {
          const d = normalizeDomain(lead.website);
          if (d) {
            existingDomains.add(d);
            existingLeadMap.set(`domain:${d}`, lead);
          }
        }
      });

      // Map rows
      const processed = rawRows.map((rawRow, idx) => {
        const lead = {
          rawRow,
          rowIndex: idx + 1,
          status: defaultStatus,
          source: sourceLabel || 'CSV Import',
          tags: batchTag ? [batchTag.trim()] : []
        };

        // Apply mapped fields
        Object.entries(mapping).forEach(([fileCol, systemField]) => {
          if (systemField && rawRow[fileCol] !== undefined) {
            lead[systemField] = rawRow[fileCol];
          }
        });

        // Validation check
        const hasCompany = Boolean(lead.company_name && lead.company_name.trim());
        const hasContact = Boolean(lead.name && lead.name.trim());
        const hasEmail = Boolean(lead.email && lead.email.trim());
        const hasPhone = Boolean(lead.phone && lead.phone.trim());

        if (!hasCompany && !hasContact && !hasEmail && !hasPhone) {
          return {
            ...lead,
            validationStatus: 'invalid',
            errorReason: 'Row has no company name, contact, email or phone.'
          };
        }

        // Deduplication check
        let isDuplicate = false;
        let matchedExistingLead = null;
        let dupReason = '';

        if (lead.email) {
          const e = normalizeEmail(lead.email);
          if (existingEmails.has(e)) {
            isDuplicate = true;
            matchedExistingLead = existingLeadMap.get(`email:${e}`);
            dupReason = `Matching email: ${e}`;
          }
        }

        if (!isDuplicate && lead.phone) {
          const p = normalizePhone(lead.phone);
          if (p.length >= 7 && existingPhones.has(p)) {
            isDuplicate = true;
            matchedExistingLead = existingLeadMap.get(`phone:${p}`);
            dupReason = `Matching phone: ${lead.phone}`;
          }
        }

        if (!isDuplicate && lead.website) {
          const d = normalizeDomain(lead.website);
          if (d && existingDomains.has(d)) {
            isDuplicate = true;
            matchedExistingLead = existingLeadMap.get(`domain:${d}`);
            dupReason = `Matching domain: ${d}`;
          }
        }

        if (isDuplicate) {
          return {
            ...lead,
            validationStatus: 'duplicate',
            dupReason,
            matchedExistingLead
          };
        }

        return {
          ...lead,
          validationStatus: 'valid'
        };
      });

      setProcessedRecords(processed);
      setCurrentStep(3);
    } catch (err) {
      alert('Error analyzing rows: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download Error / Invalid File
  const handleDownloadErrorFile = () => {
    const errorRows = processedRecords.filter(r => r.validationStatus === 'invalid' || r.validationStatus === 'duplicate');
    if (errorRows.length === 0) {
      alert('No error or duplicate rows found.');
      return;
    }

    const exportHeaders = ['Row Index', 'Error Status', 'Reason', ...headers];
    const csvLines = [exportHeaders.join(',')];

    errorRows.forEach(r => {
      const line = [
        r.rowIndex,
        r.validationStatus.toUpperCase(),
        `"${(r.errorReason || r.dupReason || '').replace(/"/g, '""')}"`,
        ...headers.map(h => `"${(r.rawRow[h] || '').replace(/"/g, '""')}"`)
      ];
      csvLines.push(line.join(','));
    });

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import_errors_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Commit Import
  const handleCommitImport = async () => {
    setIsProcessing(true);

    try {
      const existingLeads = storage.getLeads();
      const currentOrgId = sessionManager.getOrgId();
      const reps = teamMembers.filter(m => m.role === 'rep' || m.role === 'manager');

      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      const leadsToUpsert = [];

      processedRecords.forEach((record, index) => {
        // Handle based on duplicate choice
        if (record.validationStatus === 'invalid') {
          skippedCount++;
          return;
        }

        if (record.validationStatus === 'duplicate') {
          if (duplicateHandling === 'skip') {
            skippedCount++;
            return;
          }
          if (duplicateHandling === 'update' && record.matchedExistingLead) {
            // Update existing lead
            const updated = {
              ...record.matchedExistingLead,
              company_name: record.company_name || record.matchedExistingLead.company_name,
              name: record.name || record.matchedExistingLead.name,
              email: record.email || record.matchedExistingLead.email,
              phone: record.phone || record.matchedExistingLead.phone,
              website: record.website || record.matchedExistingLead.website,
              city: record.city || record.matchedExistingLead.city,
              state: record.state || record.matchedExistingLead.state,
              country: record.country || record.matchedExistingLead.country,
              deal_value: record.deal_value || record.matchedExistingLead.deal_value,
              notes: record.notes ? `${record.matchedExistingLead.notes || ''}\n${record.notes}`.trim() : record.matchedExistingLead.notes,
              last_activity_at: new Date().toISOString()
            };
            if (batchTag && (!updated.tags || !updated.tags.includes(batchTag.trim()))) {
              updated.tags = [...(updated.tags || []), batchTag.trim()];
            }
            storage.updateLead(updated);
            updatedCount++;
            return;
          }
          // 'import-anyway' continues below
        }

        // Assign Owner based on strategy
        let assignedOwnerId = null;
        let assignedOwnerName = 'Unassigned';

        if (ownerStrategy === 'round-robin' && reps.length > 0) {
          const assignedRep = reps[index % reps.length];
          assignedOwnerId = assignedRep.user_id;
          assignedOwnerName = assignedRep.name;
        } else if (ownerStrategy === 'location-rule') {
          // Match territory by state/country if matched
          const repMatch = reps.find(r => r.name.toLowerCase().includes((record.city || '').toLowerCase()));
          if (repMatch) {
            assignedOwnerId = repMatch.user_id;
            assignedOwnerName = repMatch.name;
          } else if (reps.length > 0) {
            assignedOwnerId = reps[index % reps.length].user_id;
            assignedOwnerName = reps[index % reps.length].name;
          }
        } else if (ownerStrategy !== 'unassigned') {
          const selectedRep = teamMembers.find(m => m.user_id === ownerStrategy);
          if (selectedRep) {
            assignedOwnerId = selectedRep.user_id;
            assignedOwnerName = selectedRep.name;
          }
        }

        const newLead = {
          id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          org_id: currentOrgId,
          company_name: record.company_name || record.name || 'Unnamed Company',
          name: record.name || record.company_name || 'Contact',
          email: record.email || null,
          phone: record.phone || null,
          website: record.website || null,
          city: record.city || null,
          state: record.state || null,
          country: record.country || 'US',
          location: record.city ? `${record.city}, ${record.country || 'US'}` : (record.country || 'United States'),
          deal_value: record.deal_value ? Number(record.deal_value) : null,
          status: record.status || 'new',
          pipeline_stage: (record.status || 'new').charAt(0).toUpperCase() + (record.status || 'new').slice(1),
          owner_id: assignedOwnerId,
          assigned_to: assignedOwnerId,
          assigned_to_name: assignedOwnerName,
          tags: record.tags || [],
          notes: record.notes || '',
          source: record.source || sourceLabel || 'CSV Import',
          batch_id: sourceLabel,
          created_at: new Date().toISOString(),
          status_changed_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString()
        };

        storage.addLead(newLead);
        leadsToUpsert.push(newLead);
        importedCount++;
      });

      // Best effort backend sync
      try {
        await sessionManager.authFetch('http://localhost:3001/api/analytics/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leads: leadsToUpsert })
        });
      } catch {
        // sync warning handled
      }

      setSummary({
        total: processedRecords.length,
        importedCount,
        updatedCount,
        skippedCount,
        batchId: sourceLabel
      });
      setCurrentStep(4);
    } catch (err) {
      alert('Error committing import: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit Manual Single Lead
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setManualSubmitting(true);
    setManualMessage(null);

    try {
      const currentOrgId = sessionManager.getOrgId();
      const existingLeads = storage.getLeads();

      // Check duplicates
      const dup = existingLeads.find(l => {
        if (manualForm.email && normalizeEmail(l.email) === normalizeEmail(manualForm.email)) return true;
        if (manualForm.phone && normalizePhone(l.phone) === normalizePhone(manualForm.phone) && normalizePhone(manualForm.phone).length >= 7) return true;
        return false;
      });

      if (dup) {
        if (!confirm(`Warning: A lead matching this email/phone already exists ("${dup.company_name || dup.name}"). Create anyway?`)) {
          setManualSubmitting(false);
          return;
        }
      }

      const assignedRep = teamMembers.find(m => m.user_id === manualForm.owner_id);

      const newLead = {
        id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        org_id: currentOrgId,
        company_name: manualForm.company_name.trim(),
        name: manualForm.name.trim(),
        email: manualForm.email.trim() || null,
        phone: manualForm.phone.trim() || null,
        website: manualForm.website.trim() || null,
        city: manualForm.city.trim() || null,
        state: manualForm.state.trim() || null,
        country: manualForm.country.trim() || 'US',
        location: manualForm.city ? `${manualForm.city}, ${manualForm.country || 'US'}` : manualForm.country,
        deal_value: manualForm.deal_value ? Number(manualForm.deal_value) : null,
        status: manualForm.status,
        pipeline_stage: manualForm.status.charAt(0).toUpperCase() + manualForm.status.slice(1),
        owner_id: manualForm.owner_id || null,
        assigned_to: manualForm.owner_id || null,
        assigned_to_name: assignedRep ? assignedRep.name : 'Unassigned',
        tags: manualForm.tags ? manualForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        notes: manualForm.notes.trim() || '',
        source: 'Manual Entry',
        created_at: new Date().toISOString(),
        status_changed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      };

      storage.addLead(newLead);
      try {
        await sessionManager.authFetch('http://localhost:3001/api/analytics/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leads: [newLead] })
        });
      } catch {}

      setManualMessage({ type: 'success', text: `Lead "${newLead.company_name}" created successfully!` });
      setManualForm({
        company_name: '',
        name: '',
        email: '',
        phone: '',
        website: '',
        city: '',
        state: '',
        country: 'US',
        status: 'new',
        owner_id: '',
        tags: '',
        notes: '',
        deal_value: ''
      });
    } catch (err) {
      setManualMessage({ type: 'error', text: err.message });
    } finally {
      setManualSubmitting(false);
    }
  };

  // Counts for Step 3
  const validCount = processedRecords.filter(r => r.validationStatus === 'valid').length;
  const duplicateCount = processedRecords.filter(r => r.validationStatus === 'duplicate').length;
  const invalidCount = processedRecords.filter(r => r.validationStatus === 'invalid').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Editorial Header */}
      <div className="pb-4 border-b border-[#E7E7E7] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8A8A8A]">
              Lead Ingestion Suite
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#EA4B0B]" />
            <span className="text-[10px] font-mono text-[#EA4B0B] font-semibold">
              3-Step Deduplicated Import
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]">
            Import Leads & Prospects
          </h1>
          <p className="text-xs text-[#8A8A8A] mt-1">
            Upload CSV or Excel spreadsheets up to 10MB or enter records manually with cross-organization deduplication.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center bg-[#F5F5F5] border border-[#E7E7E7] rounded-md p-0.5 text-xs font-mono">
          <button
            onClick={() => setMode('upload')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-all cursor-pointer ${
              mode === 'upload'
                ? 'bg-white text-[#111111] font-semibold shadow-2xs'
                : 'text-[#8A8A8A] hover:text-[#111111]'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#EA4B0B]" />
            <span>File Import</span>
          </button>

          <button
            onClick={() => setMode('manual')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-all cursor-pointer ${
              mode === 'manual'
                ? 'bg-white text-[#111111] font-semibold shadow-2xs'
                : 'text-[#8A8A8A] hover:text-[#111111]'
            }`}
          >
            <PenSquare className="w-3.5 h-3.5 text-[#EA4B0B]" />
            <span>Manual Entry</span>
          </button>
        </div>
      </div>

      {/* Mode 1: 3-Step File Import */}
      {mode === 'upload' && (
        <div className="space-y-6">
          {/* 3 Steps Progress Bar */}
          <div className="flex items-center justify-between border border-[#E7E7E7] bg-white rounded-lg p-3 text-xs font-mono">
            {[
              { num: 1, label: '1. Upload & Settings' },
              { num: 2, label: '2. Column Mapping' },
              { num: 3, label: '3. Review & Deduplicate' }
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStep === s.num 
                    ? 'bg-[#EA4B0B] text-white' 
                    : currentStep > s.num 
                      ? 'bg-[#111111] text-white' 
                      : 'bg-gray-100 text-gray-400'
                }`}>
                  {currentStep > s.num ? '✓' : s.num}
                </span>
                <span className={`font-semibold ${currentStep === s.num ? 'text-[#111111]' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* STEP 1: Upload File & Batch Configuration */}
          {currentStep === 1 && (
            <div className="bg-white border border-[#E7E7E7] rounded-xl p-6 space-y-6">
              <div>
                <h2 className="text-base font-bold text-[#111111]">Step 1: Choose File & Batch Settings</h2>
                <p className="text-xs text-[#8A8A8A] mt-0.5">Upload a CSV, XLSX, or XLS file (max 10MB) and define default lead ownership and status.</p>
              </div>

              {/* Drag & Drop File Zone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
                }}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  file ? 'border-emerald-500 bg-emerald-50/20' : 'border-[#E7E7E7] hover:border-gray-400 bg-[#FAFAFA]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white border border-[#E7E7E7] flex items-center justify-center text-[#EA4B0B] shadow-2xs">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#111111]">
                      {file ? file.name : 'Click to select or drag & drop spreadsheet'}
                    </div>
                    <div className="text-xs text-[#8A8A8A] mt-1 font-mono">
                      {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB · Ready for mapping` : 'Supports CSV, XLSX, XLS up to 10MB'}
                    </div>
                  </div>
                </div>
              </div>

              {fileError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}

              {/* Batch Configuration Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#E7E7E7]">
                {/* Default Status */}
                <div>
                  <label className="block text-xs font-mono font-bold text-[#111111] uppercase tracking-wider mb-1.5">
                    Default Status:
                  </label>
                  <select
                    value={defaultStatus}
                    onChange={(e) => setDefaultStatus(e.target.value)}
                    className="w-full text-xs p-2.5 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg focus:outline-none focus:border-[#111111]"
                  >
                    {PIPELINE_STAGES.map((stage) => (
                      <option key={stage} value={stage.toLowerCase()}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lead Owner Assignment */}
                <div>
                  <label className="block text-xs font-mono font-bold text-[#111111] uppercase tracking-wider mb-1.5">
                    Lead Owner Assignment:
                  </label>
                  <select
                    value={ownerStrategy}
                    onChange={(e) => setOwnerStrategy(e.target.value)}
                    className="w-full text-xs p-2.5 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg focus:outline-none focus:border-[#111111]"
                  >
                    <option value="unassigned">Unassigned</option>
                    <option value="round-robin">Round-robin (Distribute across team reps)</option>
                    <option value="location-rule">By Location Rule (Assign by Territory/City)</option>
                    <optgroup label="Assign to Specific Member">
                      {teamMembers.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Tag */}
                <div>
                  <label className="block text-xs font-mono font-bold text-[#111111] uppercase tracking-wider mb-1.5">
                    Batch Tag:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Q4-Campaign, TechConference"
                    value={batchTag}
                    onChange={(e) => setBatchTag(e.target.value)}
                    className="w-full text-xs p-2.5 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg focus:outline-none focus:border-[#111111]"
                  />
                </div>

                {/* Source Label */}
                <div>
                  <label className="block text-xs font-mono font-bold text-[#111111] uppercase tracking-wider mb-1.5">
                    Source Label for this Batch:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Inbound Form 2026, Apollo CSV"
                    value={sourceLabel}
                    onChange={(e) => setSourceLabel(e.target.value)}
                    className="w-full text-xs p-2.5 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg focus:outline-none focus:border-[#111111]"
                  />
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-4 border-t border-[#E7E7E7]">
                <button
                  type="button"
                  disabled={!file || isProcessing}
                  onClick={handleProceedToMapping}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#EA4B0B] hover:bg-[#d03f07] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span>{isProcessing ? 'Analyzing Spreadsheet...' : 'Continue to Column Mapping'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Column Mapping */}
          {currentStep === 2 && (
            <div className="bg-white border border-[#E7E7E7] rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#E7E7E7]">
                <div>
                  <h2 className="text-base font-bold text-[#111111]">Step 2: Map Columns</h2>
                  <p className="text-xs text-[#8A8A8A] mt-0.5">
                    Match your spreadsheet columns with GrowProspect system fields. You can manual remap or ignore columns.
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-[#F5F5F5] rounded border border-[#E7E7E7]">
                  {headers.length} Columns Found · {rawRows.length} Rows
                </span>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-3 text-[11px] font-mono uppercase text-[#8A8A8A] font-bold px-3">
                  <div className="col-span-5">File Column & Sample Value</div>
                  <div className="col-span-2 text-center">Auto-Detected</div>
                  <div className="col-span-5">Map to CRM System Field</div>
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {headers.map((colName) => {
                    const sampleVal = rawRows[0] ? rawRows[0][colName] : '';
                    const mappedField = mapping[colName] || '';

                    return (
                      <div 
                        key={colName}
                        className="grid grid-cols-12 gap-3 items-center p-3 bg-[#FAFAFA] border border-[#E7E7E7] rounded-lg text-xs"
                      >
                        <div className="col-span-5">
                          <div className="font-bold text-[#111111] truncate">{colName}</div>
                          <div className="text-[11px] text-[#8A8A8A] font-mono truncate mt-0.5">
                            Sample: {sampleVal ? `"${sampleVal}"` : <span className="italic">Empty</span>}
                          </div>
                        </div>

                        <div className="col-span-2 text-center">
                          {mappedField ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-mono">
                              Mapped
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-mono">
                              Ignored
                            </span>
                          )}
                        </div>

                        <div className="col-span-5">
                          <select
                            value={mappedField}
                            onChange={(e) => setMapping(prev => ({ ...prev, [colName]: e.target.value }))}
                            className={`w-full p-2 text-xs rounded border focus:outline-none ${
                              mappedField ? 'bg-white border-[#111111] font-semibold text-[#111111]' : 'bg-gray-100 border-[#E7E7E7] text-gray-500'
                            }`}
                          >
                            {SYSTEM_FIELDS.map((sf) => (
                              <option key={sf.value} value={sf.value}>
                                {sf.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-[#E7E7E7]">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="flex items-center gap-2 px-4 py-2 border border-[#E7E7E7] rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Upload</span>
                </button>

                <button
                  type="button"
                  onClick={handleProceedToReview}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#EA4B0B] hover:bg-[#d03f07] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Continue to Review & Deduplicate</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Review, Deduplication & Error File Download */}
          {currentStep === 3 && (
            <div className="bg-white border border-[#E7E7E7] rounded-xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E7E7E7]">
                <div>
                  <h2 className="text-base font-bold text-[#111111]">Step 3: Review Validation & Deduplication</h2>
                  <p className="text-xs text-[#8A8A8A] mt-0.5">
                    Deduplicated across the whole organization by email, phone, and normalized domain.
                  </p>
                </div>

                {/* Counts Badges */}
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-semibold">
                    {validCount} Valid
                  </span>
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded font-semibold">
                    {duplicateCount} Duplicate
                  </span>
                  <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded font-semibold">
                    {invalidCount} Invalid
                  </span>
                </div>
              </div>

              {/* Duplicate Handling Control */}
              <div className="p-4 bg-[#F9F9F9] border border-[#E7E7E7] rounded-xl space-y-3">
                <label className="block text-xs font-mono font-bold text-[#111111] uppercase tracking-wider">
                  Duplicate Handling Strategy:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'skip', title: 'Skip Duplicates', desc: 'Do not import matching rows (Safe)' },
                    { id: 'update', title: 'Update Existing', desc: 'Enrich & merge into existing leads' },
                    { id: 'import-anyway', title: 'Import Anyway', desc: 'Create new leads regardless' }
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        duplicateHandling === opt.id
                          ? 'border-[#EA4B0B] bg-orange-50/20 font-semibold'
                          : 'border-[#E7E7E7] bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="dupChoice"
                          value={opt.id}
                          checked={duplicateHandling === opt.id}
                          onChange={(e) => setDuplicateHandling(e.target.value)}
                          className="accent-[#EA4B0B]"
                        />
                        <span className="text-xs text-[#111111]">{opt.title}</span>
                      </div>
                      <p className="text-[11px] text-[#8A8A8A] mt-1 pl-5">{opt.desc}</p>
                    </label>
                  ))}
                </div>
              </div>

              {/* Row Preview Table */}
              <div className="border border-[#E7E7E7] rounded-lg overflow-hidden">
                <div className="p-3 bg-[#FAFAFA] border-b border-[#E7E7E7] flex items-center justify-between text-xs">
                  <span className="font-bold text-[#111111]">Sample Rows Preview (First 10 of {processedRecords.length})</span>
                  {(duplicateCount > 0 || invalidCount > 0) && (
                    <button
                      onClick={handleDownloadErrorFile}
                      className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-gray-50 border border-[#E7E7E7] rounded text-xs font-mono text-gray-700 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#EA4B0B]" />
                      <span>Download Error / Duplicate File ({duplicateCount + invalidCount})</span>
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F5F5F5] border-b border-[#E7E7E7] font-mono text-[11px] text-[#8A8A8A]">
                      <tr>
                        <th className="p-2.5">Row</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Company</th>
                        <th className="p-2.5">Contact</th>
                        <th className="p-2.5">Email</th>
                        <th className="p-2.5">Phone</th>
                        <th className="p-2.5">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E7E7]">
                      {processedRecords.slice(0, 10).map((r) => (
                        <tr key={r.rowIndex} className="hover:bg-gray-50">
                          <td className="p-2.5 font-mono text-[11px] text-gray-500">{r.rowIndex}</td>
                          <td className="p-2.5">
                            {r.validationStatus === 'valid' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Valid
                              </span>
                            )}
                            {r.validationStatus === 'duplicate' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200" title={r.dupReason}>
                                Duplicate
                              </span>
                            )}
                            {r.validationStatus === 'invalid' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-50 text-red-700 border border-red-200" title={r.errorReason}>
                                Invalid
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-medium text-[#111111]">{r.company_name || '—'}</td>
                          <td className="p-2.5 text-gray-600">{r.name || '—'}</td>
                          <td className="p-2.5 text-gray-600 font-mono text-[11px]">{r.email || '—'}</td>
                          <td className="p-2.5 text-gray-600 font-mono text-[11px]">{r.phone || '—'}</td>
                          <td className="p-2.5 text-gray-600">{r.city ? `${r.city}, ${r.country || 'US'}` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-[#E7E7E7]">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center gap-2 px-4 py-2 border border-[#E7E7E7] rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Mapping</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing || (validCount === 0 && duplicateHandling === 'skip')}
                  onClick={handleCommitImport}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#EA4B0B] hover:bg-[#d03f07] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isProcessing ? 'Importing Leads...' : `Confirm Import (${validCount + (duplicateHandling !== 'skip' ? duplicateCount : 0)} Leads)`}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Finish Summary Screen */}
          {currentStep === 4 && summary && (
            <div className="bg-white border border-[#E7E7E7] rounded-xl p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto shadow-2xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-[#111111]">Batch Import Successfully Completed</h2>
                <p className="text-xs text-[#8A8A8A] mt-1 font-mono">
                  Batch identifier: <strong>{summary.batchId}</strong>
                </p>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto font-mono">
                <div className="p-4 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg">
                  <div className="text-2xl font-bold text-[#111111]">{summary.importedCount}</div>
                  <div className="text-[11px] text-[#8A8A8A] mt-1">Leads Created</div>
                </div>

                <div className="p-4 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg">
                  <div className="text-2xl font-bold text-[#111111]">{summary.updatedCount}</div>
                  <div className="text-[11px] text-[#8A8A8A] mt-1">Existing Updated</div>
                </div>

                <div className="p-4 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg">
                  <div className="text-2xl font-bold text-[#111111]">{summary.skippedCount}</div>
                  <div className="text-[11px] text-[#8A8A8A] mt-1">Skipped / Invalid</div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setCurrentStep(1);
                    setSummary(null);
                  }}
                  className="px-5 py-2.5 border border-[#E7E7E7] rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Import Another Batch
                </button>

                <button
                  type="button"
                  onClick={() => {
                    // Navigate to Leads filtered by batch
                    if (onViewLeads) {
                      onViewLeads(summary.batchId);
                    } else {
                      window.location.hash = '#leads';
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#EA4B0B] hover:bg-[#d03f07] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <span>View Imported Leads</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Manual Single-Lead Entry */}
      {mode === 'manual' && (
        <form onSubmit={handleManualSubmit} className="bg-white border border-[#E7E7E7] rounded-xl p-6 space-y-6">
          <div className="pb-4 border-b border-[#E7E7E7]">
            <h2 className="text-base font-bold text-[#111111]">Manual Single-Lead Entry</h2>
            <p className="text-xs text-[#8A8A8A] mt-0.5">
              Enter individual prospect records with immediate deduplication verification across your organization.
            </p>
          </div>

          {manualMessage && (
            <div className={`p-3 rounded-lg flex items-center gap-2 text-xs ${
              manualMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {manualMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{manualMessage.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold text-[#111111] uppercase tracking-wider mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                placeholder="Acme Innovations Inc"
                value={manualForm.company_name}
                onChange={(e) => setManualForm(prev => ({ ...prev, company_name: e.target.value }))}
                className="w-full text-xs p-2.5 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-[#111111] uppercase tracking-wider mb-1">
                Contact Person *
              </label>
              <input
                type="text"
                required
                placeholder="Jane Smith"
                value={manualForm.name}
                onChange={(e) => setManualForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full text-xs p-2.5 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-[#111111] uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="jane@acme.com"
                value={manualForm.email}
                onChange={(e) => setManualForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full text-xs p-2.5 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-[#111111] uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="+1 (555) 019-2834"
                value={manualForm.phone}
                onChange={(e) => setManualForm(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full text-xs p-2.5 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-[#111111] uppercase tracking-wider mb-1">
                Website
              </label>
              <input
                type="text"
                placeholder="https://acme.com"
                value={manualForm.website}
                onChange={(e) => setManualForm(prev => ({ ...prev, website: e.target.value }))}
                className="w-full text-xs p-2.5 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-[#111111] uppercase tracking-wider mb-1">
                City / Location
              </label>
              <input
                type="text"
                placeholder="San Francisco, CA"
                value={manualForm.city}
                onChange={(e) => setManualForm(prev => ({ ...prev, city: e.target.value }))}
                className="w-full text-xs p-2.5 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-[#111111] uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                value={manualForm.status}
                onChange={(e) => setManualForm(prev => ({ ...prev, status: e.target.value }))}
                className="w-full text-xs p-2.5 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg focus:outline-none focus:border-[#111111]"
              >
                {PIPELINE_STAGES.map((s) => (
                  <option key={s} value={s.toLowerCase()}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-[#111111] uppercase tracking-wider mb-1">
                Owner
              </label>
              <select
                value={manualForm.owner_id}
                onChange={(e) => setManualForm(prev => ({ ...prev, owner_id: e.target.value }))}
                className="w-full text-xs p-2.5 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg focus:outline-none focus:border-[#111111]"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.name} ({m.role})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-[#111111] uppercase tracking-wider mb-1">
                Deal Value ($)
              </label>
              <input
                type="number"
                placeholder="25000"
                value={manualForm.deal_value}
                onChange={(e) => setManualForm(prev => ({ ...prev, deal_value: e.target.value }))}
                className="w-full text-xs p-2.5 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg focus:outline-none focus:border-[#111111]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-[#111111] uppercase tracking-wider mb-1">
                Tags (Comma-separated)
              </label>
              <input
                type="text"
                placeholder="SaaS, Enterprise, Referral"
                value={manualForm.tags}
                onChange={(e) => setManualForm(prev => ({ ...prev, tags: e.target.value }))}
                className="w-full text-xs p-2.5 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg focus:outline-none focus:border-[#111111]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold text-[#111111] uppercase tracking-wider mb-1">
              Internal Notes
            </label>
            <textarea
              rows={2}
              placeholder="Initial lead context, pain points or next actions..."
              value={manualForm.notes}
              onChange={(e) => setManualForm(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full text-xs p-2.5 bg-[#F9F9F9] border border-[#E7E7E7] rounded-lg focus:outline-none focus:border-[#111111]"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-[#E7E7E7]">
            <button
              type="submit"
              disabled={manualSubmitting}
              className="px-6 py-2.5 bg-[#EA4B0B] hover:bg-[#d03f07] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              {manualSubmitting ? 'Saving Lead...' : 'Create Lead'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
