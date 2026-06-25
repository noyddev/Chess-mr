# 1. OBJECTIVE

Make Chess.MR a fully functional chess platform by setting up the required PostgreSQL database and configuring the environment so the app can load, display data, and sync tournaments from Chess-Results.com.

# 2. CONTEXT SUMMARY

**The Problem:** The app shows empty states because:
1. No `DATABASE_URL` environment variable is configured
2. The PostgreSQL database has not been initialized
3. No initial sync has been run to fetch tournament data

**Key Files:**
- `prisma/schema.prisma` - Database schema
- `.env.example` - Environment variable template  
- `services/scraper/chess-results.ts` - Fetches data via HTTP (NOT browser automation)
- `services/sync/orchestrator.ts` - Orchestrates syncing data to database
- `lib/database.ts` - Database utilities and health checks

**Architecture:**
```
Chess-Results.com → HTTP fetch (scraper) → PostgreSQL → Next.js Frontend
```

# 3. APPROACH OVERVIEW

1. **Set up PostgreSQL database** (using Neon PostgreSQL - free tier recommended)
2. **Configure environment variables** with database connection string
3. **Initialize database schema** using Prisma
4. **Run initial sync** to fetch tournament data from Chess-Results
5. **Start the app** and verify data loads correctly

# 4. IMPLEMENTATION STEPS

## Step 1: Create a PostgreSQL Database

**Goal:** Get a running PostgreSQL database for the application.

**Method:**
- Use **Neon PostgreSQL** (recommended - free tier, serverless)
  - Sign up at https://neon.tech
  - Create a new project
  - Copy the connection string from the dashboard
- Alternative: Use any PostgreSQL provider (Railway, Supabase, local PostgreSQL)

**Reference:** `.env.example` for required connection string format

---

## Step 2: Configure Environment Variables

**Goal:** Set the DATABASE_URL so the app can connect to PostgreSQL.

**Method:**
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Edit `.env.local` and set:
   ```env
   DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
   ```

**Reference:** `.env.example` lines 8-12

---

## Step 3: Initialize the Database

**Goal:** Create the database schema using Prisma.

**Method:**
```bash
# Install dependencies (if not already done)
npm install

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

**Reference:** `package.json` scripts, `prisma/schema.prisma`

---

## Step 4: Run Initial Data Sync

**Goal:** Fetch tournament data from Chess-Results.com and populate the database.

**Method:**
1. Start the Next.js app:
   ```bash
   npm run dev
   ```
2. In a separate terminal, trigger the sync:
   ```bash
   curl -X POST "http://localhost:3000/api/sync?source=tournaments"
   ```
3. Check sync status:
   ```bash
   curl "http://localhost:3000/api/sync"
   ```

**Reference:** `services/sync/orchestrator.ts`, `app/api/sync/route.ts`

---

## Step 5: Set Up Scheduled Sync (Production)

**Goal:** Automate data syncing so the app stays up-to-date.

**Method:**
For **Vercel deployment**, `vercel.json` already has cron configured:
```json
{
  "crons": [
    { "path": "/api/sync?source=tournaments", "schedule": "*/5 * * * *" }
  ]
}
```

For **local/other deployment**, use system cron:
```bash
*/5 * * * * curl -X POST https://your-domain.com/api/sync?source=tournaments
```

**Reference:** `DEPLOYMENT.md` lines 75-131

---

## Step 6: Verify the Application

**Goal:** Confirm the app loads correctly with data.

**Method:**
1. Open `http://localhost:3000` (or your deployed URL)
2. Check for:
   - No error banner showing "Database not connected"
   - Tournaments appearing in the "Active" or "Upcoming" tabs
   - Player count showing in statistics
3. If data is empty, check the sync status endpoint

**Reference:** `app/page.tsx` - homepage with tournament display

# 5. TESTING AND VALIDATION

**Success Criteria:**
- [ ] Homepage loads without database connection error
- [ ] Statistics section shows tournament and player counts (can be 0 initially)
- [ ] Sync endpoint returns `{"success": true, ...}` when triggered
- [ ] After sync, tournaments appear on homepage
- [ ] Tournament detail pages show player standings
- [ ] Players page shows player list

**Health Check:**
```bash
curl http://localhost:3000/api/health
```
Should return `"database": "up"` and `"systemStatus": "ok"`

**Sync Status:**
```bash
curl "http://localhost:3000/api/sync"
```
Should show last sync timestamp and `"status": "success"`
