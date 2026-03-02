# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server on localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

## Architecture

Next.js 14 app (App Router) for a B2B SaaS platform where users have real-time video conversations with AI mentor avatars powered by Simli + Daily.co.

### Core Flow
1. User logs in (Firebase Auth email/password) → AuthContext loads UserProfile + SchoolProfile from Firestore
2. Home page shows mentor grid filtered by user's access tier
3. User clicks mentor → SimliAgent overlay opens → server-side proxy creates Simli session → joins Daily.co room → polls for chatbot participant
4. Session tracked in Firestore `monitoring` collection with duration

### Key Directories
- `app/api/simli/` — Server-side proxies for Simli API (token, agents list, session start). All Simli API calls go through these to avoid CORS and keep the API key server-side only.
- `app/context/` — AuthContext (Firebase auth + user/school profiles), LanguageContext (i18n: es/ca/en)
- `app/lib/types.ts` — Core interfaces: `AgentData`, `UserProfile`, `SchoolProfile`, `SimliAgentResponse`
- `app/lib/access.ts` — `computeAccessibleAgentIds()` combines subscription plan tier + school custom agents + user extra access
- `app/locales/` — Translation JSON files (es.json, ca.json, en.json) with `{param}` interpolation

### Firestore Collections
- `users/{uid}` — Profile, schoolId, extraAvatarAccess[], fav_agents[], locale
- `schools/{schoolId}` — name, subscriptionPlan (free/basic/premium), customAgentAccess[]
- `agents/{agentId}` — Published mentor definitions (name, type, avatarUrl, year)
- `monitoring/{id}` — Session tracking (userId, agentId, startedAt, endedAt, durationSeconds)
- `messages/{id}` — Contact form tickets (title, description, status: open/closed)

### Access Control
Three-tier subscription model in `PLAN_AGENT_ACCESS`:
- **free**: public agents only
- **basic**: public + basic
- **premium**: public + basic + premium
- **custom**: per-school agent grants + per-user `extraAvatarAccess`

Admin panel access is hardcoded to `admin@admin.com`.

### Simli Integration
SimliAgent.tsx uses the `/auto/start/configurable` endpoint (via `/api/simli/start` proxy). The proxy sends `x-simli-api-key` header + agent config (faceId, voiceId, systemPrompt, etc.). Returns a Daily.co roomUrl. Component polls for a non-"User" participant up to 120 times (60s timeout).

### Admin Panel (app/admin/page.tsx)
Single page with 5 tabs: Agents (publish/unpublish from Simli), Schools (CRUD + plan assignment), Users (create via secondary Firebase app pattern, assign schools, grant extra access), Monitoring (usage aggregated by user/school/date), Messages (contact tickets).

User creation uses a **secondary Firebase App** to call `createUserWithEmailAndPassword` without logging out the admin.

## Styling

TailwindCSS with custom design tokens in `tailwind.config.ts`:
- Colors: `primary` (#05071a), `accent` (#3a6ef2), `teal` (#47cc88), `card-bg`, `border-subtle`, `text-secondary`
- Fonts: `sora` (headings), `inter` (body)
- Custom CSS classes in `globals.css`: `.glass-card` (glassmorphic cards), `.avatar-glow` (blue glow for active video)
- Utility: `cn()` from `app/utils/cn.ts` — combines clsx + tailwind-merge

## Environment Variables

```
SIMLI_API_KEY=...                          # Server-side only (no NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_FIREBASE_API_KEY=...           # Client-side (Firebase requires this)
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

`SIMLI_API_KEY` must NOT have `NEXT_PUBLIC_` prefix — it's a secret key accessed only by server-side route handlers.

## Deployment

Hosted on **Vercel** via the `timeless-mentors-app` GitHub repo. Vercel's production branch is `main`.

- The repo's working branch is `master`. After committing, always push to **both** `master` and `main` so Vercel triggers a production deploy:
  ```bash
  git push origin master && git push origin master:main
  ```
- Two GitHub remotes receive pushes: `ManuRuizTeacher/timeless-mentors` and `ManuRuizTeacher/timeless-mentors-app`.
- Production URL: `timeless-mentors-app.vercel.app`
