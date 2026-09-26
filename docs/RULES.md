# RULES — Multi-Source Lead Discovery SaaS

## Data Accuracy
Never invent lead information. If unavailable, use NULL/empty.

## Source Traceability
Every lead must retain its source and, when available, the original source URL and source record ID.

## No Silent Mock Data
Production flows must never silently use fake, sample, hardcoded, cached, or demo leads.

## Import Safety
Always use:
`Parse → Preview → Validate → Deduplicate → Commit`

## Duplicate Safety
Prefer source IDs and canonical URLs, then phone/email/name+location.

## Null Over Guess
An unknown email/phone is better than a guessed value.

## Location Integrity
Validate Country → State/Province → City relationships.

## Website Status
Do not mark a site outdated from appearance alone. Future audits should store observable evidence such as broken links/assets, HTTPS issues, mobile issues, obsolete technology, inaccessible pages, and stale-content indicators.

## Authentication
Private SaaS. No public registration page required for MVP.

## Secrets
Never expose API keys, DB passwords, or auth secrets in frontend code or logs.

## File Upload
Allow only explicit file types and sensible size/row limits. Reject executable/unknown files.

## External Sources
Respect applicable platform terms, policies, rate limits, robots rules, and laws. Do not bypass authentication, CAPTCHAs, access controls, or platform restrictions.

## UI
Do not add sections without a real user function. Keep the interface simple and data-focused.

## Testing
Test valid/invalid imports, malformed files, missing fields, duplicates, empty files, large files, invalid URLs/emails, location mismatches, and partial failures.

## Future Automation
Automatic discovery must become another source feeding the same ingestion pipeline.

## Product Principle
Reliability is more important than lead volume.
