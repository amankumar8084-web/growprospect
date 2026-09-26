// Predefined source header mappings to system fields

const GoogleMapsSchema = {
  'title': 'company_name',
  'category': 'category',
  'address': 'address',
  'city': 'city',
  'state': 'state',
  'country': 'country',
  'phone': 'phone',
  'website': 'website',
  'url': 'maps_url' // Maps place URL
};

const LinkedInSchema = {
  'firstName': 'name',
  'lastName': 'name', // Note: usually requires merging in logic
  'fullName': 'name',
  'headline': 'job_title',
  'companyName': 'company_name',
  'email': 'email',
  'profileUrl': 'linkedin_url',
  'companyUrl': 'company_linkedin_url',
  'location': 'city'
};

const LinkedInJobsSchema = {
  'companyName': 'company_name',
  'jobTitle': 'job_title',
  'location': 'city',
  'companyUrl': 'company_linkedin_url',
  'industry': 'industry'
};

const WebsiteResearchSchema = {
  'name': 'name',
  'company': 'company_name',
  'email': 'email',
  'phone': 'phone',
  'domain': 'website',
  'linkedin': 'linkedin_url'
};

// --- Phase 14: Future Sources Stubs ---
const InstagramSchema = { 'username': 'name', 'bio': 'notes', 'link': 'website' };
const FacebookSchema = { 'pageName': 'company_name', 'email': 'email', 'phone': 'phone' };
const LocalDirectoriesSchema = { 'businessName': 'company_name', 'address': 'address', 'phone': 'phone' };
const IndiaMARTSchema = { 'company': 'company_name', 'contactPerson': 'name', 'mobile': 'phone' };
const ClutchSchema = { 'companyName': 'company_name', 'website': 'website', 'location': 'city' };
const UpworkSchema = { 'clientName': 'name', 'country': 'country' };
const FiverrSchema = { 'username': 'name', 'country': 'country' };
const WellfoundSchema = { 'startupName': 'company_name', 'website': 'website' };

const autoMapHeaders = (source, headers) => {
  let schema = {};
  switch (source) {
    case 'Google Maps': schema = GoogleMapsSchema; break;
    case 'LinkedIn': schema = LinkedInSchema; break;
    case 'LinkedIn Jobs': schema = LinkedInJobsSchema; break;
    case 'Website': schema = WebsiteResearchSchema; break;
    case 'Instagram': schema = InstagramSchema; break;
    case 'Facebook': schema = FacebookSchema; break;
    case 'Local Directories': schema = LocalDirectoriesSchema; break;
    case 'IndiaMART': schema = IndiaMARTSchema; break;
    case 'Clutch': schema = ClutchSchema; break;
    case 'Upwork': schema = UpworkSchema; break;
    case 'Fiverr': schema = FiverrSchema; break;
    case 'Wellfound': schema = WellfoundSchema; break;
    default:
      return {};
  }

  const mapping = {};
  headers.forEach(header => {
    // Basic fuzzy match or exact match
    const lowerHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    let matchedField = '';

    for (const [key, val] of Object.entries(schema)) {
      if (key.toLowerCase().replace(/[^a-z0-9]/g, '') === lowerHeader) {
        matchedField = val;
        break;
      }
    }
    mapping[header] = matchedField;
  });

  return mapping;
};

module.exports = {
  GoogleMapsSchema,
  LinkedInSchema,
  LinkedInJobsSchema,
  WebsiteResearchSchema,
  autoMapHeaders
};
