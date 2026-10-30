# SkillBridge

SkillBridge is a student-first education and career guidance MVP built with React, Vite, Express, and MongoDB. It preserves the original navy, lavender, indigo, and cyan design while adding routed learning, career planning, opportunity exploration, and account-backed progress.

## Features

- Responsive landing page and application shell with keyboard-accessible navigation.
- Searchable course and opportunity catalogs, detail pages, course enrollment, lesson progress, bookmarks, and application tracking.
- Student dashboard, saved items, profile settings, career assessment results, roadmap milestones, and interview-practice notes.
- Registration, login, logout, hashed passwords, HTTP-only server sessions, protected user APIs, and server-enforced administrator roles.
- Career guidance chat and assessment endpoint with configurable server-side AI provider, input/output validation, timeout and rate limits, and deterministic demo responses when the provider is not configured.
- Feedback submission stored by the API; anonymous feedback requires an email address. Chat history remains in browser memory only.
- Local demo behavior when the API or catalog is unavailable. Successful account actions are shown only after the backend confirms them.
- Sample opportunities are explicitly marked unverified; they are illustrative records, not confirmed vacancies.

## Requirements

- Node.js 20.19+ or 22.12+
- MongoDB 6.0+ (a local server or a free MongoDB Atlas cluster)

## Local setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Start a MongoDB server (local `mongod`, Docker, or an Atlas cluster). Copy `.env.example` to `.env`, then set `MONGODB_URI` and replace `SESSION_SECRET` with a random value of at least 32 characters. For example:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Local example: `MONGODB_URI=mongodb://127.0.0.1:27017/skillbridge`. Atlas example: `MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/skillbridge?retryWrites=true&w=majority` (URL-encode special characters in the password and allow your IP address in Atlas Network Access).

3. Create the collection indexes. MongoDB creates collections on first write, so there are no migrations to run; this step only creates the unique and query indexes (the API also does this on startup, and it is safe to repeat):

   ```sh
   npm run db:setup
   ```

4. Optional: load clearly illustrative demo courses and opportunities (safe to run more than once):

   ```sh
   npm run db:seed
   ```

5. Start the API and frontend in separate terminals:

   ```sh
   npm run server
   npm run dev
   ```

   Open the Vite URL (normally `http://localhost:5173`). The Vite proxy forwards `/api` requests to `API_PROXY_TARGET` (default `http://localhost:3000`).

6. Run checks:

   ```sh
   npm test
   npm run build
   npm audit --omit=dev
   ```

See [Database setup and schema](./docs/DATABASE.md) and [REST API reference](./docs/API.md) for additional details.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string (`mongodb://` or Atlas `mongodb+srv://`). |
| `MONGODB_DB` | No | Database name. Leave blank to use the database named in `MONGODB_URI` (the driver falls back to `test` if the URI names none, so include one). |
| `MONGODB_TLS` | No | Set `true` to force TLS for a non-SRV connection. `mongodb+srv://` URIs already use TLS. |
| `SESSION_SECRET` | Yes | Random server-only session signing secret; at least 32 characters. |
| `PORT` | No | Express listening port; defaults to `3000`. |
| `NODE_ENV` | No | Set `production` for deployment. |
| `SESSION_COOKIE_SECURE` | No | Enable secure cookies; production enables them automatically. |
| `SESSION_COOKIE_SAME_SITE` | No | `lax` by default; use `none` only with HTTPS and `SESSION_COOKIE_SECURE=true` when cross-site cookies are required. |
| `FRONTEND_ORIGINS` | Production | Comma-separated exact browser origins allowed to call the API. Required in production. |
| `API_PROXY_TARGET` | No | Vite development proxy destination; defaults to `http://localhost:3000`. |
| `VITE_API_BASE_URL` | Deployment-dependent | Public API origin used by the built browser app. Leave blank for same-origin or Vite-proxied development. It must not contain secrets. |
| `AI_BASE_URL` | Optional | HTTPS base URL for an OpenAI-compatible provider. Localhost HTTP is allowed for development. |
| `AI_API_KEY` | Optional | Provider credential; server only. Never prefix it with `VITE_`. |
| `AI_MODEL` | Optional | Model identifier supported by the configured provider. |

Set all three `AI_*` values to enable a provider. Leave all three blank to use deterministic, explicitly labeled demo guidance. Partial configuration is an error. Provider requests time out after 20 seconds and are rate-limited. The service sends the learner's prompt and selected assessment preferences, not account names, emails, or passwords. Chat history is not stored by SkillBridge; review the configured provider's data-retention terms.

## Deployment

### Frontend on Vercel

1. Import the repository into Vercel and use the Vite build command `npm run build` with output directory `dist`.
2. Set `VITE_API_BASE_URL` to the public HTTPS API origin (for example `https://api.example.com`) unless the API is served on the same origin.
3. `vercel.json` provides an SPA fallback for React Router pages.
4. Do not put database, session, or AI credentials in Vercel `VITE_` variables. The Vite API URL is public configuration, not a secret.

### Express API and MongoDB

1. Deploy `npm run server` to a persistent Node.js host and provision MongoDB 6.0+ (for example a MongoDB Atlas cluster).
2. Configure `MONGODB_URI`, a unique `SESSION_SECRET`, `NODE_ENV=production`, `FRONTEND_ORIGINS`, and provider settings only if used. Allow the API host's outbound IP in Atlas Network Access. HTTPS is required in production.
3. Run `npm run db:setup` as a release step (the server also ensures the indexes on startup), then optionally `npm run db:seed`.
4. Set `SESSION_COOKIE_SAME_SITE=lax` for same-site frontend/API domains. For separate sites, set `SESSION_COOKIE_SAME_SITE=none` and secure cookies, but prefer custom frontend/API subdomains on the same registrable domain because browsers may block third-party cookies.
5. Configure the API host's health check as `GET /api/health`. Keep the database and application logs private; do not log session cookies or secrets.
6. Set the Vercel `VITE_API_BASE_URL` and API `FRONTEND_ORIGINS` to their corresponding public origins. Test login, session cookies, CORS, and logout on the deployed domains.

Promote an administrator only through a trusted database operation. Never accept role changes from public registration:

```js
// mongosh
db.users.updateOne({ email: 'admin@example.com' }, { $set: { role: 'admin' } })
```

See [Database setup and schema](./docs/DATABASE.md) and [REST API reference](./docs/API.md).

## Verification and limitations

The automated suite uses Node's built-in test runner, including in-process HTTP tests against a small in-memory stand-in for the MongoDB driver (`tests/helpers/fake-mongo.js`). It covers AI provider/fallback behavior, validation, authentication/session behavior, protected routes, profile updates, admin authorization, enrollment, lesson progress, saved courses/opportunities, application tracking, feedback, and origin restrictions. It does **not** substitute for running the app against a real MongoDB server: the in-memory stand-in only mimics the driver calls the API uses, so index creation, the aggregation-pipeline progress update, and live driver behavior should be checked against a local `mongod` or Atlas cluster before deployment.

Career recommendations are educational guidance, not employment guarantees or scientifically validated assessments. Example catalog content is not verified. Password reset and email delivery are not configured. Admin functions currently create and count catalog records but do not include full user management or catalog edit/delete. Chat messages remain in page memory; career results, learning progress, and feedback have account-backed persistence when signed in, while weekly goals and other demo-only actions remain device-local. No production deployment or external AI provider has been configured or verified.

## Internship screenshot checklist

- [ ] Landing page at desktop width.
- [ ] Responsive landing page at 320–375 px, including mobile navigation.
- [ ] Learning catalog with search and category filters.
- [ ] Course detail with lesson list and enrollment/progress state.
- [ ] Career assessment and results, including the guidance disclaimer.
- [ ] AI guidance chat showing the demo/AI mode label and an answer.
- [ ] Student dashboard with account-backed or clearly identified demo state.
- [ ] Opportunity listing and details showing the unverified-listing warning.
- [ ] Sign-in or registration validation state (do not capture real personal data).
- [ ] Administrator page showing server-enforced access behavior.
