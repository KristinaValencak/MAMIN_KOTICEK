# Mamin kotiček

**Full-stack community platform** for mothers—forum, private messaging, marketplace listings, moderation workflows, and lightweight “mom break” games.  
*Slovenska spletna skupnost: forum, sporočila, tržnica, moderacija in vsebine za kratek oddih.*

**Stack:** React (Vite) · Express · PostgreSQL · REST API · Cloudinary · optional push (FCM).

---

## Status

**Final testing phase** before a wider production rollout. Core flows (auth, forum, messaging, marketplace, moderation) are implemented end-to-end; deployment runs on **Hetzner** with **PostgreSQL**, **Node.js API**, and **static frontend** behind **nginx** (see `ops/nginx/`).

---

## About the project

- Built as a complete full-stack application, not just a simple CRUD project  
- Includes multiple features: forum, private messaging, marketplace, and moderation system  
- Focus on security (JWT authentication, rate limiting, anti-spam protection)  
- Fully developed and deployed independently (frontend, backend, database, infrastructure)  

## Key features

| Area | What’s included |
|------|------------------|
| **Auth & account** | Registration, login/logout, email verification, password reset, account settings |
| **Forum** | Posts, categories, comments & replies, likes, favorites, featured content, search & filters |
| **Social** | Friend requests, blocks, private messaging (threads), notifications |
| **Marketplace** | Listings CRUD, reporting listings to moderators |
| **Moderation** | Content reports, hide/show decisions, **appeals**, role-based permissions |
| **Discovery** | Global search (posts, users, listings) via `/api/search` |
| **Engagement** | Support reactions, “top moms” leaderboard |
| **Leisure** | Small games/quizzes (`/sprostitev-za-mamo` and sub-routes) |
| **Legal & info** | About, contact form (server-side email), terms, privacy, cookie policy |

---

## Tech stack

| Layer | Technologies |
|-------|----------------|
| **Frontend** | React 18, Vite 7, React Router 7, Chakra UI v2, Emotion, Tailwind CSS, Framer Motion, React Icons, Lucide, TanStack Virtual |
| **Backend** | Node.js, Express 5, `pg`, `jsonwebtoken`, bcryptjs, Nodemailer, cookie-parser, cors, dotenv, **express-rate-limit** v8 (`ipKeyGenerator` for IPv6) |
| **Data** | PostgreSQL (migrations via `BACKEND/scripts/migrate.js`) |
| **Media** | Cloudinary (client upload + delivery transforms) |
| **Push (optional)** | Firebase (FCM) + `firebase-admin`; outbox worker in `BACKEND/workers/` |

**Testing:** Automated E2E (e.g. Playwright) is a natural next step; the repo currently focuses on implementation, migrations, and manual QA before production.

---

## Infrastructure & deployment (Hetzner)

Production is hosted on **Hetzner**: **PostgreSQL**, **Express API**, and **Vite-built frontend** are deployed together for this project (single VPS or split as needed). The frontend is served as static assets (e.g. under `/var/www/.../dist`) with **nginx** handling SPA fallback, cache headers for hashed assets, and security headers. Example site config lives in **`ops/nginx/`** (e.g. `maminkoticek-frontend.conf`). **Cloudinary** hosts and optimizes images; the API may sit behind the same or another reverse proxy with TLS termination.

---

## Repository layout

```text
.
├── frontend/                 # React SPA (Vite)
│   ├── src/
│   │   ├── pages/
│   │   ├── components/       # Forum, Marketplace, Moderation, Leisure, …
│   │   ├── hooks/, api/, utils/, context/, constants/
│   │   └── assets/
│   └── package.json
├── BACKEND/                  # Express API (`/api/*`)
│   ├── routes/
│   ├── middleware/         # auth, rateLimiters, security, permissions
│   ├── services/           # spam guards, profanity, push, …
│   ├── workers/            # e.g. push outbox
│   └── Server.js
├── ops/nginx/                # Example nginx configs for production / test
└── README.md
```

---

## Requirements

- Node.js 18+ (LTS recommended)
- npm 9+
- PostgreSQL 14+

---

## Quick start

### 1. Install dependencies

```bash
git clone <repo-url>
cd <repo-folder>
cd frontend && npm install
cd ../BACKEND && npm install
cd ..
```

### 2. Environment variables

**Backend** — create `BACKEND/.env` (see keys below; full example in repo narrative).

**Frontend** — optional `frontend/.env` with `VITE_*` variables (API base URL, Cloudinary, etc.); see `frontend/.env.example`.

Example **backend** variables:

```env
PORT=8080
DATABASE_URL=postgresql://user:password@localhost:5432/your_db

# Production: must be at least 32 characters or the server exits in NODE_ENV=production
JWT_SECRET=your_long_random_secret_at_least_32_chars
JWT_EXPIRES_IN=24h

TRUST_PROXY=true

EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=you@example.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=you@example.com

REPORT_EMAIL=admin@example.com
FRONTEND_URL=http://localhost:5173
```

### 3. Run migrations and servers

Terminal 1 — API:

```bash
cd BACKEND
npm run migrate
npm start
```

Terminal 2 — Vite dev server:

```bash
cd frontend
npm run dev
```

Defaults: frontend `http://localhost:5173`, API `http://localhost:8080`. The client uses `VITE_API_BASE` (or the default in `frontend/src/api/config.js`).

---

## NPM scripts

| Location | Command | Purpose |
|----------|---------|---------|
| `frontend/` | `npm run dev` | Vite dev server |
| `frontend/` | `npm run build` | Production build |
| `frontend/` | `npm run preview` | Preview production build |
| `frontend/` | `npm run lint` | ESLint |
| `BACKEND/` | `npm run migrate` | Apply DB schema |
| `BACKEND/` | `npm start` | Run `node Server.js` |

---

## API route groups (overview)

| Prefix | Purpose |
|--------|---------|
| `/api` | Auth, verification, passwords, logout |
| `/api/posts` | Posts, likes, comments on posts, reports, featured |
| `/api/comments` | Comments, replies, likes, reports |
| `/api/users` | Profile, `me`, user search, public profile, blocks |
| `/api/categories` | Categories & posts |
| `/api/cities` | Cities (forum filters) |
| `/api/groups` | Groups |
| `/api/notifications` | Notifications |
| `/api/push` | Push token registration (FCM) |
| `/api/presence` | Presence |
| `/api/contact` | Contact form |
| `/api/admin` | Admin routes |
| `/api/moderation/appeals` | Appeals |
| `/api/moderation` | Moderation actions & reports |
| `/api/friends` | Friends & blocks |
| `/api/messages` | Private messages |
| `/api/support` | Support reactions & leaderboards |
| `/api/marketplace` | Listings |
| `/api/search` | Global search |
| `/api/health` | Health check |

<details>
<summary><strong>Rate limiting & abuse prevention (summary)</strong></summary>

Layered **express-rate-limit** on `/api` (e.g. global cap per IP), plus stricter limits on login, registration, forgot-password, contact, search, posting, comments, messages, reports, and marketplace—tuned per route in `BACKEND/middleware/rateLimiters.js`. **Anti-spam** checks before inserts (duplicate bursts, URL flooding, character spam) live in `BACKEND/services/spamGuards.js`. User-facing errors are returned in Slovenian without leaking PostgreSQL internals.

</details>

---

## License

All rights reserved © 2026 Kristina Valenčak
