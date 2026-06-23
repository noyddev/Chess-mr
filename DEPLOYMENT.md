# Chess.MR - Deployment Guide

## Overview

Chess.MR is a production-ready chess platform for Mauritania that follows a strict data pipeline:

```
Chess-Results.com ──┬──> Backend Sync Service ──> PostgreSQL Database
                    │         │
                    │         └──> Error Handling (never lose valid data)
                    │
Lichess.org ────────┴──> Backend Sync Service ──> PostgreSQL Database
                                    │
                                    ▼
                            Next.js Frontend (SSR)
                                    │
                                    ▼
                              User Browser
```

## Critical Design Principles

### 1. NO Direct External API Calls from Frontend
- All data MUST flow through the database
- Frontend only reads from local API routes
- External APIs are only called in backend sync jobs

### 2. NEVER Overwrite Valid Data
- If scraping fails, keep existing data
- If Lichess is down, keep cached ratings
- Log all sync errors but don't break frontend

### 3. Graceful Degradation
- Site works even if external APIs are temporarily down
- All pages render with cached data or show "No data available"

## Deployment Steps

### 1. Environment Setup

```bash
# Clone the repository
git clone https://github.com/noyddev/Chess-mr.git
cd Chess-mr

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 2. Database Configuration

Edit `.env`:
```env
DATABASE_URL="postgresql://user:password@host:5432/chess_mr"
```

### 3. Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Seed with sample data
npm run db:seed
```

### 4. Set Up Scheduled Sync Jobs

#### Option A: Vercel Cron Jobs (Recommended)

Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/sync?source=tournaments",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/sync?source=players",
      "schedule": "0 2 * * *"
    }
  ]
}
```

#### Option B: GitHub Actions

Create `.github/workflows/sync.yml`:
```yaml
name: Data Sync

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes for tournaments
    - cron: '0 2 * * *'     # Daily at 2 AM for players
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx prisma generate
      - name: Sync tournaments
        run: curl -X POST "${{ secrets.DEPLOYMENT_URL }}/api/sync?source=tournaments"
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      - name: Sync players
        run: curl -X POST "${{ secrets.DEPLOYMENT_URL }}/api/sync?source=players"
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

#### Option C: System Cron

```bash
# Add to crontab
*/5 * * * * curl -X POST https://your-domain.com/api/sync?source=tournaments
0 2 * * * curl -X POST https://your-domain.com/api/sync?source=players
```

### 5. Build and Deploy

```bash
# Build for production
npm run build

# Deploy to Vercel
vercel --prod

# Or deploy to other platforms
npm run start
```

## API Reference

### Sync Endpoints

#### POST /api/sync
Manually trigger a sync job.

**Query Parameters:**
- `source=tournaments` - Sync from Chess-Results
- `source=players` - Sync from Lichess
- `source=all` - Run full sync (both)

**Response:**
```json
{
  "success": true,
  "itemsSynced": 5,
  "skipped": 0,
  "source": "chess-results"
}
```

#### GET /api/sync
Get sync status and last sync times.

**Response:**
```json
{
  "tournaments": {
    "lastSync": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:30:05Z",
    "status": "success",
    "itemsSynced": 3,
    "skipped": 0,
    "error": null
  },
  "players": {
    "lastSync": "2024-01-14T02:00:00Z",
    "completedAt": "2024-01-14T02:01:30Z",
    "status": "success",
    "itemsSynced": 42,
    "skipped": 3,
    "error": null
  }
}
```

### Data Endpoints

#### GET /api/tournaments
List tournaments with pagination.

**Query Parameters:**
- `page=1` - Page number (default: 1)
- `limit=20` - Items per page (default: 20)
- `status=ACTIVE` - Filter by status (UPCOMING, ACTIVE, FINISHED)
- `sort=startDate` - Sort field (name, startDate, playerCount)

#### GET /api/players
List players with pagination.

**Query Parameters:**
- `page=1` - Page number
- `limit=30` - Items per page
- `search=name` - Search by player name
- `sort=rating` - Sort field (name, rating, fideRating)

#### GET /api/search
Live search across tournaments and players.

**Query Parameters:**
- `q=search term` - Search query

## Sync Behavior

### Tournament Sync (Chess-Results)
- **Interval**: Every 5 minutes for active tournaments
- **Retry**: 3 attempts with exponential backoff (1s, 2s, 4s)
- **On Failure**: Keep existing data, log error, continue
- **Data Preserved**: Never overwrite valid data with empty values

### Player Sync (Lichess)
- **Interval**: Every 24 hours
- **Batch Size**: 30 players per request
- **Retry**: 3 attempts per batch
- **On Failure**: Keep existing ratings, log error, continue

## Monitoring

### Health Checks
- `GET /api/sync` - Returns sync status
- Check sync logs in database for errors
- Set up alerts for failed syncs

### Error Handling
All sync errors are logged to the `SyncLog` table with:
- Source (chess-results or lichess)
- Status (pending, success, failed)
- Error message
- Items synced/skipped
- Timestamps

## Performance

### Caching Strategy
- Database is the source of truth
- Frontend uses Next.js SSR with `force-dynamic`
- No client-side caching for real-time data
- API routes query directly from Prisma

### Database Indexes
The schema includes indexes on:
- `Tournament(status)` - Filter active tournaments
- `Tournament(startDate)` - Sort by date
- `Tournament(externalId)` - Unique lookup
- `Player(name)` - Search
- `Player(lichessUsername)` - Lichess lookup
- `SyncLog(source)` - Filter by source
- `SyncLog(startedAt)` - Order by time

### Scalability
- Supports concurrent users during live tournaments
- Database connection pooling via Prisma
- No external API calls from client = fast page loads
- Pagination for large result sets
