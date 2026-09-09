# AI Recruitment Platform — Frontend

> Cyberpunk / Valorant HUD-style React SPA for the AI Recruitment & Candidate Matching Platform.

## 1. Quick Start

### Prerequisites
- **Node.js >= 18** (uses Vite 5 + React 18 + TypeScript strict)
- **Backend running**: FastAPI on `http://127.0.0.1:8000`

### Install & Run

```bash
# 1) Install deps
cd frontend
npm install

# 2) Start the FastAPI backend in a separate terminal
cd ../backend
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000

# 3) Start the frontend dev server
cd frontend
npm run dev
# → open  http://localhost:5173
```

Backend is auto-proxied: `http://localhost:5173/api/*` → `http://127.0.0.1:8000/*`

### Production build
```bash
npm run build      # Type-check then vite build → dist/
npm run preview    # Serve dist/ locally
```

## 2. Tech Stack
| Layer | Tools |
|---|---|
| Framework | Vite 5 + React 18 + TypeScript strict |
| Styling | Tailwind CSS v4 + custom HUD tokens (glassmorphism, neon, corners, scanlines) |
| Router | react-router-dom v6 |
| Charts | Recharts (RadialBar gauge, Bar score breakdowns) |
| Uploads | react-dropzone (drag-and-drop) |
| Toasts | Sonner (re-skinned as HUD alerts) |
| Markdown | react-markdown (Architecture page diagram) |

## 3. Routes

| Route | Page |
|---|---|
| `/` | Dashboard (stats, quick actions, backend status) |
| `/jobs` | Jobs list + New Job modal |
| `/jobs/:id` | Job detail + extracted requirements |
| `/jobs/:id/upload` | Resumes drag-and-drop upload |
| `/candidates` | Candidates list (filter by job) |
| `/candidates/:id` | Candidate structured profile detail |
| `/jobs/:id/ranking` | Ranking board with overall score rings |
| `/jobs/:id/match/:candidateId` | Match detail: gauge + breakdown + skill gap + AI explanation |
| `/architecture` | System info + architecture diagram + component legend |
| `/sandbox/errors` | Error handling demo surface (doc errors + API errors) |

## 4. Environment Variables (optional)
Copy `.env.example` → `.env` and tweak:

```ini
VITE_API_BASE_URL=/api          # default: proxied path
VITE_APP_NAME="AI Recruitment Platform"
```

## 5. Sample Data
To seed a full demo, use the files in `../samples/`:
- Job Description: `../samples/job_descriptions/senior_python_backend.txt`
- Resumes (4): `../samples/resumes/*.txt`

## 6. Scripts
| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server on 5173 |
| `npm run build` | TypeScript check + production build (`dist/`) |
| `npm run preview` | Serve production build locally |
| `npm run lint` | `tsc --noEmit` (strict mode) |

## 7. Backend Link
Backend API docs (Swagger UI): http://127.0.0.1:8000/docs

---

*Part of the **DSTARIX TECHNO** 3-Week Generative AI Final Project.*
