const { leadImportSchema, normalizePhone } = require('./leadSchema');

describe('Validation Tests', () => {
  describe('normalizePhone', () => {
    it('should strip non-numeric characters except +', () => {
      expect(normalizePhone('+1 (555) 123-4567')).toBe('+15551234567');
      expect(normalizePhone('123.456.7890')).toBe('1234567890');
      expect(normalizePhone('call me at 12345')).toBe('12345');
    });

    it('should return falsy for empty values', () => {
      expect(normalizePhone('')).toBe('');
      expect(normalizePhone(null)).toBe(null);
    });
  });

  describe('leadImportSchema', () => {
    it('should pass if name is provided', () => {
      const result = leadImportSchema.safeParse({ name: 'John Doe', email: 'john@test.com' });
      expect(result.success).toBe(true);
    });

    it('should pass if company_name is provided', () => {
      const result = leadImportSchema.safeParse({ company_name: 'Acme Corp' });
      expect(result.success).toBe(true);
    });

    it('should fail if neither name nor company_name is provided', () => {
      const result = leadImportSchema.safeParse({ email: 'john@test.com' });
      expect(result.success).toBe(false);
      expect(result.error.errors[0].message).toBe('Either Name or Company Name is required');
    });

    it('should validate email format', () => {
      const valid = leadImportSchema.safeParse({ name: 'John', email: 'valid@email.com' });
      expect(valid.success).toBe(true);

      const invalid = leadImportSchema.safeParse({ name: 'John', email: 'not-an-email' });
      expect(invalid.success).toBe(false);
      expect(invalid.error.errors[0].message).toBe('Invalid email format');
    });

    it('should allow empty string for email and website', () => {
      const valid = leadImportSchema.safeParse({ name: 'John', email: '', website: '' });
      expect(valid.success).toBe(true);
    });
  });
});
