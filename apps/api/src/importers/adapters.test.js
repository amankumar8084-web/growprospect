const { autoMapHeaders } = require('./adapters');

describe('Import Adapters Tests', () => {
  it('should auto map Google Maps headers correctly', () => {
    const headers = ['Title', 'Category', 'Address', 'Phone', 'Website', 'URL', 'Unknown Field'];
    const mapping = autoMapHeaders('Google Maps', headers);
    
    expect(mapping['Title']).toBe('company_name');
    expect(mapping['Category']).toBe('category');
    expect(mapping['Address']).toBe('address');
    expect(mapping['Phone']).toBe('phone');
    expect(mapping['Website']).toBe('website');
    expect(mapping['URL']).toBe('maps_url');
    expect(mapping['Unknown Field']).toBe(''); // Not mapped
  });

  it('should auto map LinkedIn headers correctly', () => {
    const headers = ['First Name', 'Last Name', 'Company Name', 'Email', 'Profile URL'];
    const mapping = autoMapHeaders('LinkedIn', headers);
    
    expect(mapping['First Name']).toBe('name'); // note: mapping might map multiple to 'name' depending on fuzzy matching, this tests our implementation
    expect(mapping['Company Name']).toBe('company_name');
    expect(mapping['Email']).toBe('email');
    expect(mapping['Profile URL']).toBe('linkedin_url');
  });

  it('should return empty mapping for unknown source', () => {
    const headers = ['Name', 'Email'];
    const mapping = autoMapHeaders('Unknown Source', headers);
    expect(mapping).toEqual({});
  });
});
