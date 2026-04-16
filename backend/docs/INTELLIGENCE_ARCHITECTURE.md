# Intelligence Architecture

## Goal
Add a scalable analytics layer without changing existing auth/request workflows.

## Current Runtime
- API framework: Express
- Business logic: service layer modules
- Persistence: in-memory mock store (development mode)
- Intelligence endpoints: `src/routes/intelligence.routes.js`

## Clean Architecture Pattern
- `routes/*`: transport concerns only.
- `controllers/*`: request/response orchestration.
- `services/*`: deterministic intelligence logic.
- `data/*`: storage adapters (in-memory now; PostgreSQL next).
- `docs/postgresql-analytics-schema.sql`: production relational model.

## Service Boundaries
- `analytics.service.js`: classic KPIs.
- `intelligence.service.js`: predictive diagnostics:
  - Workflow friction and health score
  - Decision patterns and bias indicators
  - Risk scoring
  - Simulation
  - Smart escalation suggestions
  - Fairness index
  - Process DNA report model

## Recommended Production Migration
1. Replace `data/mockStore` with repository adapters over PostgreSQL.
2. Materialize daily rollups in `intelligence_daily_rollups`.
3. Precompute `request_risk_scores` using scheduled jobs.
4. Keep API contracts stable; swap data layer only.
5. Add Redis caching for dashboard snapshots.

## Performance Notes
- Use composite indexes on status+department+time for dashboard filters.
- Aggregate event timelines from `request_events` instead of heavy joins on live request tables.
- Build `department x day` rollups for heatmaps and traffic trends.
