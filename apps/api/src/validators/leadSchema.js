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
}).refine(data => data.name || data.company_name, {
  message: "Either Name or Company Name is required",
  path: ["name", "company_name"]
});

module.exports = {
  leadImportSchema,
  normalizePhone
};
