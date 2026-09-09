# AI Recruitment Platform Frontend - Implementation Plan

## Task 1: Scaffold Vite + React 18 + TypeScript project, Tailwind, base config
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Initialize `frontend/` at repo root using `npm create vite@latest . -- --template react-ts`
  - Install Tailwind v3 + `@tailwindcss/vite` plugin (or legacy tailwindcss + postcss + autoprefixer — whichever is stable), configure content globs for `src/**/*.{ts,tsx}`, enable dark mode `class`
  - Configure `vite.config.ts` with `/api` proxy to `http://127.0.0.1:8000` and remove `/api` prefix before proxying (so frontend calls `fetch('/api/jobs')` → backend receives `/jobs`)
  - Add `tsconfig.json` strict true + baseUrl/paths for `@/` alias to `./src` if simple; otherwise no alias needed
  - Add `.env.example` (VITE_API_BASE_URL, VITE_APP_NAME) and README stub
  - Install core runtime deps: `react-router-dom`, `clsx`, `tailwind-merge` (cn utility), `recharts`, `sonner` or `react-hot-toast` for HUD toasts
  - Remove default Vite boilerplate (App.css, default logo, demo counter)
- **Acceptance Criteria Addressed**: AC-8, AC-11
- **Test Requirements**:
  - `rule` TR-1.1: In `frontend/`, `npm install && npm run build` exits 0 with no TS errors. Evidence: captured terminal output.
  - `rubric` TR-1.2: Config scaffold quality; scale 1-5; anchors 1=broken / 3=works but no proxy / 5=proxy+alias+tailwind all wired cleanly; threshold >= 4; Evidence = `vite.config.ts`, `tailwind.config.ts`, `package.json` scripts review.
- **Notes**: Keep this task scoped to scaffolding only; no UI features yet.

## Task 2: Global theme / CSS tokens + HUD primitives (neon, glass, corners, scanlines)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - In `src/index.css` or equivalent, define the cyberpunk neon palette as CSS variables: `--c-cyan:#00f0ff`, `--c-magenta:#ff00aa`, `--c-violet:#8a2be2`, `--c-amber:#ffb000`, `--c-green:#00ffa3`, `--c-red:#ff3860`, `--c-bg-deep:#05060d`, `--c-bg-panel:rgba(10,12,26,0.65)`, `--c-border-neon:rgba(0,240,255,0.35)`
  - Build Tailwind utilities: `.glass-panel` (backdrop-blur-md, bg-bg-panel, 1px border, rounded-xl), `.neon-text-cyan` (text-gradient: cyan→violet), `.corner-brackets` (::before/::after L-shapes with absolute corner positions), `.scanlines` (repeating-linear-gradient very low opacity), `.hud-chip` (skill badge with outer-box-shadow glow), `.neon-btn-primary` (cyan border glow + pulse keyframe on hover), `.grid-bg` (hero grid bg)
  - Create `src/components/ui/HudCard.tsx` — a reusable panel with optional corner brackets, animated neon border on highlight, title bar with small HUD label text
  - Create `src/components/ui/NeonButton.tsx` — standard button with variant `primary | secondary | danger | ghost` + standard labels
  - Create `src/components/ui/HudBadge.tsx` — skill/tag chip with tone variants `match` (green/cyan glow) and `missing` (red/magenta glow) and `neutral`
  - Create `src/components/ui/ScanOverlay.tsx` and `src/components/ui/CornerBrackets.tsx` as pure presentational wrappers
- **Acceptance Criteria Addressed**: AC-10, NFR-6, NFR-7
- **Test Requirements**:
  - `rule` TR-2.1: Each of `HudCard`, `NeonButton`, `HudBadge` exports a TypeScript component with no type errors. Evidence = `npx tsc --noEmit` output in frontend.
  - `rubric` TR-2.2: Theme fidelity; scale 1-5 per AC-10 anchors; threshold >= 4; Evidence = screenshot of a showcase page with 2 HudCards + 6 HudBadges + 2 NeonButtons rendered side by side.

## Task 3: Typed API client layer, types, global providers (theme, toast, router)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1, Task 2
- **Description**:
  - Mirror backend Pydantic schemas in `src/lib/api/types.ts`: `JobCreate`, `JobResponse`, `JobListResponse`, `CandidateProfile`, `CandidateResponse`, `CandidateUploadResponse`, `MatchRequest`, `MatchResultResponse`, `RankingResponse`, `ErrorResponse`, `HealthResponse`, `InfoResponse`. All typed strictly (no `any`).
  - Create `src/lib/api/client.ts`: typed functions `createJob(payload): Promise<JobResponse>`, `listJobs(params): Promise<JobListResponse>`, `getJob(id)`, `reExtractJob(id)`, `uploadResumes(jobId, File[]): Promise<CandidateUploadResponse>`, `listCandidates(params)`, `getCandidate(id)`, `runMatch(payload)`, `getRanking(jobId): Promise<RankingResponse>`, `getHealth()`, `getInfo()`.
  - Wrap every fetch in a small helper that throws a structured `ApiError { message, code, status }` on non-2xx and auto-parses JSON. Timeout 60s (matching can be slow).
  - Create `src/App.tsx` with `BrowserRouter` (hashRouter optional), routes: `/`, `/jobs`, `/jobs/:id`, `/jobs/:id/upload`, `/candidates`, `/candidates/:id`, `/jobs/:id/ranking`, `/jobs/:id/match/:candidateId`, `/architecture`, `/sandbox/errors`
  - Add `src/components/layout/AppShell.tsx` (top navbar with brand, nav links, current-job pill, theme toggle; footer with backend URL link to /docs; sidebar optional)
  - Add global providers: `ThemeProvider` (dark default, neon variant; stores in localStorage), `Toaster` (sonner/toast styles re-skinned as HUD alerts), `ErrorBoundary` (catches render errors, shows HUD recovery card)
- **Acceptance Criteria Addressed**: AC-2, AC-8, NFR-2, NFR-4
- **Test Requirements**:
  - `rule` TR-3.1: Every backend route from the routers (health/info/jobs/resumes/matching) maps to exactly one client function with matching HTTP verb and URL path (proxy `/api/*` → backend `/*`). Evidence = side-by-side table in `tasks.md` completion evidence + code locations that show the mapping.
  - `rule` TR-3.2: A failing fetch (backend not running) produces a thrown `ApiError` with a numeric status field rather than an unhandled promise rejection. Evidence = small inline node test or browser console capture showing error shape.

## Task 4: Dashboard page (stats HUD, quick actions, last job, backend status banner)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 3
- **Description**:
  - Route: `/` component `src/pages/Dashboard.tsx`
  - Hero section: large brand headline with neon gradient text, scanline overlay, grid background, subtitle describing the platform
  - 4 stats cards (HudCard with corner brackets): `Total Jobs`, `Total Candidates`, `Avg Match Score %`, `Active Job` — populated via `GET /jobs`, `GET /candidates`, and cached ranking if available
  - Quick actions HudCard with 4 large NeonButtons: `Create Job`, `Upload Resumes`, `Run Matching`, `View Ranking` — each links to the corresponding page. If no active job is set, Upload/Match/Ranking buttons are disabled with tooltip "Select or create a job first".
  - Backend status banner: calls `GET /health` and `GET /info` on mount. If OK, shows a small green HUD badge `Backend Online · embedding: tfidf-fallback · LLM: on/off`. If offline, shows prominent red banner with "Backend Offline — ensure uvicorn running on 127.0.0.1:8000" + Retry button per AC-9.
  - Recent jobs mini-list in a 3-column card grid (latest 3 jobs)
- **Acceptance Criteria Addressed**: AC-1 (step 1 landing), AC-9, AC-10, FR-1
- **Test Requirements**:
  - `rule` TR-4.1: When backend is offline, Dashboard renders the banner with exact copy `Backend Offline — ensure uvicorn running on http://127.0.0.1:8000` and a Retry `<button>` in DOM. Evidence = DOM snapshot.
  - `rubric` TR-4.2: Dashboard aesthetic; scale 1-5 (AC-10 anchors); threshold >= 4; Evidence = full-page screenshot of Dashboard.

## Task 5: Jobs pages — list, create form, view detail, re-extract
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - `src/pages/JobsList.tsx` (route `/jobs`): HudCard grid of jobs. Each job card shows: title (gradient neon text), short description preview truncated to 140 chars, extracted skill HudBadges (first 8 chips, "+N more"), candidate count pill, created_at. Buttons: `View Details` → opens `/jobs/:id`. Empty state: "No jobs yet — [Create your first Job Description]" CTA primary button. Search input + sort select (newest first / candidate count).
  - `src/pages/JobDetail.tsx` (route `/jobs/:id`): Top hero HudCard shows title + description + "Re-extract Requirements" button. Below: Extracted Requirements panel with clearly-labeled sections: Required Skills (HudBadges match-tone), Nice-to-have (neutral), Min Experience Years (HUD pill), Required Education (HUD pill). If not extracted yet, show a callout "Requirements not yet extracted — click Re-extract Requirements". Right sidebar sticky panel: stats (candidates count), quick links (Upload Resumes, Run Matching, View Ranking).
  - Create-job flow: `/jobs` page has floating primary button "+ New Job" that opens a Modal or routes to a simple `/jobs/new` page. Form has 2 fields: `title` (text, min 2 chars) + `description` (textarea, min 20 chars, tall). Labels clear. Submit: `Create Job` standard button; on success toast "Job created successfully" + navigate to Job Detail. Loading: button spinner. Validation errors shown inline beneath fields.
- **Acceptance Criteria Addressed**: AC-1 (step 2), AC-2, FR-2, FR-3, AC-10
- **Test Requirements**:
  - `rule` TR-5.1: Filling the create form with the sample Senior Python Backend JD and submitting creates a `POST /api/jobs` request and on 201 navigates to `/jobs/:id` page where the `required_skills` array is rendered as >= 3 HudBadge chips. Evidence = Network tab screenshot + DOM snapshot of job detail.
  - `rubric` TR-5.2: Jobs UI polish. Scale 1-5 per AC-10; threshold >= 4; Evidence = screenshot of JobsList (3+ cards) and JobDetail.

## Task 6: Resumes upload page — drag & drop, per-file progress, errors, summary
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 5 (requires an existing job)
- **Description**:
  - Route: `/jobs/:id/upload` component `src/pages/UploadResumes.tsx`. Header: job title breadcrumb + "Upload Resumes for: {job}".
  - Large drag-and-drop zone (`react-dropzone` is a lightweight, standard option — accept `.pdf,.docx,.txt`, reject others). Zone visual states: idle (dashed neon border), hover (solid bright neon fill, pulse), rejected (danger red shake).
  - Alternative file picker button "Browse Files" using native `<input multiple type=file accept=".pdf,.docx,.txt">`.
  - File queue list below dropzone: each row shows file name icon, size KB/MB, progress bar neon (0→100%), status icon (idle/uploading/success/error). Per-row error copy for invalid cases.
  - Upload trigger: "Upload to Job" standard button, disabled when queue empty or job not ready.
  - Aggregate API call: construct FormData with `job_id` form-field + multiple `files` entries and call `POST /api/resumes`.
  - Error handling per AC-3: for empty file, unsupported extension, too-large, and mixed batch, show inline row errors + final summary HudCard with "N succeeded, M errors" and lists of per-file outcomes. Each error uses the backend's returned `message` copy verbatim.
  - Success CTA link: "Run Matching →" on the summary.
- **Acceptance Criteria Addressed**: AC-1 (step 3), AC-3, FR-4, FR-13
- **Test Requirements**:
  - `rule` TR-6.1: Uploading the 4 sample .txt resumes from `../samples/resumes/*.txt` (relative to project root, symlinked or copied into a frontend-accessible location via file picker) results in 4 `CandidateResponse` entries rendered in the success summary, each with non-empty `name` field. Evidence = screenshot of summary + Network POST /api/resumes 201 capture.
  - `rule` TR-6.2: One test run with 4 test cases: (a) empty .txt triggers "empty" error message, (b) a `.exe` triggers "unsupported format" error, (c) a >15MB dummy triggers "too large" error, (d) 2 valid files return success summary. All 4 must be observed without page crash. Evidence = screenshots per case.

## Task 7: Candidates list + Candidate Profile detail (structured info display)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 6
- **Description**:
  - `src/pages/CandidatesList.tsx` (route `/candidates`, accepts `?job_id=`): Filter HUD bar at top: "Filter by Job" select (All / Job names), search by name. View toggle: Grid (cards) / Table. Table columns: Rank (if matched), Name, Email, Skills (chips truncated), Exp (years), Score (if matched, neon bar percent). Each row click → `/candidates/:id`.
  - `src/pages/CandidateProfile.tsx` (route `/candidates/:id`): Full structured display.
    - Hero card: Name, email, phone, link back to source job, overall score ring (if matched available else "Not yet matched")
    - "Skills" HudCard: dense grid of HudBadges (all skills, no truncation).
    - "Experience" HudCard: years pill + experience_summary paragraph (formatted with line breaks).
    - "Education" HudCard: list of 1..N education entries as mini cards (degree, school, year).
    - "Projects" HudCard: grid of project cards with title + tech badges auto-extracted from description + description text.
    - "Certifications" HudCard: vertical list of cert chips with amber/neutral tone.
    - "Additional Skills" HudCard: more chips.
  - "Re-extract Profile" button if the recruiter wants to re-run LLM extraction.
- **Acceptance Criteria Addressed**: AC-1 (step 4 via structured view), AC-2, FR-5, FR-6
- **Test Requirements**:
  - `rule` TR-7.1: Viewing the profile of candidate "Aarav Sharma" uploaded from the sample resume shows Name="Aarav Sharma", non-empty Email + Phone, Skills >= 10 chips, Education list length >= 1, Projects list length >= 2, Certifications list length >= 1. Evidence = DOM snapshot / screenshot of the full profile.
  - `rubric` TR-7.2: Layout polish; scale 1-5 per AC-10 (glass + neon + corners on the major HudCards); threshold >= 4.

## Task 8: Matching execution UI + Ranking board page
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 5, Task 6
- **Description**:
  - Match trigger: "Run Matching" button accessible from Job Detail, Upload Summary CTA, and Dashboard. On click: opens a confirmation HUD modal that summarizes "Will match N candidates for job: {title}. This may take a few seconds."; confirm calls `POST /api/match` with `{job_id, rerun: true}`.
  - Matching progress overlay: full-screen translucent glass HUD overlay with animated neon circular spinner, status text "Analyzing candidates... Semantic matching... Generating AI explanations...", sub-progress bar per candidate if possible. Disabled dismiss until complete or error.
  - On match success: auto-navigate to `/jobs/:id/ranking` (Route `src/pages/RankingBoard.tsx`).
  - Ranking board layout: Hero headline "Ranking — {job.title}" with total candidates badge. Table rows: Rank (cyan ordinal with crown icon for #1), Candidate name & email, Overall Score (circular neon Recharts RadialBar with inner number), per-category 5 mini bars (Required Skills / Experience / Projects / Education / Additional — tiny bars), action buttons "View Details".
  - Sort controls (default: rank asc — i.e., highest first). Overall score RadialBar fills from 0→100 with a neon gradient.
  - Empty ranking state if match not yet run: CTA "Run Matching first to compute ranks".
- **Acceptance Criteria Addressed**: AC-1 (steps 5-6), AC-5, FR-7, FR-8, AC-10
- **Test Requirements**:
  - `rule` TR-8.1: After Run Matching for Senior Python JD + 4 candidate uploads, Ranking page shows 4 rows with rank column values 1, 2, 3, 4 in descending overall_score order; row 1 score > row 4 score. Evidence = screenshot of ranking board + JSON from GET /api/ranking/{job_id} side by side.

## Task 9: Match Detail page — score gauge, category breakdown, skill gap, AI explanation
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 8
- **Description**:
  - Route: `/jobs/:id/match/:candidateId` or reachable via modal on Ranking board. Component: `src/pages/MatchDetail.tsx`.
  - Layout (two columns on desktop):
    - Left column:
      - Overall Score hero card: large (~220px) Recharts custom RadialBar / SVG gauge that fills to `overall_score` percent, neon gradient (cyan→violet→magenta), inner label with score % and rank badge.
      - Per-category Score Breakdown HudCard: 5 rows — each row = Category label + (weight %) next to it, numeric score (0-100), progress bar with neon fill. Exact labels per AC-4: "Required Skills (40%)", "Relevant Experience (25%)", "Projects (20%)", "Education / Certifications (10%)", "Additional Skills (5%)".
    - Right column:
      - Skill Gap HudCard: split into two sub-panels side by side. Left: "Matching Skills" with heading + HudBadges (match-tone green/cyan); Right: "Missing / Weak Skills" heading + HudBadges (missing-tone red/magenta). If a list is empty show "- none -".
      - AI Explanation HudCard: HUD-styled "AI RECRUITMENT ANALYSIS" header bar (corner brackets + amber accent title). Inside: paragraph explanation text rendered in slightly larger line-height. Below: "Key Strengths" section with HUD bullet markers + short bullet array; "Key Weaknesses / Gaps" section with styled bullet array + small danger-icon accents.
  - Prev / Next candidate quick navigation at footer.
- **Acceptance Criteria Addressed**: AC-1 (steps 7-8), AC-4, AC-6, AC-7, FR-9
- **Test Requirements**:
  - `rule` TR-9.1: On Match Detail for top candidate, the five category progress bars display labels and weights exactly matching the hardcoded strings and percentages from AC-4, and the numeric values next to each bar exactly equal the 5 values returned by `/api/ranking` JSON for this candidate. Evidence = screenshot of bars + numbers + relevant JSON snippet side-by-side.
  - `rule` TR-9.2: Skill Gap section has both "Matching Skills" and "Missing / Weak Skills" sub-panels visible; for a good candidate the matching list has >= 3 entries. AI explanation paragraph is >= 80 characters and Strengths list >= 1 item. Evidence = screenshot of the entire right column.
  - `rubric` TR-9.3: Match Detail visual impact. Scale 1-5 per AC-10 (overall gauge + category bars are signature neon cyberpunk HUD); threshold >= 4. Evidence = full-page screenshot of Match Detail.

## Task 10: Error sandbox page + system info / architecture page
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 3
- **Description**:
  - `src/pages/ErrorSandbox.tsx` (route `/sandbox/errors`): Explicit page to demonstrate error handling (FR-10 / AC-3 / demo step 9). Sections:
    - Document Errors: Buttons that fire fake upload attempts using `Blob` constructs — "Upload Empty TXT", "Upload EXE (unsupported)", "Upload 20MB Large File", "Upload Valid Sample". Each triggers a real `/api/resumes` call with a crafted File Blob and renders the resulting errors inline.
    - API Errors: "GET missing candidate /candidates/99999", "GET ranking before match", "POST match with invalid job_id". Each shows the structured ErrorResponse toast with `code` + `detail`.
  - `src/pages/Architecture.tsx` (route `/architecture`):
    - Top Info HUD card: renders GET /api/info as structured key-value grid (App, Version, Embedding backend, LLM available, Model, Scoring Weights, Allowed extensions, Max upload MB).
    - Architecture diagram section: render `architecture_diagram.md` from the repo (load via fetch('/architecture_diagram.md') using Vite public folder or import raw? or hard-copy it into the page). Use `react-markdown` + if lightweight `@mermaid-js/mermaid-react` or a manual Mermaid script tag is feasible; else render as plain formatted markdown with a large diagram section.
    - Component Legend: small cards titled "Frontend", "Backend", "Document Processor", "LLM", "Embedding Model", "Matching Engine", "Database" with short descriptions matching the spec.
- **Acceptance Criteria Addressed**: AC-3, FR-10, FR-11
- **Test Requirements**:
  - `rule` TR-10.1: Clicking "GET ranking before match" produces a HUD toast with `code: no_match_results` (or whatever the backend ErrorResponse says) and does not white-screen the app. Evidence = screenshot of the toast + ErrorSandbox page.
  - `rule` TR-10.2: Architecture page renders at minimum: Info grid with non-empty "embedding_backend" field + readable architecture diagram copy (mermaid rendered or markdown). Evidence = full-page screenshot.

## Task 11: Global polish, pass build, verify full demo flow (smoke screenshots + README)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 1-10 (all)
- **Description**:
  - Polish pass: global loading skeletons (shimmer) for HudCard lists on every page that does async fetch. Fix any remaining React warnings. Remove `console.log` debug calls. Make sure toast placement is top-right (HUD style) and doesn't overlap nav.
  - 404 route: styled "HUD signal lost" 404 page with link back to Dashboard.
  - Ensure every page uses `document.title` update via a small `useDocumentTitle()` hook.
  - Final build: `npm run build` passes with 0 TS errors.
  - Frontend README: fill in all sections required for AC-11 anchors (install steps, backend dependency, Vite proxy note, scripts, screenshots placeholders with captions pointing to evidence).
  - Smoke screenshots: capture the 7 demo steps of AC-1 into files under `frontend/.evidence/` referenced in the README.
- **Acceptance Criteria Addressed**: AC-1, AC-8, AC-11
- **Test Requirements**:
  - `rule` TR-11.1: `npm run build` exits 0. Evidence = captured terminal output pasted into completion evidence.
  - `rule` TR-11.2: Frontend README.md contains explicit run steps: `npm install`, `cd ../backend && uvicorn app.main:app --reload --port 8000`, `npm run dev`, open `http://localhost:5173`. Evidence = README markdown content review.
  - `rubric` TR-11.3: Overall demo flow cohesion from screenshots; scale 1-5 where 1=inconsistent theme across pages / 3=works but disjoint / 5=consistent visual language, smooth transitions, professional presentation level; threshold >= 4.
