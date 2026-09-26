# DECISIONS — Multi-Source Lead Discovery SaaS

## 001 — Manual Import First
The MVP uses manually collected data instead of paid APIs or automatic scraping.
Reason: zero initial API cost, simpler implementation, faster validation.

## 002 — Source-Specific Import Modes
Initial modes: Google Maps, LinkedIn, LinkedIn Jobs, Website, CSV/Excel, Manual.
Reason: different sources expose different fields and identifiers.

## 003 — Common Canonical Schema
All sources normalize into a common internal lead model.
Reason: multiple sources can feed one database.

## 004 — Preserve Source Metadata
Store source, source URL, source record ID where available, and import batch.
Reason: traceability and deduplication.

## 005 — PostgreSQL
Primary database for structured relational lead/import/location/audit data.

## 006 — React + Node.js
Frontend React/JavaScript; backend Node.js/JavaScript.

## 007 — No Silent Fallback Data
Never replace failed imports/external data with fake/sample records.

## 008 — Null Over Guess
Unavailable contact/location data remains empty/null.

## 009 — Evidence-Based Website Analysis
A website is not outdated solely because it looks old. Store observable evidence.

## 010 — Automation Later
Browser extensions, APIs, crawlers, and other automated discovery mechanisms are added after the manual-import MVP is stable.

## 011 — Extensible Sources
New sources plug into the same ingestion/validation/normalization/deduplication pipeline.

## 012 — MVP Priority
Reliable Import → Validation → Deduplication → Lead Management → Export → Website Analysis → Automation.
