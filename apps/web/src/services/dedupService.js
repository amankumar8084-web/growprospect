/**
 * Deduplication & Normalization Utilities
 */

export function normalizeDomain(url) {
  if (!url) return '';
  try {
    let str = url.trim().toLowerCase();
    if (!str.startsWith('http://') && !str.startsWith('https://')) {
      str = 'https://' + str;
    }
    const u = new URL(str);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].trim();
  }
}

export function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

export function normalizeEmail(email) {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

export const dedupService = {
  normalizeDomain,
  normalizePhone,
  normalizeEmail,
  isDuplicate(candidate, existingList) {
    const candEmail = normalizeEmail(candidate.email);
    const candPhone = normalizePhone(candidate.phone);
    const candDomain = normalizeDomain(candidate.website);
    return existingList.some(e => {
      if (candEmail && normalizeEmail(e.email) === candEmail) return true;
      if (candPhone && candPhone.length >= 7 && normalizePhone(e.phone) === candPhone) return true;
      if (candDomain && normalizeDomain(e.website) === candDomain) return true;
      return false;
    });
  }
};
