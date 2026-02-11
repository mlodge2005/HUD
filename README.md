# HUD WebApp MVP

Production-grade MVP for a streamer/viewer HUD with admin user management, LiveKit streaming, real-time chat (via Supabase Realtime), and telemetry overlays. **Vercel-compatible** (no custom server; serverless-friendly).

## Stack

- **Next.js 15** (App Router) + TypeScript
- **PostgreSQL** + Prisma (use Neon, Supabase, or any Postgres for Vercel)
- **Cookie-based sessions** (httpOnly)
- **RBAC** (admin / user; streamer is separate from admin — admin is `user.role` only)
- **LiveKit** for WebRTC SFU streaming and data channels (stream control / handoff)
- **Supabase Realtime** for global chat (broadcast) and online users (presence)
- No Socket.IO; no custom Node server

## Prerequisites

- Node.js 18+
- PostgreSQL (local or hosted, e.g. Neon/Supabase for Vercel)
- **LiveKit** (hosted at [livekit.io](https://livekit.io) or self-hosted) — required for streaming and realtime features

## Setup

### 1. Install dependencies

```bash
cd hud-webapp
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and set:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/hud?schema=public"
SESSION_SECRET="at-least-32-character-random-string"
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=admin123
SEED_ADMIN_DISPLAY_NAME=Admin
```

For streaming and realtime (chat, stream request/handoff):

- `LIVEKIT_URL` — LiveKit server URL (e.g. `wss://your-project.livekit.cloud`)
- `LIVEKIT_API_KEY` — API key
- `LIVEKIT_API_SECRET` — API secret

If these are missing, the HUD shows “Streaming not configured” but auth and admin still work.

**Supabase Realtime (global chat + online users):**  

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (e.g. `https://xxxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon (publishable) key; safe for client
- `SUPABASE_SERVICE_ROLE_KEY` — Server-only; never expose to client (optional for chat; use if you add server-side Realtime later)

Chat messages are stored in your existing Postgres `chat_messages` table (Prisma); Supabase is used only as the realtime transport (broadcast + presence). No Supabase Postgres migration required.

Optional:

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — for map widget (client-side; if missing, placeholder is shown).

**Google Calendar (per-user, HUD widget):**

- `GOOGLE_OAUTH_CLIENT_ID` — OAuth 2.0 client ID from Google Cloud Console.
- `GOOGLE_OAUTH_CLIENT_SECRET` — OAuth 2.0 client secret.

Redirect URI is computed from the request (origin + `/api/google/oauth/callback`), so no env var is needed. In Google Cloud Console, add **Authorized redirect URIs** for each environment, e.g. `http://localhost:3000/api/google/oauth/callback` and `https://<your-domain>/api/google/oauth/callback`.

If set, any user can connect their own Google Calendar in **Settings**. The HUD calendar widget shows upcoming events for the **current active streamer** (from their connected calendar).

### 3. Database

```bash
npm run prisma:migrate
npm run prisma:seed
```

- **Migrate** applies the schema (including `stream_state` and pending-request columns).
- **Seed** creates the admin user from `SEED_*` env vars (and sets `must_change_password=false` for that admin).

### 4. Run

**Development:**

```bash
npm run dev
```

**Production:**

```bash
npm run build
npm run start
```

App is at **http://localhost:3000** (or `PORT` if set).

## Vercel deployment

- Deploy as a standard Next.js app. All APIs are Route Handlers; no custom server or WebSockets on the server.
- **Database:** Use a hosted Postgres (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com)) and set `DATABASE_URL` in Vercel.
- **LiveKit:** Must be hosted (e.g. [LiveKit Cloud](https://cloud.livekit.io)) or self-hosted elsewhere. Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` in Vercel.
- **Chat and online users** use **Supabase Realtime** (broadcast + presence on channel `hud-global`). **Stream request/handoff** still use LiveKit data channels in the same room as the video stream. No Socket.IO or custom WebSocket server.

## Scripts

| Script                  | Description              |
|-------------------------|--------------------------|
| `npm run dev`           | Next.js dev server       |
| `npm run build`         | Build Next.js            |
| `npm run start`         | Next.js production      |
| `npm run lint`          | ESLint                   |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate`  | Run migrations        |
| `npm run prisma:seed`     | Seed admin user        |

## Main flows

1. **Admin** logs in with seed credentials → can create/edit/disable/delete users, reset passwords, view login history at `/admin` and `/admin/auth-events`.
2. **User** logs in → if `must_change_password`, redirected to `/change-password`; then can use `/hud`.
3. **HUD** (`/hud`): Everyone joins the LiveKit room with a **viewer** token (subscribe + publish data). If no active streamer, “Adopt Stream Identity” sets the user as streamer (REST + broadcast `stream:status` via LiveKit data). Viewers can “Request to Stream” (REST + broadcast `stream:request`); current streamer (or admin) Accept/Decline; accept triggers handoff (REST + `stream:handoff` / `stream:status`). **Lazy expiry:** if the streamer stops sending heartbeats for 10s, the next call to any stream API clears the streamer (no background timer).
4. **Streamer** on HUD: “Go Live” gets a **streamer** token and reconnects to publish video; “Stop” unpublishes and reconnects as viewer. Telemetry (GPS + heading) is sent to the server; widgets (compass, map, local info) read from REST.
5. **Chat** is global: messages are persisted in Postgres via `POST /api/chat/messages`, then broadcast to all clients over Supabase Realtime. **Online users** are shown via Supabase presence on the same channel. Rate limit ~1 msg/s, burst 5 (client-side).

## Routes

- `/` — Home (links to Login / HUD)
- `/login` — Login
- `/change-password` — First-login password change
- `/hud` — HUD (video + widgets + chat); auth required
- `/admin` — User management; admin only
- `/admin/calendar` — Link to Settings for calendar (per-user); admin only
- `/admin/auth-events` — Login history; admin only
- `/settings` — Per-user settings (Google Calendar connect/disconnect, calendar ID); auth required

## API (summary)

- **Auth:** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`
- **Admin:** `GET/POST /api/admin/users`, `PATCH/DELETE /api/admin/users/:id`, `POST /api/admin/users/:id/reset-password`, `GET /api/admin/auth-events`
- **Settings:** `GET/POST /api/settings/calendar`, `POST /api/settings/calendar/disconnect`, `GET /api/settings/calendar/test`
- **Google OAuth:** `GET /api/google/oauth/start` (redirect to Google), `GET /api/google/oauth/callback` (exchange code, store tokens for current user)
- **Stream:** `GET /api/stream/state`, `POST /api/stream/adopt`, `POST /api/stream/release`, `POST /api/stream/request`, `POST /api/stream/respond`, `POST /api/stream/heartbeat`, `POST /api/stream/set-live`
- **LiveKit:** `POST /api/livekit/token/viewer`, `POST /api/livekit/token/streamer`
- **Telemetry:** `POST /api/telemetry/update`, `GET /api/telemetry/latest`
- **Widgets:** `GET /api/widgets/calendar`, `GET /api/widgets/reverse-geocode`, `GET /api/widgets/weather`
- **Chat:** `GET /api/chat/messages?limit=50`, `POST /api/chat/messages` (body: `{ text }`)
- **Users:** `GET /api/users/list` (auth required)

**Realtime:** Chat and presence use **Supabase Realtime** (channel `hud-global`). Stream control and handoff use **LiveKit data messages** in room `hud-room`. No Socket.IO.

## Security

- No self-signup; only admin can create users.
- All admin and protected routes enforce server-side auth (and admin role where required).
- Sessions are DB-backed; disabled users cannot log in; sessions revoked on disable/reset-password.
- Last admin cannot be deleted.

## Deliverables checklist

- [x] `npm run dev` starts with Next only (no custom server)
- [x] Login/logout and auth_events work
- [x] Admin pages work
- [x] `/hud` loads; connects to LiveKit when configured; shows “Streaming not configured” when env vars missing
- [x] Chat over Supabase Realtime (persisted in Postgres); online users via presence
- [x] Stream request to streamer; accept triggers handoff; old streamer stops
- [x] Lazy expiry: after ~10s without heartbeats, next stream API call clears streamer
