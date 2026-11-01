# Frontend Architecture — Hazard Rage

Rendering: **CSR SPA (Vite React)** — confirmed per user request + ADR-004. Authenticated app, no SEO need.

## Setup

`npx skills add emilkowalski/skill` → pulls motion/craft tokens. Combine with `apple-design` skill (fluid, interruptible, translucent).

## Taxonomy

```
pages/     Route composition only (CitizenHome, ReportNew, MyReports, AdminDashboard, ZoneDetail, ReportsManage, AlertsList, Login, Register)
features/  Business composites (reporting/ReportForm+Card, zones/ZoneHeatmap+Table+HazardBadge, alerts/AlertBanner+List, analytics/TrendChart+CausePanel+RemediationCard)
ui/        Stateless (Button, Input, Modal, Toast, Badge, Skeleton, EmptyState) — no service imports
layout/    AppShell, AdminShell, CitizenNav (translucent)
providers/ AuthProvider, QueryProvider, ToastProvider
services/  apiClient, authService, reportService, zoneService (only place with fetch)
hooks/     useZones, useHazard, useReports
router/    routes + RequireAuth + RequireRole(admin)
styles/    tokens.css + materials + motion
```

Rules: `pages → features → ui`; `features → services → apiClient`. No fetch in components.

## Routes

| Path | Page | Auth | Data |
|------|------|------|------|
| /login, /register | Auth | public | none |
| / | CitizenHome | citizen | zones+scores |
| /report/new | ReportNew | citizen | zones list |
| /my-reports | MyReports | citizen | ?mine |
| /admin | AdminDashboard | admin | KPIs+heatmap+alerts |
| /admin/zones/:id | ZoneDetail | admin | zone bundle |
| /admin/reports | ReportsManage | admin | paginated |
| /admin/alerts | AlertsList | admin | alerts |

## State

Server: TanStack Query (60s stale, retry 1, 10s abort) — TTL mirrors Redis `hz:v1:*` 60s + `Cache-Control` headers. Global: AuthContext+ToastContext+Theme. Local: useState. URL: `?zone_id&status&page` shareable. Forms: Hook Form + zod.

## apiClient Contract

```ts
apiClient.get/post/patch(path:string, body?:unknown): Promise<{success:true,data:any}>
// attaches Bearer from memory, requestId header, 401 → logout redirect, timeout 10s, retry GET 1x
```

## Design System (emil + apple — mandatory)

Tokens:
```css
--ease-out: cubic-bezier(.23,1,.32,1);
--ease-drawer: cubic-bezier(.32,.72,0,1);
/* press 100-160ms, popover 125-200ms, modal/drawer 200-400ms, UI never >300ms except sheets */
/* springs: default bounce 0 duration .35; flick/dismiss bounce .2 */
```

- Buttons: `:active scale(.97)`, pointer-down highlight instant, no `transition:all`, no `scale(0)` entry (use `scale(.95)+opacity`).
- Origin-aware: popovers scale from trigger (`--transform-origin`); modals center. Enter/exit same path.
- Materials: `rgba(255,255,255,.6)+backdrop-filter:blur(20px) saturate(180%)`, content scrolls under; heavier blur+shadow on sheets; never light-on-light stack; dark-mode adapt.
- Type: system-ui first; display `clamp(2rem,5vw,4rem) lh 1.05 ls -.02em`; body `lh 1.5 ls 0`; rem spacing.
- Map/drawer: 1:1 drag (pointer capture + grab offset), velocity handoff, momentum projection `current + (v/1000)*d/(1-d), d=.998`, rubber-band at bounds.
- Hazard: Low green / Med amber / High red + label + icon (never color alone). Heatmap green→yellow→red.
- Patterns: Skeleton (not spinner wall), EmptyState, ErrorBoundary per route, Toast same-direction enter/exit, tooltips instant after first, `prefers-reduced-motion: fade only`, `prefers-reduced-transparency: solid`.
