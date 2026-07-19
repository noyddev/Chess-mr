/**
 * Chess-Results.com Scraper - Version 2
 * 
 * Three independent functions with explicit result types and proper error handling:
 * - fetchStandings(externalId): Returns tournament standings
 * - fetchRoundPairings(externalId, roundNumber): Returns pairings for a specific round
 * - fetchTournamentInfo(externalId): Returns tournament metadata
 * 
 * Key features:
 * - Exponential backoff retry (1s, 3s, 9s) for network failures
 * - No retry for structural errors (HTML changes)
 * - Explicit result types: { success: true, data: T } | { success: false, error: string, stage: string }
 * - Bye detection with explicit isBye flag
 * - Proper date extraction from tournament info page
 * - Respects rate limits (max 2-3 concurrent requests)
 */

import { TournamentStatus } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

export interface ScrapedTournament {
  externalId: string;
  name: string;
  location: string;
  startDate?: Date;
  endDate?: Date;
  status: TournamentStatus;
  playerCount: number;
  sourceUrl: string;
}

export interface ScrapedPlayer {
  name: string;
  federation?: string;
  fideId?: string;
  seed?: number;
  points?: number;
  rank?: number;
  rating?: number;
  tiebreak1?: number; // Buchholz
  tiebreak2?: number; // SB (Sonneborn-Berger)
}

export interface ScrapedRound {
  number: number;
  name?: string;
  startTime?: Date;
  pairings: ScrapedPairing[];
}

export interface ScrapedPairing {
  board?: number;
  isBye: boolean; // Explicit bye flag
  whitePlayer?: string;
  blackPlayer?: string;
  result?: string;
}

// Result types with explicit success/failure
export type StandingsResult = 
  | { success: true; data: ScrapedPlayer[] }
  | { success: false; error: string; stage: "fetch" | "parse" };

export type PairingsResult = 
  | { success: true; data: ScrapedRound }
  | { success: false; error: string; stage: "fetch" | "parse" };

export type TournamentInfoResult = 
  | { success: true; data: Omit<ScrapedTournament, "externalId" | "sourceUrl"> }
  | { success: false; error: string; stage: "fetch" | "parse" };

// ============================================================================
// Scraper Implementation
// ============================================================================

const BASE_URL = "https://chess-results.com";
const USER_AGENT = "Chess-MR/1.0 (Mauritanian Chess Platform; https://chess-mr.com)";

// Rate limiting queue
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 500; // 500ms between requests

async function fetchWithRateLimit(url: string, options: RequestInit = {}): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      ...options.headers,
    },
    signal: AbortSignal.timeout(30000), // 30s timeout
  });
  
  return response;
}

/**
 * Retry with exponential backoff for network failures only
 * Does NOT retry for structural/parsing errors
 */
async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  parseFn: (html: string) => T
): Promise<{ success: true; data: T } | { success: false; error: string; stage: "fetch" | "parse" }> {
  const maxAttempts = 3;
  const backoffMs = [1000, 3000, 9000]; // 1s, 3s, 9s
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetchWithRateLimit(url, options);
      
      if (!response.ok) {
        // Network error (5xx, etc) - retry
        if (response.status >= 500 && attempt < maxAttempts) {
          console.log(`[SCRAPER] HTTP ${response.status}, retrying in ${backoffMs[attempt - 1]}ms (attempt ${attempt}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, backoffMs[attempt - 1]));
          continue;
        }
        // Client error (4xx) - don't retry
        return { 
          success: false, 
          error: `HTTP ${response.status}: ${response.statusText}`, 
          stage: "fetch" 
        };
      }
      
      const html = await response.text();
      
      try {
        const data = parseFn(html);
        return { success: true, data };
      } catch (parseError) {
        // Structural error - don't retry, just fail immediately
        return { 
          success: false, 
          error: `Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`, 
          stage: "parse" 
        };
      }
    } catch (networkError) {
      // Network failure (timeout, connection error, etc) - retry
      if (attempt < maxAttempts) {
        console.log(`[SCRAPER] Network error: ${networkError}, retrying in ${backoffMs[attempt - 1]}ms (attempt ${attempt}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, backoffMs[attempt - 1]));
        continue;
      }
      return { 
        success: false, 
        error: `Network error after ${maxAttempts} attempts: ${networkError instanceof Error ? networkError.message : String(networkError)}`, 
        stage: "fetch" 
      };
    }
  }
  
  return { success: false, error: "Max retries exceeded", stage: "fetch" };
}

// ============================================================================
// HTML Parsing Utilities
// ============================================================================

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
  };
  
  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'g'), char);
  }
  result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  return result;
}

function parseGermanDate(dateStr: string): Date | null {
  const parts = dateStr.split(/[\.\-]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) {
      year += year > 50 ? 1900 : 2000;
    }
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

function safeParseFloat(value: string | undefined | null): number | null {
  if (!value || value === "-" || value.trim() === "") {
    return null;
  }
  const cleaned = value.replace(/[^\d.,\-]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// ============================================================================
// Tournament Info
// ============================================================================

/**
 * Fetch tournament metadata (name, dates, location, status)
 */
export async function fetchTournamentInfo(externalId: string): Promise<TournamentInfoResult> {
  const url = `${BASE_URL}/tnr${externalId}.aspx?lan=1`;
  
  return fetchWithRetry(
    url,
    {},
    (html) => {
      // Extract tournament name
      const nameMatch = html.match(/<h1[^>]*class="[^"]*pgn[^^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
      const name = nameMatch 
        ? decodeHtmlEntities(nameMatch[1].replace(/<[^>]*>/g, "").trim())
        : "Unknown Tournament";
      
      // Extract dates
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      
      // Pattern: "from 01.06.2026 to 03.06.2026" or "vom 01.06.2026 bis 03.06.2026"
      const rangeMatch = html.match(/(?:from|vom)\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*(?:to|bis|\-)\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
      if (rangeMatch) {
        startDate = parseGermanDate(rangeMatch[1]) || undefined;
        endDate = parseGermanDate(rangeMatch[2]) || undefined;
      }
      
      // Fallback: extract all dates and use first/last
      if (!startDate) {
        const dateMatches = [...html.matchAll(/(\d{1,2}\.\d{1,2}\.\d{4})/g)];
        const validDates = dateMatches
          .map(m => parseGermanDate(m[1]))
          .filter((d): d is Date => d !== null && d.getFullYear() > 2020 && d.getFullYear() < 2030);
        
        if (validDates.length >= 2) {
          startDate = validDates[0];
          endDate = validDates[validDates.length - 1];
        } else if (validDates.length === 1) {
          startDate = validDates[0];
          endDate = validDates[0];
        }
      }
      
      // Extract status
      let status: TournamentStatus = "UPCOMING";
      const statusMatch = html.match(/Class="p_(\d+)"/i);
      if (statusMatch) {
        const statusCode = statusMatch[1];
        if (statusCode === "18") status = "ACTIVE";
        else if (statusCode === "5") status = "FINISHED";
        else if (statusCode === "17") status = "UPCOMING";
      }
      
      // Extract location (often in the tournament header)
      let location = "Mauritania";
      const locationMatch = html.match(/Location:([^<]+)/i) || html.match(/<td[^>]*>Ort:([^<]+)<\/td>/i);
      if (locationMatch) {
        location = decodeHtmlEntities(locationMatch[1].trim());
      }
      
      // Count players from the main table
      const playerRows = [...html.matchAll(/<tr[^>]*class="CRg[12]"[^>]*>/gi)];
      const playerCount = playerRows.length;
      
      return {
        name,
        location,
        startDate,
        endDate,
        status,
        playerCount,
      };
    }
  );
}

// ============================================================================
// Standings
// ============================================================================

/**
 * Fetch tournament standings (players, points, tiebreaks)
 * Uses art=9 which typically shows clean standings table
 */
export async function fetchStandings(externalId: string): Promise<StandingsResult> {
  // Try art=9 for clean standings, fallback to default
  const url = `${BASE_URL}/tnr${externalId}.aspx?lan=1&art=9`;
  
  return fetchWithRetry(
    url,
    {},
    (html) => {
      const players: ScrapedPlayer[] = [];
      
      // Match player rows - the standings table format
      // Each row has: rank, name, FIDE ID, points, Buchholz, SB, etc.
      const rowPattern = /<tr[^>]*class="CRg[12]"[^>]*>([\s\S]*?)<\/tr>/gi;
      const matches = html.matchAll(rowPattern);
      
      for (const match of matches) {
        const rowHtml = match[1];
        
        // Extract rank
        const rankMatch = rowHtml.match(/<td[^>]*class="CRr[124]?"[^>]*>([\s\S]*?)<\/td>/i);
        const rank = rankMatch ? parseInt(rankMatch[1].replace(/<[^>]*>/g, "").trim()) : undefined;
        
        // Extract player name - usually in a link or strong tag
        const nameMatch = rowHtml.match(/<a[^>]*href="[^"]*sid=(\d+)[^"]*"[^>]*>([^<]+)<\/a>/i)
          || rowHtml.match(/<td[^>]*>([^<]+)<\/td>/i);
        const name = nameMatch ? decodeHtmlEntities(nameMatch[nameMatch.length - 1].trim()) : null;
        
        if (!name) continue;
        
        // Extract FIDE ID
        const fideMatch = rowHtml.match(/href="https:\/\/ratings\.chess\.com\/(\d+)"[^>]*>/i);
        
        // Extract points
        let points: number | undefined;
        const pointsMatch = rowHtml.match(/<td[^>]*class="CRp"[^>]*>([\s\S]*?)<\/td>/i);
        if (pointsMatch) {
          const parsed = safeParseFloat(pointsMatch[1].replace(/<[^>]*>/g, "").trim());
          points = parsed !== null ? parsed : undefined;
        }
        
        // Extract Buchholz (tiebreak1)
        let tiebreak1: number | undefined;
        const buchholzMatch = rowHtml.match(/<td[^>]*class="CRb"[^>]*>([\s\S]*?)<\/td>/i);
        if (buchholzMatch) {
          const parsed = safeParseFloat(buchholzMatch[1].replace(/<[^>]*>/g, "").trim());
          tiebreak1 = parsed !== null ? parsed : undefined;
        }
        
        // Extract SB (tiebreak2)
        let tiebreak2: number | undefined;
        const sbMatch = rowHtml.match(/<td[^>]*class="CRs"[^>]*>([\s\S]*?)<\/td>/i);
        if (sbMatch) {
          const parsed = safeParseFloat(sbMatch[1].replace(/<[^>]*>/g, "").trim());
          tiebreak2 = parsed !== null ? parsed : undefined;
        }
        
        players.push({
          name,
          fideId: fideMatch ? fideMatch[1] : undefined,
          points,
          tiebreak1,
          tiebreak2,
          rank,
        });
      }
      
      // Deduplicate by name+rank
      const seen = new Set<string>();
      return players.filter(p => {
        const key = `${p.name}|${p.rank}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
  );
}

// ============================================================================
// Round Pairings
// ============================================================================

/**
 * Fetch pairings for a specific round
 * Tries direct URL with round parameter first, then postback
 */
export async function fetchRoundPairings(externalId: string, roundNumber: number): Promise<PairingsResult> {
  // First try direct URL with round parameter
  const directUrl = `${BASE_URL}/tnr${externalId}.aspx?lan=1&art=3&rnd=${roundNumber}`;
  
  const directResult = await fetchWithRetry(
    directUrl,
    {},
    (html) => parsePairingsFromHtml(html, roundNumber)
  );
  
  if (directResult.success && directResult.data.pairings.length > 0) {
    return directResult;
  }
  
  // If direct URL didn't work, try postback to get round data
  // This handles ASP.NET WebForms that require form postback
  return fetchRoundPairingsViaPostback(externalId, roundNumber);
}

async function fetchRoundPairingsViaPostback(externalId: string, roundNumber: number): Promise<PairingsResult> {
  const url = `${BASE_URL}/tnr${externalId}.aspx?lan=1`;
  
  try {
    // First get the page to extract VIEWSTATE
    const initialResponse = await fetchWithRateLimit(url);
    if (!initialResponse.ok) {
      return { success: false, error: `HTTP ${initialResponse.status}`, stage: "fetch" };
    }
    
    const html = await initialResponse.text();
    
    // Extract ASP.NET form fields
    const viewStateMatch = html.match(/id="__VIEWSTATE" value="([^"]+)"/);
    const viewStateGenMatch = html.match(/id="__VIEWSTATEGENERATOR" value="([^"]+)"/);
    const eventValidationMatch = html.match(/id="__EVENTVALIDATION" value="([^"]+)"/);
    
    if (!viewStateMatch || !eventValidationMatch) {
      return { success: false, error: "Could not extract form fields from page", stage: "parse" };
    }
    
    // Try to find the round dropdown/control and select the round
    const roundTarget = `ctl00$ContentPlaceHolder1$ddRunden`;
    
    const formData = new URLSearchParams({
      '__EVENTTARGET': roundTarget,
      '__EVENTARGUMENT': roundNumber.toString(),
      '__VIEWSTATE': viewStateMatch[1],
      '__VIEWSTATEGENERATOR': viewStateGenMatch ? viewStateGenMatch[1] : '',
      '__EVENTVALIDATION': eventValidationMatch[1],
    });
    
    const postResponse = await fetchWithRateLimit(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': url,
      },
      body: formData.toString(),
    });
    
    if (!postResponse.ok) {
      return { success: false, error: `Postback HTTP ${postResponse.status}`, stage: "fetch" };
    }
    
    const postHtml = await postResponse.text();
    
    // Parse the response HTML for pairings
    const round = parsePairingsFromHtml(postHtml, roundNumber);
    
    if (round.pairings.length === 0) {
      // Fallback: parse as single round
      return { success: true, data: { number: roundNumber, pairings: round.pairings } };
    }
    
    return { success: true, data: round };
  } catch (error) {
    return { 
      success: false, 
      error: `Postback failed: ${error instanceof Error ? error.message : String(error)}`, 
      stage: "fetch" 
    };
  }
}

function parsePairingsFromHtml(html: string, roundNumber: number): ScrapedRound {
  const pairings: ScrapedPairing[] = [];
  
  // Swiss-Manager pairing table format: board, white, black, result in 5 <td> cells
  const pairingPattern = /<tr[^>]*>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  
  for (const match of html.matchAll(pairingPattern)) {
    const board = parseInt(match[1]);
    if (isNaN(board)) continue;
    
    const whiteCell = match[2];
    const blackCell = match[3];
    const resultCell = match[5];
    
    // Extract text content
    const white = decodeHtmlEntities(whiteCell.replace(/<[^>]*>/g, '').trim());
    const black = decodeHtmlEntities(blackCell.replace(/<[^>]*>/g, '').trim());
    const result = decodeHtmlEntities(resultCell.replace(/<[^>]*>/g, '').trim());
    
    // Skip empty rows or header rows
    if (!white && !black) continue;
    if (white.toLowerCase().includes('white') || black.toLowerCase().includes('black')) continue;
    
    // Detect bye: player without opponent
    const isBye = !black || black === "0" || black.toLowerCase() === "bye" || black === "-";
    
    pairings.push({
      board,
      isBye,
      whitePlayer: isBye ? undefined : (white || undefined),
      blackPlayer: isBye ? undefined : (black || undefined),
      result: isBye ? "1" : (result || undefined), // Bye = 1 point
    });
  }
  
  // Fallback: simpler pattern if main pattern didn't match
  if (pairings.length === 0) {
    const simplePattern = /<tr[^>]*>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<\/tr>/gi;
    for (const match of html.matchAll(simplePattern)) {
      const board = parseInt(match[1]);
      if (isNaN(board)) continue;
      
      const white = decodeHtmlEntities(match[2].replace(/<[^>]*>/g, '').trim());
      const black = decodeHtmlEntities(match[3].replace(/<[^>]*>/g, '').trim());
      const result = decodeHtmlEntities(match[4].replace(/<[^>]*>/g, '').trim());
      
      if (!white && !black) continue;
      
      const isBye = !black || black === "0" || black.toLowerCase() === "bye";
      
      pairings.push({
        board,
        isBye,
        whitePlayer: isBye ? undefined : (white || undefined),
        blackPlayer: isBye ? undefined : (black || undefined),
        result: isBye ? "1" : (result || undefined),
      });
    }
  }
  
  return { number: roundNumber, pairings };
}

// ============================================================================
// Active Tournament Discovery
// ============================================================================

/**
 * Scrape list of active tournaments from federation page
 */
export async function scrapeActiveTournaments(): Promise<ScrapedTournament[]> {
  const url = `${BASE_URL}/fed.aspx?lan=1&fed=MTN`;
  
  try {
    const response = await fetchWithRateLimit(url);
    if (!response.ok) {
      console.error(`[SCRAPER] Failed to fetch tournament list: ${response.status}`);
      return [];
    }
    
    const html = await response.text();
    return parseTournamentList(html);
  } catch (error) {
    console.error("[SCRAPER] Failed to scrape tournament list:", error);
    return [];
  }
}

function parseTournamentList(html: string): ScrapedTournament[] {
  const tournaments: ScrapedTournament[] = [];
  
  const rowPattern = /<tr[^>]*class="CRg[12] MTN"[^>]*>([\s\S]*?)<\/tr>/gi;
  const matches = html.matchAll(rowPattern);
  
  for (const match of matches) {
    const rowHtml = match[1];
    
    const linkMatch = rowHtml.match(
      /href="https:\/\/chess-results\.com\/(tnr\d+)\.aspx\?lan=1"[^>]*>\s*([^<]+)\s*<\/a>/i
    );
    
    if (linkMatch) {
      const tnrId = linkMatch[1];
      const externalId = tnrId.replace('tnr', '');
      const name = decodeHtmlEntities(linkMatch[2].trim());
      const sourceUrl = `https://chess-results.com/${tnrId}.aspx?lan=1`;
      
      const statusMatch = rowHtml.match(/Class="p_(\d+)"/i);
      let status: TournamentStatus = "UPCOMING";
      if (statusMatch) {
        const statusCode = statusMatch[1];
        if (statusCode === "18") status = "ACTIVE";
        else if (statusCode === "5") status = "FINISHED";
        else if (statusCode === "17") status = "UPCOMING";
      }
      
      const durationMatch = rowHtml.match(/(\d+)\s*Days/i);
      const now = new Date();
      let startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      let endDate = now;
      
      if (durationMatch) {
        const daysAgo = parseInt(durationMatch[1], 10);
        startDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
        endDate = now;
      }
      
      tournaments.push({
        externalId,
        name,
        location: "Mauritania",
        startDate,
        endDate,
        status,
        playerCount: 0,
        sourceUrl,
      });
    }
  }
  
  return tournaments;
}

// Export singleton instance
export const chessResultsScraper = {
  fetchTournamentInfo,
  fetchStandings,
  fetchRoundPairings,
  scrapeActiveTournaments,
};
