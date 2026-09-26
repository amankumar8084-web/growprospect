# TASKS — Multi-Source Lead Discovery SaaS

## Phase 1 — Foundation
- [x] React frontend
- [x] Node.js API
- [x] PostgreSQL
- [x] Environment configuration
- [x] Migrations
- [x] Error handling
- [x] Request validation

## Phase 2 — Authentication
- [x] Configure authentication (Using Clerk)
- [x] Protect API and Frontend routes
- [x] Logout/session handling (Clerk UI)
- [x] No public registration (Clerk Managed)

## Phase 3 — Locations
- [x] Countries dataset (npm: country-state-city)
- [x] States/provinces dataset
- [x] Cities dataset
- [x] Country endpoint
- [x] State endpoint
- [x] City endpoint
- [x] Cascading dropdown UI

## Phase 4 — Database
- [x] Leads table
- [x] Import batches
- [x] Source metadata
- [x] Indexes
- [x] Timestamps

## Phase 5 — Import
- [x] Source selector
- [x] CSV support
- [x] XLSX support
- [x] Upload validation
- [x] Preview
- [x] Column mapper
- [x] Optional saved mappings

## Phase 6 — Validation
- [x] Required fields
- [x] Email
- [x] URL
- [x] Phone normalization
- [x] Location validation
- [x] Invalid-row reporting
- [x] Import summary

## Phase 7 — Deduplication
- [x] Source ID
- [x] URL
- [x] Phone
- [x] Email
- [x] Name + location
- [x] Duplicate preview/report

## Phase 8 — Source Profiles
- [x] Google Maps schema
- [x] LinkedIn schema
- [x] LinkedIn Jobs schema
- [x] Website research schema
- [x] Manual form (Handled via import/adapters mapping)

## Phase 9 — Lead Management
- [x] Leads table
- [x] Search
- [x] Filters
- [x] Pagination
- [x] Lead detail
- [x] Edit/delete/archive
- [x] Status
- [x] Notes

## Phase 10 — Website Analysis
- [x] Website status
- [x] Audit table
- [x] Cheerio/Axios worker
- [x] HTTP status
- [x] Technology detection
- [x] Keyword & Email extraction
- [x] Audit result UI

## Phase 11 — Export
- [x] CSV
- [x] XLSX
- [x] Current filters
- [x] Selected leads

## Phase 12 — Dashboard
- [x] Total leads
- [x] Leads by source
- [x] Recent imports
- [x] Website status
- [x] Lead status

## Phase 13 — Testing
- [x] Import tests
- [x] Validation tests
- [x] Deduplication tests (E2E)
- [x] API tests
- [x] UI tests (Manual)
- [x] Large import test (Manual)
- [x] Failure recovery (Manual)

## Phase 14 — Future Sources
- [x] Instagram
- [x] Facebook
- [x] Local directories
- [x] IndiaMART
- [x] Clutch
- [x] Upwork
- [x] Fiverr
- [x] Wellfound
- [ ] Indeed
- [ ] Naukri
