const { z } = require('zod');

// Phone normalization helper (basic regex to strip non-numeric except +)
const normalizePhone = (val) => {
  if (!val) return val;
  const cleaned = val.replace(/[^\d+]/g, '');
  return cleaned;
};

// Validates a single mapped lead record
const leadImportSchema = z.object({
  name: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  email: z.string().email('Invalid email format').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable().transform(normalizePhone),
  website: z.string().url('Invalid URL format').optional().nullable().or(z.literal('')),
  lead_type: z.string().optional().nullable(),
  source_record_id: z.string().optional().nullable(),
  job_title: z.string().optional().nullable(),
  linkedin_url: z.string().url('Invalid URL format').optional().nullable().or(z.literal('')),
  maps_url: z.string().url('Invalid URL format').optional().nullable().or(z.literal('')),
  country: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  website_status: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
}).refine(data => data.name || data.company_name, {
  message: "Either Name or Company Name is required",
  path: ["name", "company_name"]
});

module.exports = {
  leadImportSchema,
  normalizePhone
};
