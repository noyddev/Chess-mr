# Chess.MR - Mauritanian Chess Platform Specification

## Project Overview
- **Project Name**: Chess.MR (شطرنج موريتانيا)
- **Project Type**: National Chess Platform Web Application
- **Core Functionality**: Real-time tournament data aggregation, player profiles, live standings, and chess ecosystem integration for Mauritania
- **Target Users**: Mauritanian chess players, tournament organizers, chess enthusiasts, and federation administrators
- **Tech Stack**: Next.js 15 App Router, TypeScript, TailwindCSS, shadcn/ui, PostgreSQL, Prisma ORM, React Query, Cloudflare R2

## Design Specification

### Visual Direction
- **Aesthetic**: Premium minimalist inspired by Apple and Stripe
- **Theme**: Dark/light mode with sophisticated contrast
- **Direction**: Arabic-first RTL (Right-to-Left)
- **Typography**: 
  - Primary: IBM Plex Sans Arabic (for Arabic content)
  - Secondary: Inter (for Latin numerals/data)
  - Headings: Bold weights, generous letter-spacing
- **Spacing System**: 4px base unit, generous whitespace (24px, 32px, 48px sections)
- **Border Radius**: Subtle (8px, 12px, 16px)

### Color Palette
```
Primary:        #2563EB (Royal Blue)
Primary Dark:   #1D4ED8
Secondary:      #10B981 (Emerald)
Accent:         #F59E0B (Amber)
Background:     #FAFAFA (Light) / #0A0A0A (Dark)
Surface:        #FFFFFF (Light) / #171717 (Dark)
Border:         #E5E7EB (Light) / #262626 (Dark)
Text Primary:   #111827 (Light) / #FAFAFA (Dark)
Text Secondary: #6B7280
Success:        #10B981
Warning:        #F59E0B
Error:          #EF4444
```

### Layout Structure
```
├── Header (sticky, blur backdrop)
│   ├── Logo
│   ├── Navigation (Tournaments, Players, About)
│   └── Search Bar (live search)
├── Main Content
│   └── Page-specific content
├── Footer
│   ├── Links
│   ├── Social
│   └── Copyright
└── Sidebar (on tournament/player pages)
```

## Data Architecture

### Core Principles
1. **Never fetch tournament data directly from client** - All data via backend API
2. **Server-side caching** - PostgreSQL as primary cache
3. **Refresh schedules**:
   - Active tournaments: Every 5 minutes
   - Finished tournaments: Every 24 hours
   - Player data: Every 24 hours
4. **Fallback**: Clear status messages when data unavailable

### Database Schema (Prisma)

```prisma
// Core Models

model Tournament {
  id              String   @id @default(cuid())
  externalId      String   @unique // Chess-Results ID
  name            String
  location        String
  startDate       DateTime
  endDate         DateTime
  status          TournamentStatus @default(UPCOMING)
  federation      String   @default("Mauritania")
  
  players         TournamentPlayer[]
  rounds          Round[]
  
  lastSynced      DateTime @default(now())
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([status])
  @@index([startDate])
}

enum TournamentStatus {
  UPCOMING
  ACTIVE
  FINISHED
}

model TournamentPlayer {
  id            String    @id @default(cuid())
  tournamentId  String
  playerId      String
  seed          Int?
  points        Float    @default(0)
  rank          Int?
  tiebreak1     Float?    // Buchholz
  tiebreak2     Float?    // SB
  tiebreak3     Float?
  
  tournament    Tournament @relation(fields: [tournamentId], references: [id])
  player        Player    @relation(fields: [playerId], references: [id])
  
  @@unique([tournamentId, playerId])
}

model Player {
  id            String    @id @default(cuid())
  lichessUsername String? @unique
  fideId        String?   @unique
  name          String
  federation    String    @default("Mauritania")
  
  // Lichess Data (cached)
  lichessRapid      Int?
  lichessBlitz      Int?
  lichessClassical Int?
  lichessTitle      String?
  lichessLastSeen   DateTime?
  
  // FIDE Data (cached)
  fideRating        Int?
  fideTitle         String?
  
  tournaments       TournamentPlayer[]
  
  lichessSyncedAt   DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([name])
  @@index([lichessUsername])
}

model Round {
  id            String    @id @default(cuid())
  tournamentId  String
  number        Int
  name          String?
  startTime     DateTime?
  pairings      Pairing[]
  
  tournament    Tournament @relation(fields: [tournamentId], references: [id])
  
  @@unique([tournamentId, number])
}

model Pairing {
  id            String    @id @default(cuid())
  roundId       String
  board         Int?
  whitePlayerId String?
  blackPlayerId String?
  result        String?   // "1-0", "0-1", "1/2-1/2", "*"
  
  whitePlayer   Player?   @relation("WhitePlayer", fields: [whitePlayerId], references: [id])
  blackPlayer   Player?   @relation("BlackPlayer", fields: [blackPlayerId], references: [id])
  round         Round     @relation(fields: [roundId], references: [id])
  
  @@index([roundId])
}

model SyncLog {
  id          String   @id @default(cuid())
  source      String   // "chess-results", "lichess"
  status      String   // "success", "failed"
  itemsSynced Int      @default(0)
  error       String?
  startedAt   DateTime @default(now())
  completedAt DateTime?
}

// Relations for Player (self-referential for pairings)
relation WhitePlayer {
  Player @relation("WhitePlayer", fields: [whitePlayerId], references: [id])
  Pairing[] @relation("WhitePairings")
}

relation BlackPlayer {
  Player @relation("BlackPlayer", fields: [blackPlayerId], references: [id])
  Pairing[] @relation("BlackPairings")
}
```

### Backend Services

#### 1. Tournament Scraper Service
**Endpoint**: Internal API route `/api/sync/tournaments`
**Schedule**: Every 5 minutes for active, 24h for finished

**Data Source**: Chess-Results.com (scraping active tournaments from Mauritania/FIDE)

**Extracted Data**:
- Tournament metadata (name, dates, location, federation)
- Player list with current standings
- Round information and pairings
- Live results

**Process**:
```
1. Fetch tournament list from Chess-Results MR (Mauritania)
2. For each tournament:
   a. Fetch detailed data
   b. Upsert Tournament record
   c. Sync players (create if not exist)
   d. Sync pairings and standings
3. Update lastSynced timestamp
4. Log sync operation
```

#### 2. Lichess Integration Service
**Endpoint**: Internal API route `/api/sync/players`
**Schedule**: Every 24 hours

**Endpoints Used**:
- `GET /api/user/{username}` - User profile and ratings
- `GET /api/users/status?ids=...` - Real-time online status

**Process**:
```
1. Get all players with stale lichess data
2. Batch fetch from Lichess API (50 users/request)
3. Update player records
4. Handle rate limiting (wait on 429)
```

#### 3. Cache Strategy
- **Tournament Cache**: PostgreSQL with 5-minute TTL for active
- **Player Cache**: PostgreSQL with 24-hour TTL
- **API Response Cache**: Next.js cache with revalidation
- **React Query**: Client-side caching with staleTime

## Page Structure

### Home Page (`/`)
**Sections**:
1. Hero - Animated chess board with platform tagline
2. Featured Tournaments - 3-6 active/upcoming tournaments from DB
3. Latest Results - Recent finished tournaments
4. Top Players - Top-rated Mauritanian players (from DB)
5. Statistics - Real counts from database

**Data Source**: Database only, no external fetches on page render

### Tournaments Page (`/tournaments`)
**Features**:
- Filter: All / Active / Upcoming / Finished
- Sort: By date, by name
- Pagination: 20 per page
- Cards show: Name, dates, location, player count, status

**Data Source**: Database with server-side pagination

### Tournament Detail Page (`/tournaments/[id]`)
**Tabs**:
1. Standings - Live ranking table
2. Pairings - Current round pairings
3. Results - All completed games
4. Players - Player list with ratings
5. Info - Tournament details

**Data Source**: Database only

### Players Page (`/players`)
**Features**:
- Search by name (debounced, 300ms)
- Filter by rating range
- Sort by name, rating, tournaments
- Pagination: 30 per page

**Data Source**: Database with server-side search

### Player Profile Page (`/players/[id]`)
**Sections**:
1. Header - Name, titles, federation
2. Ratings Card - Lichess ratings, FIDE rating
3. Recent Tournaments - Last 10 tournaments played
4. Performance Stats - Win/draw/loss, average opponent

**Data Source**: Database with Lichess API fallback

### Live Search
**Trigger**: Focus on search bar
**Behavior**:
```
1. User types (debounce 300ms)
2. API call to /api/search?q={query}
3. Results include:
   - Matching players
   - Active tournaments with that player
   - Current pairing (if playing)
   - Current standings position
4. Max 5 results per category
```

## API Routes

### Public API
```
GET  /api/tournaments              - List tournaments
GET  /api/tournaments/[id]        - Tournament details
GET  /api/tournaments/[id]/standings - Live standings
GET  /api/tournaments/[id]/pairings  - Current round pairings
GET  /api/players                  - List players
GET  /api/players/[id]            - Player profile
GET  /api/search?q=               - Live search
```

### Internal Sync API (cron-triggered)
```
POST /api/sync/tournaments        - Trigger tournament sync
POST /api/sync/players            - Trigger player sync
GET  /api/sync/status             - Last sync times
```

## Component Library

### Layout Components
- `Header` - Sticky navigation with blur backdrop
- `Footer` - Site footer with links
- `Container` - Max-width wrapper with responsive padding
- `Sidebar` - Collapsible sidebar for detail pages

### UI Components (shadcn/ui based)
- `Button` - Primary, secondary, ghost variants
- `Card` - Surface card with header/body/footer
- `Input` - Form input with label and error
- `Select` - Dropdown select
- `Table` - Data table with sorting
- `Badge` - Status badges (active, finished, upcoming)
- `Avatar` - Player avatar with fallback
- `Skeleton` - Loading skeleton
- `EmptyState` - Placeholder for no data

### Feature Components
- `TournamentCard` - Tournament preview card
- `PlayerCard` - Player preview card
- `StandingsTable` - Live standings with live indicator
- `PairingCard` - Game pairing display
- `RatingBadge` - Rating display with trend
- `LiveSearch` - Search input with dropdown results
- `StatCard` - Statistics display card

## Performance Requirements

### Core Web Vitals Targets
- LCP: < 2.5s
- FID: < 100ms
- CLS: < 0.1
- Lighthouse: > 90

### Optimizations
1. **Server Components** - Default, client only where needed
2. **React Query** - Stale-while-revalidate pattern
3. **Image Optimization** - Next.js Image with R2
4. **Font Optimization** - next/font with Arabic support
5. **Code Splitting** - Dynamic imports for heavy components
6. **Database Indexing** - Proper indexes on all query fields
7. **Caching Headers** - Immutable for static assets
8. **Prefetching** - Next/link prefetch for likely navigations

### Error Handling
- Error boundaries around all page sections
- Graceful degradation when services unavailable
- Clear error messages in Arabic/English
- Fallback UI for failed data loads

## Validation Requirements

### Data Integrity
- All tournament data from Chess-Results sync
- All player ratings from Lichess API or local database
- Standings match source tournament data
- Pairings match current round data

### Display Rules
```
IF data exists:
  → Display real data
ELSE:
  → Display clear status message
  
GOOD:  "No active tournaments found."
BAD:   "3 active tournaments" (when none exist)

GOOD:  "Rating unavailable"
BAD:   Displaying estimated/guessed rating
```

## Folder Structure
```
/app
  /layout.tsx                 # Root layout with RTL, fonts
  /page.tsx                   # Home page
  /tournaments
    /page.tsx                 # Tournament list
    /[id]/page.tsx            # Tournament detail
  /players
    /page.tsx                 # Player list
    /[id]/page.tsx            # Player profile
  /about/page.tsx
  /api
    /tournaments/...          # Tournament API routes
    /players/...              # Player API routes
    /search/...               # Search API route
    /sync/...                 # Internal sync routes
/components
  /ui/                        # shadcn/ui components
  /layout/                    # Layout components
  /features/                 # Feature components
/lib
  /db.ts                     # Prisma client
  /api/                      # API utilities
  /utils.ts                  # Utility functions
/services
  /scraper/                  # Chess-Results scraper
  /lichess/                  # Lichess API client
  /sync/                     # Sync orchestration
/prisma
  /schema.prisma
  /migrations/
```

## Acceptance Criteria

### Functional Requirements
1. All pages render with real data from database
2. Tournament data updates via scheduled sync
3. Player data shows Lichess ratings when available
4. Live search returns relevant results within 500ms
5. All forms and interactions work correctly

### Data Requirements
1. Zero placeholder content on any page
2. Zero mock data or fake statistics
3. Clear messages when data unavailable
4. All displayed data traceable to source

### Technical Requirements
1. Lighthouse score > 90 on all pages
2. No runtime errors in console
3. All links functional (no 404s)
4. Responsive on mobile/tablet/desktop
5. RTL layout correct on all pages

### Security Requirements
1. No sensitive data exposed in client bundle
2. API routes protected from abuse
3. Rate limiting on public endpoints
4. Input sanitization on all forms
