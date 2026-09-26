# ARCHITECTURE — Multi-Source Lead Discovery SaaS

## 1. System
External source → Import Layer → Column Mapper → Validator → Normalizer → Deduplicator → PostgreSQL → Node.js API → React SaaS.

## 2. Stack
- Frontend: React + JavaScript + Clerk (@clerk/clerk-react)
- Backend: Node.js + Express + JavaScript + Clerk (@clerk/clerk-sdk-node)
- Database: PostgreSQL
- Validation: Zod
- Import: CSV/XLSX parsers
- Future website analysis: Crawlee + Playwright

## 3. Suggested Structure
```text
<!-- apps/
  web/src/{pages,components,features,services,hooks}
  api/src/{routes,controllers,services,validators,importers,normalizers,deduplication,db}
packages/
  shared/{schemas,constants}
workers/
  website-analyzer/ -->

  use mvc pattern architecture
```

## 4. Import Pipeline
Upload → Parse → Preview → Map → Validate → Normalize → Deduplicate → Persist.

Source adapters must return normalized records instead of writing directly to PostgreSQL.

## 5. Source Adapters
GoogleMapsAdapter, LinkedInAdapter, LinkedInJobsAdapter, WebsiteAdapter, CsvAdapter, ExcelAdapter, ManualAdapter.

## 6. Canonical Lead
```text
id
lead_type
source
source_record_id
name
company_name
job_title
category
industry
email
phone
website
linkedin_url
company_linkedin_url
maps_url
address
country
state
city
postal_code
latitude
longitude
notes
website_status
lead_status
created_at
updated_at
```

## 7. Traceability
Every imported record should retain:
- source
- source_record_id
- source_url
- import_batch_id
- imported_at

## 8. Import Batch
Store batch ID, source, filename, total rows, valid rows, duplicate rows, invalid rows, and created time.

## 9. API
```http
POST /api/imports/preview
POST /api/imports/validate
POST /api/imports/commit
GET  /api/imports
GET  /api/imports/:id

GET    /api/leads
GET    /api/leads/:id
POST   /api/leads
PATCH  /api/leads/:id
DELETE /api/leads/:id

GET /api/locations/countries
GET /api/locations/states?countryId=
GET /api/locations/cities?stateId=

POST /api/exports
```

## 10. Database
Initial tables:
- users
- leads
- import_batches
- lead_sources
- website_audits

The model can be normalized further when needed.

## 11. Future Extension
Manual imports, browser-assisted imports, APIs, directories, and website discovery must all feed the same validation/normalization/deduplication pipeline.
