# GrowProspect Web Client

Modern React + Vite frontend for GrowProspect B2B Sales Team CRM & Lead Discovery Platform.

## Features
- **Dashboard (`DashboardView`)**: 6 core KPIs, pipeline stage distribution, top locations, and quick client creation.
- **Clients (`LeadsTable`)**: Filterable data table with 6 KPI cards, search, status filters, + Add Client modal, and embedded CSV/Excel import.
- **Interactive CSV Import (`CsvImportModal`)**: Upload $\rightarrow$ Auto-mapping $\rightarrow$ In-place cell editor $\rightarrow$ Deduplication & workspace sync.
- **Deals Pipeline (`PipelineView`)**: Drag-and-drop Kanban across 7 pipeline stages with top 4 summary KPI cards.
- **Tasks & Reminders (`TasksView`)**: Task execution queue with due-today filters, manager reassignment, and completion audio.
- **User Management (`UserManagementView`)**: Member roster and role assignments (`admin`, `manager`, `rep`).
- **Collapsible Sidebar (`Sidebar`)**: Icon-only compact mode (`w-20`) with tooltips and brand logo icon.
- **Audio Sound Engine (`soundService.js`)**: Web Audio API melodic chimes on actions, notifications, and task completions.

## Development
```bash
npm run dev:web
```
Runs Vite development server on `http://localhost:5173`.
