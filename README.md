# GrowProspect — Multi-Tenant Team CRM & Lead Discovery Platform

GrowProspect is a high-performance, multi-tenant B2B Sales Team CRM and automated lead discovery platform. Built with an editorial React dashboard and an asynchronous Node.js backend, GrowProspect connects live web discovery engines, verified contact enrichment, and pipeline execution into a unified sales operating system.

---

## 1. Core Architecture & Operating Principles

1. **Multi-Tenant by Design**: Every database table, API route, and search query is strictly isolated by Clerk Organization ID (`org_id`). Cross-tenant access is structurally prevented.
2. **Role-Based Governance (`requireRole`)**:
   - `admin`: Full administrative control, team member creation and role updates, provider credentials.
   - `manager`: Comprehensive pipeline visibility, lead assignment/reassignment, and team dashboards.
   - `rep`: Focused execution on assigned personal clients and claiming unassigned opportunities. Restricted from modifying deals or reassigning tasks owned by other members.
3. **Fixed 7-Stage Pipeline**: `New` → `Contacted` → `Replied` → `Meeting` → `Proposal` → `Won` → `Lost`. Every stage transition automatically generates an audit activity log entry. Dropping deals into `Lost` requires a standardized lost reason.
4. **Modern Design System & Typography**:
   - Clean Inter sans-serif typography across all dashboard views.
   - Harmonized color palette: Crisp white canvas, warm gray cards, and `#EA4B0B` (Flame Orange) action accents.
   - Tabular alignment and formatted currency indicators for deal values and conversion rates.
5. **Access & Refresh Token Lifecycle**:
   - Centralized session token management via `sessionManager.js` with automatic token refresh (`skipCache: true`) on `401 Unauthorized` responses.

---

## 2. Platform Modules & Navigation

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        GROWPROSPECT TEAM CRM                           │
├─────────────────┬───────────────────┬─────────────────┬────────────────┤
│ 1. DASHBOARD    │ 2. CLIENTS        │ 3. PIPELINE     │ 4. TASKS       │
│ • 6 Top KPIs    │ • 6 KPI Cards     │ • 4 Summary KPIs│ • Due Today    │
│ • Stage Funnel  │ • Table Sorting   │ • 7 Stage Board │ • Overdue      │
│ • Top Locations │ • + Add Client    │ • @dnd-kit DnD  │ • Reassignment │
│ • Team Leaderbrd│ • CSV/Excel Import│ • Lost Reason   │ • Sound Alerts │
├─────────────────┴───────────────────┴─────────────────┴────────────────┤
│ 5. USERS (User Management) & 6. AUDIO NOTIFICATIONS                    │
│ • Member Roster & Role Assignment (Admin / Manager / Sales Rep)        │
│ • Web Audio API Synthesizer (Instant melodic chimes & completion tones) │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Executive Dashboard (`DashboardView`)
- **6 Core KPI Cards**: Total Clients, New, Contacted, Follow-up, Interested, and Closed.
- **Client Pipeline Funnel**: Visual representation of deals across all active pipeline stages.
- **Top Locations & Sources**: Territorial breakdown and client acquisition source attribution.
- **Quick Action**: Direct `+ Add Client` modal with instant feedback and sound effects.

### 2.2 Clients Directory & Embedded CSV Import (`LeadsTable`, `CsvImportModal`)
- **6 KPI Summary Cards**: Real-time count of active clients by status.
- **Data Table**: Columns for `CLIENT ⇅`, `CONTACT`, `LOCATION`, `CATEGORY`, `STATUS ⇅`, `OWNER`, `UPDATED ⌄`, and `ACTIONS`.
- **Inline Status Dropdown**: Immediate stage change with automatic audit log and mandatory lost reason prompt for lost deals.
- **Interactive CSV/Excel Import**:
  - **Step 1 — Upload**: Drag-and-drop CSV or Excel (`.xlsx`, `.xls`) files with a downloadable sample template.
  - **Step 2 — Smart Auto-Mapping**: Automatic detection of header fields (`Company`, `Contact`, `Email`, `Phone`, `Location`, `Category`, `Deal Value`, `Status`, `Notes`).
  - **Step 3 — In-Place Cell Editor**: Edit or modify any imported cell directly before finalizing the import.
  - **Step 4 — Deduplication & Batch Sync**: Automatic deduplication and instant synchronization to the workspace.

### 2.3 Drag-and-Drop Pipeline Kanban (`PipelineView`)
- **4 Top KPI Cards**: Total Active Deals, Win Rate %, Weighted Pipeline ($), and Won Value ($).
- **Accessible DnD Board**: Powered by `@dnd-kit` with touch and pointer sensors across all 7 stages.
- **Optimistic State Updates**: Instant visual response with automatic rollback on network failure.
- **Stage Badges & Metrics**: Individual stage card counters, total deal valuation, and dashboard-harmonized stage indicators.

### 2.4 Tasks & Execution Queue (`TasksView`)
- **Workflow Filters**: `Due Today` | `Overdue` | `Upcoming` | `Completed` | `All Tasks`.
- **Scope Selector**: Pre-filtered to `My Tasks` with a manager toggle for `All Team Tasks`.
- **Manager Reassignment**: Managers and Admins can reassign follow-ups directly to any team member.
- **Task Creation & Completion**: Interactive completion toggles with auditory confirmation chimes.

### 2.5 User Management (`UserManagementView`)
- **Team Roster**: List all organization team members with role badges (`Admin`, `Manager`, `Sales Rep`).
- **Create User / Member**: Modal for adding or inviting team members with role selection and department tags.
- **Role Permissions**: Role guards preventing reps from altering organization structure or member roles.

### 2.6 Notification & Audio Sound Engine (`NotificationPopover`, `soundService.js`)
- **Web Audio API Synthesis**: Zero-latency synthetic melodic chimes (587Hz $\rightarrow$ 880Hz) and 3-note success arpeggios that work on all browsers without external audio asset downloads.
- **Real-Time Notification Popover**: Dropdown attached to the top-bar bell icon showing due tasks, new client additions, and workspace activity.
- **Sound Triggers**: Automatic sound effects on client addition, CSV import completion, task completion, and due task alerts.

### 2.7 Collapsible Sidebar (`Sidebar`)
- **Mini-Mode Slider Toggle**: Bottom-left collapse button to toggle between full width (`w-64`) and compact icon-only mode (`w-20`).
- **Dynamic Brand Logo**: Displays the full horizontal logo when expanded and the official brand icon (`favicon.svg`) when collapsed.

---

## 3. Data Model & Schema

### Leads / Clients Schema (`leads`)
```sql
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT,
  company_name TEXT NOT NULL,
  job_title TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  location TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'US',
  status TEXT NOT NULL DEFAULT 'new',
  pipeline_stage TEXT NOT NULL DEFAULT 'New',
  lost_reason TEXT,
  status_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  owner_id TEXT,
  assigned_to TEXT,
  assigned_to_name TEXT DEFAULT 'Unassigned',
  assigned_at TIMESTAMP WITH TIME ZONE,
  created_by TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  next_followup DATE,
  last_contacted TIMESTAMP WITH TIME ZONE,
  deal_value NUMERIC,
  opportunity_type TEXT,
  source TEXT,
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_org_id ON leads(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_owner_id ON leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
```

### Activities Schema (`activities`)
```sql
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'note' | 'call' | 'email' | 'whatsapp' | 'status_change' | 'assignment'
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activities_org_id ON activities(org_id);
CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id);
```

### Tasks Schema (`tasks`)
```sql
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  lead_id TEXT REFERENCES leads(id) ON DELETE SET NULL,
  assignee_id TEXT NOT NULL,
  title TEXT NOT NULL,
  due_date DATE,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_org_id ON tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
```

---

## 4. API Endpoints

All endpoints except `GET /api/health` require a valid Clerk Bearer JWT token in the `Authorization` header.

| Method | Endpoint | Allowed Roles | Description |
|---|---|:---:|---|
| `GET` | `/api/health` | Public | Service health and active worker memory counters |
| `GET` | `/api/auth/session` | Rep, Manager, Admin | Validates Clerk token, returns decoded role & org_id |
| `GET` | `/api/leads` | Rep, Manager, Admin | Paginated client query with filters (rep scoped to own/unassigned) |
| `POST` | `/api/leads` | Rep, Manager, Admin | Create a single client record |
| `PATCH`| `/api/leads/:id` | Rep, Manager, Admin | Update client fields, stage, or owner (rep restricted to own) |
| `DELETE`| `/api/leads/:id` | Manager, Admin | Delete a client record |
| `POST` | `/api/leads/:id/claim` | Rep, Manager, Admin | Rep claims an unassigned client |
| `POST` | `/api/leads/bulk` | Rep, Manager, Admin | Bulk status, tag, assign (manager+), delete (manager+) |
| `GET` | `/api/leads/:id/activities` | Rep, Manager, Admin | List activity timeline for a client |
| `POST` | `/api/leads/:id/activities` | Rep, Manager, Admin | Append note or interaction log to a client |
| `GET` | `/api/tasks` | Rep, Manager, Admin | List tasks (filtered by due=today, overdue, upcoming, mine) |
| `POST` | `/api/tasks` | Rep, Manager, Admin | Create task commitment |
| `PATCH`| `/api/tasks/:id` | Rep, Manager, Admin | Complete task or reassign (manager+) |
| `GET` | `/api/crm/pipeline` | Rep, Manager, Admin | Pipeline clients grouped into the 7 stages with deal values |
| `GET` | `/api/crm/team` | Rep, Manager, Admin | List active team members in organization |
| `GET` | `/api/dashboard` | Rep, Manager, Admin | Executive KPIs, funnel stats, location breakdown |
| `GET` | `/api/users` | Admin, Manager | List organization users |
| `POST` | `/api/users` | Admin | Create or invite new user |

---

## 5. Local Development Setup

### Prerequisites
- Node.js 18+ (tested on Node v20/v22)
- npm 9+
- Optional: PostgreSQL database instance

### 1. Installation
```bash
git clone https://github.com/aveenashkumar68/growprospect.git
cd multi-source-lead-discovery-docs
npm install
```

### 2. Environment Variables
Create `.env` in the project root:
```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Optional PostgreSQL Connection (falls back to resilient in-memory storage)
DATABASE_URL=postgresql://user:password@localhost:5432/growprospect_db

# Clerk Authentication & Multi-Tenancy
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
# Optional PEM public key for local token verification:
CLERK_JWT_KEY=
```

Create `apps/web/.env`:
```env
VITE_API_URL=http://localhost:3001
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
```

### 3. Launch Development Servers
```bash
# Starts both frontend (port 5173) and backend API (port 3001) concurrently
npm run dev

# Or start individually:
npm run dev:api
npm run dev:web
```

### 4. Run Test Suite
```bash
npm test
```
Executes the comprehensive multi-tenant isolation, role permission checks, import deduplication, pipeline kanban, and API server integration tests (142 tests).
