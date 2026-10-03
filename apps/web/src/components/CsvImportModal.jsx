import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  X, 
  Check, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Trash2, 
  Plus, 
  Sparkles,
  Download,
  Building2,
  Mail,
  Phone,
  MapPin,
  Tag,
  DollarSign
} from 'lucide-react';
import readXlsxFile from 'read-excel-file/browser';
import { storage } from '../services/storage';
import { sessionManager } from '../services/sessionManager';
import { soundService } from '../services/soundService';

const CRM_FIELDS = [
  { key: 'company_name', label: 'Company / Client Name', required: true },
  { key: 'name', label: 'Contact Person Name' },
  { key: 'email', label: 'Email Address' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'location', label: 'Location / City' },
  { key: 'category', label: 'Category / Tag' },
  { key: 'deal_value', label: 'Deal Value ($)' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
  { key: '_ignore', label: '— Ignore this column —' }
];

const AUTO_MAP_RULES = {
  company_name: ['company', 'client', 'business', 'org', 'firm', 'agency', 'company_name', 'client_name', 'account', 'title'],
  name: ['contact', 'name', 'person', 'fullname', 'first_name', 'contact_name', 'lead_name', 'owner'],
  email: ['email', 'mail', 'email_address', 'e-mail', 'contact_email'],
  phone: ['phone', 'tel', 'mobile', 'telephone', 'cell', 'phone_number', 'contact_phone'],
  location: ['location', 'city', 'town', 'address', 'country', 'state', 'region'],
  category: ['category', 'tag', 'tags', 'industry', 'type', 'segment', 'opportunity'],
  deal_value: ['deal', 'value', 'deal_value', 'amount', 'budget', 'price', 'revenue', 'cost'],
  status: ['status', 'stage', 'pipeline', 'state'],
  notes: ['notes', 'note', 'comment', 'description', 'remarks']
};

export default function CsvImportModal({ isOpen, onClose, onImportSuccess }) {
  const fileInputRef = useRef(null);
  const [step, setStep] = useState(1); // 1: Upload, 2: Map Fields, 3: Edit & Preview
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});
  const [editableRows, setEditableRows] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Simple CSV Parser handling quotes and commas
  const parseCSVText = (text) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line) => {
      const result = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const parsedHeaders = parseLine(lines[0]);
    const parsedRows = lines.slice(1).map(parseLine);
    return { headers: parsedHeaders, rows: parsedRows };
  };

  // Handle File Selection
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setFileName(file.name);
    setIsProcessing(true);

    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const rows = await readXlsxFile(file);
        if (rows.length > 0) {
          const fileHeaders = rows[0].map(h => String(h || '').trim());
          const fileRows = rows.slice(1).map(r => r.map(c => (c !== null && c !== undefined ? String(c) : '')));
          setupMapping(fileHeaders, fileRows);
        } else {
          setErrorMsg('File appears to be empty.');
        }
      } else {
        // Assume CSV / Text
        const text = await file.text();
        const { headers: fileHeaders, rows: fileRows } = parseCSVText(text);
        if (fileHeaders.length > 0) {
          setupMapping(fileHeaders, fileRows);
        } else {
          setErrorMsg('Could not detect headers in CSV.');
        }
      }
    } catch (err) {
      setErrorMsg(`Failed to parse file: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Smart Auto-Mapping
  const setupMapping = (detectedHeaders, rows) => {
    setHeaders(detectedHeaders);
    setRawRows(rows);

    const initialMapping = {};
    detectedHeaders.forEach((header) => {
      const cleanH = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
      let matchedKey = '_ignore';

      for (const [key, patterns] of Object.entries(AUTO_MAP_RULES)) {
        if (patterns.some(p => cleanH === p || cleanH.includes(p))) {
          matchedKey = key;
          break;
        }
      }
      initialMapping[header] = matchedKey;
    });

    setFieldMapping(initialMapping);
    setStep(2);
  };

  // Generate Editable Rows based on mapping
  const proceedToEditPreview = () => {
    const mappedRecords = rawRows.map((row, idx) => {
      const record = { _id: `row_${idx}_${Date.now()}` };
      
      // Initialize defaults
      record.company_name = '';
      record.name = '';
      record.email = '';
      record.phone = '';
      record.location = '';
      record.category = '';
      record.deal_value = '';
      record.status = 'new';
      record.notes = '';

      headers.forEach((h, hIdx) => {
        const targetField = fieldMapping[h];
        if (targetField && targetField !== '_ignore') {
          const val = row[hIdx] ? String(row[hIdx]).trim() : '';
          record[targetField] = val;
        }
      });

      // Fallback: If company is empty but name exists
      if (!record.company_name && record.name) {
        record.company_name = record.name;
      }
      if (!record.company_name && !record.name) {
        record.company_name = `Client ${idx + 1}`;
      }

      // Sanitize status
      const s = (record.status || 'new').toLowerCase();
      if (['new', 'contacted', 'follow-up', 'followup', 'interested', 'closed', 'won', 'lost'].includes(s)) {
        record.status = s === 'won' ? 'closed' : (s === 'followup' ? 'follow-up' : s);
      } else {
        record.status = 'new';
      }

      return record;
    });

    setEditableRows(mappedRecords);
    setStep(3);
  };

  // Edit cell value in preview
  const handleCellChange = (rowIndex, field, value) => {
    setEditableRows(prev => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [field]: value };
      return next;
    });
  };

  // Delete row in preview
  const handleDeleteRow = (rowIndex) => {
    setEditableRows(prev => prev.filter((_, i) => i !== rowIndex));
  };

  // Add empty row in preview
  const handleAddEmptyRow = () => {
    setEditableRows(prev => [
      ...prev,
      {
        _id: `row_new_${Date.now()}`,
        company_name: '',
        name: '',
        email: '',
        phone: '',
        location: '',
        category: '',
        deal_value: '',
        status: 'new',
        notes: ''
      }
    ]);
  };

  // Confirm Import & Save
  const handleConfirmImport = () => {
    if (editableRows.length === 0) {
      alert('No rows available to import.');
      return;
    }

    const orgId = sessionManager.getOrgId() || 'org_default';

    const newLeads = editableRows.map((row, idx) => {
      const compName = (row.company_name || row.name || `Imported Client ${idx + 1}`).trim();
      const statusVal = row.status || 'new';

      return {
        id: `lead_csv_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        name: row.name?.trim() || compName,
        company_name: compName,
        email: row.email?.trim() || '',
        phone: row.phone?.trim() || '',
        location: row.location?.trim() || '',
        city: row.location?.trim() || '',
        tags: row.category?.trim() ? [row.category.trim()] : ['CSV Import'],
        opportunityType: row.category?.trim() || 'General',
        deal_value: Number(row.deal_value) || 0,
        status: statusVal,
        pipeline_stage: statusVal === 'closed' ? 'Won' : statusVal.charAt(0).toUpperCase() + statusVal.slice(1),
        notes: row.notes?.trim() || '',
        source: `CSV Import (${fileName || 'file'})`,
        created_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        org_id: orgId
      };
    });

    storage.addLeads(newLeads);
    soundService.playSuccessSound();

    if (onImportSuccess) {
      onImportSuccess(newLeads.length);
    }

    onClose();
  };

  // Download Sample CSV
  const handleDownloadSample = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Company Name,Contact Name,Email,Phone,Location,Category,Deal Value,Status,Notes\n" +
      "Acme Innovations,Sarah Connor,sarah@acme.com,+1 555-0192,New York US,SaaS,15000,new,Met at Tech Expo\n" +
      "Stark Logistics,Tony Miller,tony@starklog.com,+1 555-0143,Austin US,Enterprise,25000,contacted,Looking for CRM solution\n" +
      "GreenPulse Energy,Elena Rostova,elena@greenpulse.io,+44 20 7946 0912,London UK,CleanTech,8500,interested,Requested proposal";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sample_clients_import.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-150 font-sans">
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#ea580c] flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Import Clients (CSV / Excel)</h3>
              <p className="text-xs text-gray-400">
                {step === 1 && 'Upload your spreadsheet or CSV file'}
                {step === 2 && 'Map spreadsheet columns to CRM Client fields'}
                {step === 3 && 'Review and edit client fields directly before importing'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Step Indicators */}
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 1 ? 'bg-[#ea580c] text-white' : 'bg-gray-100 text-gray-600'}`}>1</span>
              <span className="w-4 h-0.5 bg-gray-200" />
              <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 2 ? 'bg-[#ea580c] text-white' : 'bg-gray-100 text-gray-600'}`}>2</span>
              <span className="w-4 h-0.5 bg-gray-200" />
              <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step === 3 ? 'bg-[#ea580c] text-white' : 'bg-gray-100 text-gray-600'}`}>3</span>
            </div>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Upload File */}
          {step === 1 && (
            <div className="space-y-6">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 hover:border-[#ea580c] bg-gray-50/60 hover:bg-orange-50/20 rounded-2xl p-12 text-center cursor-pointer transition-all space-y-3 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-gray-100 flex items-center justify-center mx-auto text-gray-400 group-hover:text-[#ea580c] group-hover:scale-105 transition-all">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Click or drag & drop your CSV or Excel file</p>
                  <p className="text-xs text-gray-400 mt-1">Supports .csv, .xlsx, .xls (Up to 10MB)</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-xl text-xs">
                <div className="space-y-0.5">
                  <p className="font-semibold text-gray-800">Need a format reference?</p>
                  <p className="text-gray-400">Download our sample CSV template with standard fields.</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-gray-500" />
                  <span>Download Sample CSV</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Map Fields */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Map Columns to Client Fields</h4>
                  <p className="text-xs text-gray-400">Found {headers.length} columns and {rawRows.length} rows in <span className="font-semibold text-gray-700">{fileName}</span></p>
                </div>

                <span className="px-2.5 py-1 bg-orange-50 text-[#ea580c] font-semibold text-xs rounded-lg border border-orange-200/60">
                  Auto-mapped with Smart Match
                </span>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                <div className="grid grid-cols-12 bg-gray-50/80 p-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <div className="col-span-5">Spreadsheet Column Header</div>
                  <div className="col-span-2 text-center">Sample Data</div>
                  <div className="col-span-5">CRM Client Field</div>
                </div>

                {headers.map((header, idx) => {
                  const sampleVal = rawRows[0]?.[idx] || '—';
                  return (
                    <div key={header} className="grid grid-cols-12 items-center p-3 text-xs gap-3 hover:bg-gray-50/50 transition-colors">
                      <div className="col-span-5 font-semibold text-gray-800 truncate">
                        {header}
                      </div>

                      <div className="col-span-2 text-gray-400 text-[11px] truncate italic">
                        {String(sampleVal)}
                      </div>

                      <div className="col-span-5">
                        <select
                          value={fieldMapping[header] || '_ignore'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFieldMapping(prev => ({ ...prev, [header]: val }));
                          }}
                          className={`w-full py-1.5 px-2.5 rounded-lg border text-xs font-semibold focus:outline-none cursor-pointer transition-colors ${
                            fieldMapping[header] && fieldMapping[header] !== '_ignore'
                              ? 'bg-orange-50/40 border-orange-200 text-[#ea580c]'
                              : 'bg-gray-50 border-gray-200 text-gray-500'
                          }`}
                        >
                          {CRM_FIELDS.map(f => (
                            <option key={f.key} value={f.key}>{f.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Edit & Preview Grid */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Interactive Client Editor</h4>
                  <p className="text-xs text-gray-400">Click any field in the table below to edit, fix typos, or adjust before saving.</p>
                </div>

                <button
                  onClick={handleAddEmptyRow}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Row</span>
                </button>
              </div>

              {/* Editable Table */}
              <div className="border border-gray-200 rounded-xl overflow-x-auto max-h-[50vh]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider z-10">
                    <tr>
                      <th className="py-2.5 px-3 min-w-[150px]">Company Name *</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Contact Name</th>
                      <th className="py-2.5 px-3 min-w-[150px]">Email</th>
                      <th className="py-2.5 px-3 min-w-[120px]">Phone</th>
                      <th className="py-2.5 px-3 min-w-[110px]">Location</th>
                      <th className="py-2.5 px-3 min-w-[100px]">Category</th>
                      <th className="py-2.5 px-3 min-w-[90px]">Value ($)</th>
                      <th className="py-2.5 px-3 min-w-[110px]">Status</th>
                      <th className="py-2.5 px-2 text-center w-10"></th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 bg-white">
                    {editableRows.map((row, rIdx) => (
                      <tr key={row._id || rIdx} className="hover:bg-gray-50/60 transition-colors">
                        {/* Company Name */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.company_name || ''}
                            onChange={(e) => handleCellChange(rIdx, 'company_name', e.target.value)}
                            placeholder="Company Name"
                            className="w-full p-1.5 bg-transparent border border-transparent hover:border-gray-200 focus:border-gray-900 focus:bg-white rounded font-semibold text-gray-900 text-xs"
                          />
                        </td>

                        {/* Contact Name */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.name || ''}
                            onChange={(e) => handleCellChange(rIdx, 'name', e.target.value)}
                            placeholder="Contact Person"
                            className="w-full p-1.5 bg-transparent border border-transparent hover:border-gray-200 focus:border-gray-900 focus:bg-white rounded text-gray-800 text-xs"
                          />
                        </td>

                        {/* Email */}
                        <td className="p-2">
                          <input
                            type="email"
                            value={row.email || ''}
                            onChange={(e) => handleCellChange(rIdx, 'email', e.target.value)}
                            placeholder="email@domain.com"
                            className="w-full p-1.5 bg-transparent border border-transparent hover:border-gray-200 focus:border-gray-900 focus:bg-white rounded text-gray-700 text-xs"
                          />
                        </td>

                        {/* Phone */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.phone || ''}
                            onChange={(e) => handleCellChange(rIdx, 'phone', e.target.value)}
                            placeholder="+1 555-0000"
                            className="w-full p-1.5 bg-transparent border border-transparent hover:border-gray-200 focus:border-gray-900 focus:bg-white rounded text-gray-700 text-xs"
                          />
                        </td>

                        {/* Location */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.location || ''}
                            onChange={(e) => handleCellChange(rIdx, 'location', e.target.value)}
                            placeholder="City, US"
                            className="w-full p-1.5 bg-transparent border border-transparent hover:border-gray-200 focus:border-gray-900 focus:bg-white rounded text-gray-700 text-xs"
                          />
                        </td>

                        {/* Category */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.category || ''}
                            onChange={(e) => handleCellChange(rIdx, 'category', e.target.value)}
                            placeholder="Tag"
                            className="w-full p-1.5 bg-transparent border border-transparent hover:border-gray-200 focus:border-gray-900 focus:bg-white rounded text-gray-700 text-xs"
                          />
                        </td>

                        {/* Deal Value */}
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            value={row.deal_value || ''}
                            onChange={(e) => handleCellChange(rIdx, 'deal_value', e.target.value)}
                            placeholder="0"
                            className="w-full p-1.5 bg-transparent border border-transparent hover:border-gray-200 focus:border-gray-900 focus:bg-white rounded text-gray-700 text-xs font-semibold"
                          />
                        </td>

                        {/* Status */}
                        <td className="p-2">
                          <select
                            value={row.status || 'new'}
                            onChange={(e) => handleCellChange(rIdx, 'status', e.target.value)}
                            className="w-full p-1.5 bg-transparent border border-transparent hover:border-gray-200 focus:border-gray-900 focus:bg-white rounded text-xs font-medium cursor-pointer"
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="follow-up">Follow-up</option>
                            <option value="interested">Interested</option>
                            <option value="closed">Closed</option>
                            <option value="lost">Lost</option>
                          </select>
                        </td>

                        {/* Delete Row */}
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(rIdx)}
                            className="p-1 text-gray-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-200 bg-white hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 text-xs font-semibold text-gray-700 rounded-lg hover:bg-gray-100 bg-white cursor-pointer"
            >
              Cancel
            </button>

            {step === 2 && (
              <button
                type="button"
                onClick={proceedToEditPreview}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <span>Preview & Edit ({rawRows.length} rows)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={editableRows.length === 0}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold rounded-lg shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Confirm & Import {editableRows.length} Clients</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
