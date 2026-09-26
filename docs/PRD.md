# PRD — Multi-Source Lead Discovery SaaS

## 1. Product Overview
A private SaaS for importing, validating, organizing, analyzing, and exporting leads collected manually from multiple sources.

### MVP principle
No paid API or automatic scraping is required. Users collect data themselves and import it through source-specific flows.

## 2. Primary Goal
Users can:
1. Select an import source.
2. Upload CSV/XLSX or enter data manually.
3. Map source columns to system fields.
4. Validate records.
5. Detect duplicates.
6. Store leads in PostgreSQL.
7. Search/filter leads.
8. Export leads.
9. Later analyze websites or add automated discovery.

## 3. Initial Sources
- Google Maps / Google Business Profiles
- LinkedIn
- LinkedIn Jobs
- Website / Direct Research
- Manual Entry
- CSV
- Excel

Future source adapters may include Instagram, Facebook Pages, local directories, IndiaMART, Clutch, Upwork, Fiverr, Wellfound, Indeed, Naukri, and other user-defined sources.

## 4. Lead Types
### Business
Dental clinics, healthcare, grocery, restaurants, salons, coaching, hardware, PG/hostel, local services, etc.

### Person
Founder, owner, HR, recruiter, hiring manager, etc.

### Job
React Developer, Node.js Developer, AI Engineer, Full Stack Developer, etc.

## 5. Core Flow
Login → Dashboard → Import Leads → Select Source → Select Lead Type → Upload/paste → Map columns → Validate → Deduplicate → Import → Leads → Search/Filter/Analyze/Export.

## 6. Source-Specific Fields

### Google Maps
Business name, category, address, country, state, city, postal code, phone, website, Maps URL, Place ID, latitude, longitude, rating, review count.

### LinkedIn
Full name, job title, company, location, LinkedIn URL, company LinkedIn URL, email, phone, industry, notes.

### LinkedIn Jobs
Job title, company, location, job URL, company URL, employment type, experience, skills, posted date, salary, description, source.

### Website Research
Business/company name, website, contact name, email, phone, country, state, city, industry, contact page URL, source URL, notes.

## 7. Location
Cascading selectors:
Country → State/Province → City.

## 8. Lead Status
New, Contacted, Replied, Qualified, Not Interested, Converted, Archived.

## 9. Website Status
Unknown, No Website, Website Exists, Website Unreachable, Outdated Website, Modern Website.

## 10. Validation
Validate required fields, email, URL, phone, location consistency, duplicates, empty rows, invalid rows, and unsupported files.

Show invalid rows before commit. Never silently discard them.

## 11. Deduplication
Preferred identity order:
1. Source-specific ID
2. Canonical URL
3. Phone + name
4. Email
5. Name + location

Report new, duplicate, and invalid records.

## 12. Export
CSV and XLSX. Exports must respect active filters.

## 13. MVP Success Criteria
A user can import, map, validate, deduplicate, store, search, filter, view, and export leads while seeing each lead's source.

## 14. Out of Scope
Automatic Google Maps scraping, automatic LinkedIn scraping, paid enrichment APIs, automated outreach, email/WhatsApp automation, AI scoring, and multi-agent automation.
