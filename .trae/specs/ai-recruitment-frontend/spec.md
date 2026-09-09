# AI Recruitment Platform Frontend - Product Requirements Document

## Overview
- **Summary**: A full-featured React + TypeScript + Vite frontend website for the AI Recruitment & Candidate Matching Platform, featuring a premium Cyberpunk 2077 / Valorant-style gaming aesthetic with neon glows, glassmorphism panels, and HUD-style UI elements. The app enables a complete end-to-end recruitment workflow: JD creation → resume upload → structured extraction → semantic matching → weighted scoring → candidate ranking → skill gap analysis → AI-generated explanations.
- **Purpose**: Provide a world-class, visually impressive, fully functional user interface that showcases the backend AI capabilities and enables a recruiter to complete the entire workflow without touching the API directly. Serves as the primary demo surface for the final project presentation.
- **Target Users**: Recruiters, HR professionals, hiring managers, and the project evaluators during the final demo.

## Goals
- Build a complete SPA that consumes every existing FastAPI endpoint and exposes the full feature set of the platform.
- Deliver a premium, polished visual identity: Cyberpunk / Valorant HUD aesthetic (neon accents, glassmorphism cards, scan lines, corner brackets, grid patterns, gradient text, subtle animations).
- Ensure the full 10-step final-demo workflow works end-to-end through the UI: Create JD → Upload Resumes → Extract Candidate Info → Match → Scores → Ranking → Skill Gaps → AI Explanations → Error Handling Demo → Architecture Explanation Page.
- Use clear, standard terminology (Upload, Match, Score, Rank, Explanation) for critical actions even within the themed UI.
- Handle loading, empty, and error states gracefully for every screen and interaction.
- Persist the UI theme (light/dark toggle defaults to dark neon) and remember the last opened job id.

## Non-Goals
- User authentication / authorization / multi-tenancy. The recruiter is assumed to be already logged in; no Login page.
- Native mobile app / responsive breakpoint tuning beyond tablet. The demo happens on a desktop browser. (Basic responsiveness is still nice to have.)
- Server-side rendering, Next.js, or backend-for-frontend. Pure SPA + direct FastAPI calls.
- Payment, SSO, emails, notifications, exporting to PDF/Excel, CSV import, ATS integrations.
- Editing extracted candidate data manually in the UI; display-only with a "Re-extract" button.

## Background & Context
- The FastAPI backend is complete at `backend/`: 31/31 pytest pass, verified endpoints are `POST /jobs`, `GET /jobs`, `GET /jobs/{id}`, `POST /jobs/{id}/re-extract`, `POST /resumes` (multi-file, form-data), `GET /candidates` (?job_id), `GET /candidates/{id}`, `POST /match`, `GET /ranking/{job_id}`, `GET /health`, `GET /info`.
- Scoring weights: Required Skills 40%, Relevant Experience 25%, Projects 20%, Education/Cert 10%, Additional Skills 5%. Hard requirement from the spec.
- Semantic matching uses embeddings with 3-tier fallback: sentence-transformers (local) → OpenAI embeddings → TF-IDF char n-grams.
- LLM uses OpenAI API with a full rule-based fallback. The UI must render correctly when `llm_available: false`.
- User profile explicitly states UI preference: "Premium gaming aesthetics (Cyberpunk 2077, Valorant style) with neon glows, glassmorphism, and HUD-style interfaces. Favors standard, clear terminology for critical actions."
- Sample JDs and resumes exist in `samples/` for seeding the demo.

## Functional Requirements

### Workflow & Pages
- **FR-1 Dashboard / Landing Page**: Welcome HUD with stats (total jobs, total candidates, avg match rate, active job). Quick-actions card for the 4-step demo flow.
- **FR-2 Jobs List**: Card grid of all created jobs with JD title, description preview, extracted skills pills, candidate count, creation date. Search + sort controls.
- **FR-3 Create / View Job**: Form to paste/type JD title + description, submit. On success, show extracted requirements (required skills, nice-to-have, min years, education) in a HUD panel. "Re-extract Requirements" button.
- **FR-4 Resumes Upload**: Drag-and-drop zone + file picker for multi-file upload (.pdf/.docx/.txt), associated to a selected job. Per-file progress, per-file error display on invalid/empty/unsupported files. Summary of successful uploads with candidate name + extracted skills preview.
- **FR-5 Candidates List**: Filterable table / card grid per job showing candidate name, email, top skills, exp years, match score if matched; click to view profile.
- **FR-6 Candidate Profile Detail**: Structured display of the full profile (name, email, phone, skills grid, experience summary, education cards, project cards, certifications chips, additional skills). Skill tags rendered as neon HUD badges.
- **FR-7 Match / Run Scoring**: "Run Matching" button per job that calls `POST /match` with a loading HUD (progress spinner, processing indicator for each candidate). On completion, auto-navigate to ranking.
- **FR-8 Ranking Board**: Full ranked table with ordinal ranks, candidate name, overall match score (0-100) with a neon progress ring, per-category mini bars, rank trend badges. Sortable. Click a row to open the Match Detail modal/page.
- **FR-9 Match Detail (Score Breakdown + Skill Gap + AI Explanation)**:
  - Overall score hero with a circular neon gauge
  - Per-category score bars (Required Skills 40% weight, Experience 25%, etc.) with values 0–100
  - Skill Gap panel: two columns — Matching Skills (green neon badges) vs Missing / Weak Skills (red neon badges)
  - AI Explanation card: paragraph text plus Strengths list and Weaknesses list, each with HUD-style bullet markers
- **FR-10 Error Handling Demo**: Explicit page / debug panel to test error paths (upload empty file, upload .exe, try ranking before match, 404 job id) and show the backend error messages in styled toasts.
- **FR-11 System Info / Architecture Page**: Render GET /info output (embedding backend, llm available, model, scoring weights, allowed extensions, upload limit) plus the architecture diagram rendered inline from `architecture_diagram.md` as a Mermaid diagram when possible, otherwise as formatted markdown.
- **FR-12 Navigation**: Top navbar with app logo (neon brand), main nav (Dashboard, Jobs, Candidates, Matching, Architecture), current job pill, and theme toggle. Sidebar optional.

### UI/UX Language
- **FR-13 Clear critical-action labels**: Every destructive / primary button uses standard English labels — "Create Job", "Upload Resumes", "Run Matching", "View Ranking", "Re-extract Requirements", "Delete Job" — regardless of visual theme.
- **FR-14 Loading states**: Every async interaction shows skeleton glassmorphism cards with animated neon shimmer; blocking operations show a HUD-style overlay with progress copy.
- **FR-15 Toast notifications**: Success / warning / error toasts styled like HUD status messages, auto-dismiss or dismissable. At minimum: upload summary, match complete, job created, errors surfaced.
- **FR-16 Empty states**: Each list page shows a themed empty-state illustration + "No jobs yet — create your first Job Description" style call-to-action.

## Non-Functional Requirements
- **NFR-1 Performance**: First contentful paint < 2s on a cold dev build; page transitions feel instant (skeletons > spinners). Match result page renders within 500ms of receiving the response.
- **NFR-2 Code Quality**: React 18 with TypeScript strict mode; no `any` leaks outside explicit `explicit-any` suppressions with comment. Components organized by feature/route, reusable UI components separated to `components/ui/`.
- **NFR-3 Build Reliability**: `npm run build` completes with 0 TypeScript errors and 0 Vite warnings.
- **NFR-4 API Robustness**: All API calls go through a typed service layer (`lib/api.ts`) with request timeouts, non-2xx error handling, and a global error boundary that catches render errors and shows a styled recovery panel.
- **NFR-5 Bundle Size Reasonable**: No more than ~400KB gzipped for the main chunk; dynamic imports for the Mermaid/Architecture page and heavy chart components.
- **NFR-6 Aesthetic Fidelity**: The overall UI must read unmistakably as "premium gaming HUD / neon cyberpunk" rather than generic SaaS. Required visual patterns:
  - Glassmorphism cards (`backdrop-filter: blur`, translucent bg with subtle border glow)
  - Neon accent colors: cyan `#00f0ff`, magenta `#ff00aa`, violet `#8a2be2`, amber `#ffb000`, danger red `#ff3860`, success green `#00ffa3`
  - HUD corner brackets on major cards
  - Grid / scanline overlays on hero sections (very subtle, opacity ~4%)
  - Gradient neon text on headings
  - Animated borders and subtle pulse effects on interactive buttons
- **NFR-7 Accessibility Baseline**: Buttons and form controls have `aria-label`s where needed; contrast of text meets WCAG AA despite the neon theme (use bright text on dark, avoid pure neon yellow on pure white, etc.)
- **NFR-8 Developer Experience**: Clear `README` in frontend folder with install + run steps; `npm run dev` starts Vite on port 5173 and proxies `/api/*` to FastAPI on `http://127.0.0.1:8000`.

## Constraints
- **Technical**:
  - Single-page application using Vite + React 18 + TypeScript. No other frameworks permitted without user approval.
  - Styling: Tailwind CSS v3 (recommended) for utilities + CSS modules or plain CSS for complex keyframes / HUD corner effects.
  - Charts: `recharts` for score breakdowns and category bars (small, fast). Avoid D3 directly.
  - HTTP client: built-in `fetch` is fine; alternatively `axios` for interceptors.
  - State management: React Context + hooks for simple global (current job, theme, toast queue). Zustand is acceptable but optional; keep it light.
- **Business**:
  - The existing backend API contract at `backend/app/routers/*.py` cannot be changed. (Bug fixes are fine, but the frontend must work with the current server as-is.)
  - Scoring weights are *displayed* in the UI exactly as 40/25/20/10/5; the UI does not recompute scores, it only renders values returned by the server.
- **Dependencies**:
  - Node.js >= 18 must be available.
  - Backend must be running on `http://127.0.0.1:8000` for full functionality; but the frontend should not crash when the backend is down (show "Backend unreachable" HUD banner + retry on Dashboard).

## Assumptions
- The demo presenter runs both `uvicorn app.main:app` (backend port 8000) and `npm run dev` (frontend port 5173) on the same machine during the presentation.
- The evaluator views the site on a desktop/laptop, minimum 1280px width.
- CORS is already open on FastAPI (`allow_origins=["*"]`), which is confirmed in `backend/app/main.py`.
- Mermaid rendering can be achieved via `react-markdown` + `mermaid` / `@mermaid-js/mermaid-react`; if that proves heavy, fall back to a static inline SVG of the diagram.
- User prefers no-auth flow: "standard, clear terminology" for critical actions was explicitly stated, and no login/auth is listed in the functional requirements for backend endpoints.

## Open Questions
- None at this time. All scope decisions above are best-effort aligned with stated preferences; defer any remaining subjective choices to presentation-time polish (e.g., exact neon hue saturation, specific HUD corner bracket shape).

---

## Acceptance Criteria

### AC-1: Full end-to-end demo flow works in one browser session
- **Type**: `rule`
- **Given**: Backend running on 8000 and frontend on 5173, fresh DB
- **When**: The user (1) opens Dashboard → (2) creates a Senior Python Backend Engineer job using the sample JD → (3) uploads the 4 sample resumes from `samples/resumes/` → (4) clicks Run Matching → (5) opens Ranking → (6) clicks into the #1 ranked candidate → (7) views Overall Score, per-category bars, Matching/Missing skills, and AI explanation
- **Then**: Every step completes without a fatal error or white-screen; final ranking page shows 4 ranked candidates with distinct overall scores; #1 candidate is Aarav Sharma (or whoever scores highest on the live backend) with score >= 80
- **Pass Condition**: Scripted walkthrough (via Playwright or manual recording) produces the expected UI state at each step
- **Evidence**: Screenshots / recording of all 7 steps stored in `frontend/.evidence/` OR a passing end-to-end smoke test

### AC-2: All 6 required API endpoints are called correctly for their screens
- **Type**: `rule`
- **Given**: Running frontend with Network DevTools open
- **When**: Navigating to Jobs List, opening a Job detail, uploading 2 resumes, running Match, opening Ranking, opening Candidate Profile
- **Then**: The correct corresponding FastAPI endpoints are observed to return 2xx with properly parsed data rendered into components (no raw JSON dumped onto the page)
- **Pass Condition**: A checklist table mapping screen → endpoint → observed 2xx status is verifiable from a recorded HAR/log snippet
- **Evidence**: HAR capture or the app's own typed service-layer assertions

### AC-3: Upload error handling surfaces 4 distinct error states
- **Type**: `rule`
- **Given**: The Resumes upload page
- **When**: User attempts to upload (a) an empty .txt, (b) an .exe file, (c) a 30MB random file, (d) 4 valid files, in any order
- **Then**: Four distinct HUD-style error/success messages appear, each with meaningful human-readable copy — "File is empty", "Unsupported format .exe", "File too large (>15MB)", the success summary toast
- **Pass Condition**: All four error conditions tested in one session produce the styled toast / inline-error UI without crashing the upload queue
- **Evidence**: Screenshot of all four message types visible (or adjacent screenshots taken in the same session)

### AC-4: Score breakdown correctly reflects the weighted 40/25/20/10/5 categories
- **Type**: `rule`
- **Given**: A job with completed match results, viewing the Match Detail screen for any candidate
- **When**: Visually inspecting the "Score Breakdown" panel
- **Then**: Five category rows are visible with exactly the labels (Required Skills, Relevant Experience, Projects, Education/Certifications, Additional Skills) and the weight percentages shown next to each; the visual progress-bar values match the raw numeric values returned by the API
- **Pass Condition**: DOM values for the 5 categories exactly equal the 5 API numbers, and the 5 weight labels exactly equal 40%, 25%, 20%, 10%, 5%
- **Evidence**: DOM snapshot / screenshot with the numbers visible and a command diff vs the API response JSON

### AC-5: Ranking table assigns ranks 1..N by overall score desc
- **Type**: `rule`
- **Given**: A job with N candidates and matching already executed
- **When**: Viewing the Ranking page
- **Then**: Rows are ordered from highest overall_score to lowest; the leftmost rank column shows 1, 2, 3, ... N with no duplicates and no gaps
- **Pass Condition**: For a job with 4 candidates, ranks 1-4 are displayed and consistent with API scores
- **Evidence**: Side-by-side table screenshot + `GET /ranking/{job_id}` raw JSON

### AC-6: Skill gap panel shows matching vs missing skills
- **Type**: `rule`
- **Given**: A candidate detail / match-detail screen
- **When**: Scrolling to "Skill Gap"
- **Then**: Two visibly distinct sections exist: Matching Skills (green/cyan neon badges) and Missing / Weak Skills (red/magenta neon badges). Both lists are populated from `matching_skills` and `missing_skills` arrays returned by the API.
- **Pass Condition**: For a candidate with at least 1 skill in each array, both lists have >= 1 entry and the badge colors are visually distinct on a real render
- **Evidence**: Screenshot with both sections side-by-side

### AC-7: AI explanation renders paragraph + strengths + weaknesses
- **Type**: `rule`
- **Given**: Match-detail screen for one candidate, backend in either LLM or fallback mode
- **When**: Scrolling to AI Explanation card
- **Then**: (a) A single paragraph explanation exists, >= 80 characters, non-empty. (b) A "Strengths" list with 1–6 bullet items. (c) A "Weaknesses" list with 0–6 bullet items. All text wrapped in a glassmorphism card with HUD corner treatment.
- **Pass Condition**: All three sub-items (a)(b)(c) are non-empty in at least one candidate's page on a fresh run against the rule-based fallback backend
- **Evidence**: Screenshot of the AI Explanation card

### AC-8: No TypeScript errors on production build
- **Type**: `rule`
- **Given**: Clean `frontend/` install
- **When**: Running `npm run build`
- **Then**: Process exits with code 0, no TS errors printed, no Vite warnings
- **Pass Condition**: `npm run build 2>&1` tail output shows build success with chunk sizes
- **Evidence**: Terminal capture of a successful build

### AC-9: Backend-offline graceful state
- **Type**: `rule`
- **Given**: FastAPI is intentionally stopped, frontend dev server is still open
- **When**: Refreshing Dashboard
- **Then**: A clearly visible HUD banner reads "Backend Offline — ensure uvicorn is running on http://127.0.0.1:8000" with a Retry button. The rest of the shell (nav, logo, footer) still renders; no white screen.
- **Pass Condition**: Manual reproduction shows banner and no console uncaught exception with status code "ERR_CONNECTION_REFUSED"
- **Evidence**: Screenshot of the banner on Dashboard

### AC-10: Neon cyberpunk HUD aesthetic across 4 key surfaces
- **Type**: `rubric`
- **Dimension**: Visual aesthetic fidelity to the stated "Cyberpunk 2077 / Valorant HUD" preference
- **Scale**: 1-5
- **Anchors**:
  - `1` = Generic Material / Bootstrap look, no neon, no glassmorphism
  - `3` = Neon accent color on buttons, some translucent cards, but no corner brackets / scanlines / gradient text / HUD details
  - `5` = Consistent HUD identity on Dashboard, Job cards, Candidate cards, Match Detail hero: glassmorphism panels with backdrop-blur + thin border glow, HUD corner brackets on major cards, neon gradient heading text, scanline/grid bg on hero regions, animated pulsing CTAs, badge skills rendered as neon chips with subtle outer glow
- **Pass Threshold**: >= 4
- **Evidence**: Full-page screenshot of Dashboard, Job Detail, Ranking board, Match Detail hero placed side-by-side

### AC-11: Developer experience & runnability
- **Type**: `rubric`
- **Dimension**: Ease of running the frontend on a fresh machine by the project evaluator
- **Scale**: 1-5
- **Anchors**:
  - `1` = No README, missing package.json scripts, hardcoded URLs, crashes on first run
  - `3` = Has a README with setup steps; requires manual proxy or env tweaks beyond copying `.env.example`
  - `5` = `frontend/README.md` lists (1) `npm install`, (2) ensure backend on 8000, (3) `npm run dev`. Vite proxy configured out-of-the-box via `vite.config.ts`. `.env.example` provided. `npm run dev` opens directly on 5173 with a clickable link to the FastAPI /docs in the footer.
- **Pass Threshold**: >= 4
- **Evidence**: README contents and a clean `npm install && npm run build && npm run dev -- --host` session capture
