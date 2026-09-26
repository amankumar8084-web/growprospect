# DESIGN — Multi-Source Lead Discovery SaaS
use stitch mcp for desiging
## 1. Design Goal
Clean, modern, data-focused SaaS UI. Avoid excessive cards, duplicate statistics, permanent sidebar clutter, unnecessary animations, and decorative sections.

## 2. Sidebar

`Logo | Dashboard | Import | Leads | Settings | Profile`


## 3. Dashboard
Only useful information:
- Total Leads
- New Leads
- Contacted
- Qualified
- Recent Imports

## 4. Import Page
### Step 1 — Source
Cards:
- Google Maps
- LinkedIn
- LinkedIn Jobs
- Website
- CSV / Excel
- Manual

### Step 2 — Upload
Drag/drop or file chooser; allow paste where useful.

### Step 3 — Mapping
```text
Source Column → System Field
Business Name → Business Name
Phone Number → Phone
Website URL → Website
City → City
```

### Step 4 — Validation
Show valid, duplicate, and invalid counts. Show invalid rows with reasons.

### Step 5 — Import
Show final summary.

## 5. Leads Table
Common columns:
Name, Company, Category, Location, Phone, Email, Website, Source, Website Status, Lead Status, Created.

Use horizontal scrolling instead of squeezing fields.

## 6. Filters
Source, lead type, country, state, city, category, industry, website status, lead status, import date.

## 7. Lead Detail
Business/person, contact details, location, source, source URL, website, social URLs, statuses, notes, import information.

## 8. Visual Language
Neutral background, neutral surfaces, one primary accent, clear borders, moderate radius, strong typography hierarchy, consistent spacing. Avoid excessive gradients and shadows.

## 9. Responsive
Desktop-first because lead tables are data-heavy. Mobile supports dashboard, import, search, and lead details; large tables may scroll horizontally.

## 10. Empty/Error States
Explain what is missing, what failed, why it failed, and how to fix it. Avoid generic errors.
