import { TournamentStatus } from "@prisma/client";

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
  whitePlayer?: string;
  blackPlayer?: string;
  result?: string;
}

export class TournamentScraper {
  private baseUrl = "https://chess-results.com";

  async scrapeActiveTournaments(): Promise<ScrapedTournament[]> {
    try {
      const url = `${this.baseUrl}/fed.aspx?lan=1&fed=MTN`;
      
      console.log(`[CHESS_RESULTS] Scraping MTN tournaments from: ${url}`);

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });

      if (!response.ok) {
        console.error(`Chess-Results scrape failed: ${response.status}`);
        return [];
      }

      const html = await response.text();
      return this.parseTournamentList(html);
    } catch (error) {
      console.error("Failed to scrape tournaments:", error);
      return [];
    }
  }

  private parseTournamentList(html: string): ScrapedTournament[] {
    const tournaments: ScrapedTournament[] = [];

    // Match MTN tournament rows
    const rowPattern = /<tr[^>]*class="CRg[12] MTN"[^>]*>([\s\S]*?)<\/tr>/gi;
    const matches = html.matchAll(rowPattern);

    for (const match of matches) {
      const rowHtml = match[1];

      // Extract tournament name and link
      const linkMatch = rowHtml.match(
        /href="https:\/\/chess-results\.com\/(tnr\d+)\.aspx\?lan=1"[^>]*>\s*([^<]+)\s*<\/a>/i
      );

      const durationMatch = rowHtml.match(/(\d+)\s*Days/i);
      const statusMatch = rowHtml.match(/Class="p_(\d+)"/i);

      if (linkMatch) {
        const tnrId = linkMatch[1];
        const externalId = tnrId.replace('tnr', '');
        const name = this.decodeHtmlEntities(linkMatch[2].trim());
        const sourceUrl = `https://chess-results.com/${tnrId}.aspx?lan=1`;

        // Status codes: 17=UPCOMING, 18=ACTIVE, 5=FINISHED
        let status: TournamentStatus = "UPCOMING";
        if (statusMatch) {
          const statusCode = statusMatch[1];
          if (statusCode === "18") status = "ACTIVE";
          else if (statusCode === "5") status = "FINISHED";
          else if (statusCode === "17") status = "UPCOMING";
        }

        // Location not available on federation list page - default to Mauritania
        const location = "موريتانيا";

        // Default dates - will be updated when fetching tournament details
        const now = new Date();
        let startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        let endDate = now;

        if (durationMatch) {
          const daysAgo = parseInt(durationMatch[1], 10);
          startDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
          endDate = now;
        }

        tournaments.push({
          externalId,
          name,
          location,
          startDate,
          endDate,
          status,
          playerCount: 0,
          sourceUrl,
        });
      }
    }

    console.log(`[CHESS_RESULTS] Found ${tournaments.length} tournaments`);
    return tournaments;
  }

  private decodeHtmlEntities(text: string): string {
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

  private parseGermanDate(dateStr: string): Date {
    const parts = dateStr.split(/[\.\-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) {
        year += year > 50 ? 1900 : 2000;
      }
      return new Date(year, month, day);
    }
    return new Date();
  }

  /**
   * Scrape tournament details - handles ASP.NET postback for older tournaments
   */
  async scrapeTournamentDetails(externalId: string): Promise<{
    players: ScrapedPlayer[];
    rounds: ScrapedRound[];
    startDate?: Date;
    endDate?: Date;
  } | null> {
    try {
      const initialUrl = `${this.baseUrl}/tnr${externalId}.aspx?lan=1`;

      // First, get the initial page and extract VIEWSTATE
      const initialResponse = await fetch(initialUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!initialResponse.ok) {
        console.error(`Initial fetch failed: ${initialResponse.status}`);
        return null;
      }

      let html = await initialResponse.text();
      
      // Extract dates from the page
      const dates = this.extractTournamentDates(html);
      
      // Extract VIEWSTATE for postback
      const viewStateMatch = html.match(/id="__VIEWSTATE" value="([^"]+)"/);
      const viewStateGenMatch = html.match(/id="__VIEWSTATEGENERATOR" value="([^"]+)"/);
      const eventValidationMatch = html.match(/id="__EVENTVALIDATION" value="([^"]+)"/);
      
      // Check if we need to click "Show tournament details" for older tournaments
      let needsPostback = html.includes('cb_alleDetails') || html.includes('Show tournament details');
      
      // First parse players from initial page
      let players = this.parsePlayers(html);
      let rounds: ScrapedRound[] = [];
      
      // If tournament is older than 5 days OR no players found, try postback
      if (needsPostback || players.length === 0) {
        const viewState = viewStateMatch ? viewStateMatch[1] : "";
        const viewStateGen = viewStateGenMatch ? viewStateGenMatch[1] : "";
        const eventValidation = eventValidationMatch ? eventValidationMatch[1] : "";
        
        // Submit form to show all details
        const formData = new URLSearchParams({
          '__EVENTTARGET': '',
          '__EVENTARGUMENT': '',
          '__VIEWSTATE': viewState,
          '__VIEWSTATEGENERATOR': viewStateGen,
          '__EVENTVALIDATION': eventValidation,
          'cb_alleDetails': 'Show tournament details',
        });

        const postResponse = await fetch(initialUrl, {
          method: 'POST',
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": initialUrl,
          },
          body: formData.toString(),
        });

        if (postResponse.ok) {
          const postHtml = await postResponse.text();
          // Use postback result if it has more players
          const postbackPlayers = this.parsePlayers(postHtml);
          if (postbackPlayers.length > players.length) {
            players = postbackPlayers;
          }
          html = postHtml;
        }
      }
      
      // Try to extract rounds - check for LinkButton2 postback
      if (players.length > 0) {
        const roundPostback = await this.tryLoadRounds(initialUrl, html);
        if (roundPostback.length > 0) {
          rounds = roundPostback;
        }
      }
      
      // Fallback: try parsing rounds directly from current HTML
      if (rounds.length === 0) {
        rounds = this.parseRoundsFromTable(html);
      }
      
      return { players, rounds, ...dates };
    } catch (error) {
      console.error(`Failed to scrape tournament ${externalId}:`, error);
      return null;
    }
  }

  /**
   * Try to load rounds via ASP.NET postback
   */
  private async tryLoadRounds(url: string, html: string): Promise<ScrapedRound[]> {
    try {
      const viewStateMatch = html.match(/id="__VIEWSTATE" value="([^"]+)"/);
      const viewStateGenMatch = html.match(/id="__VIEWSTATEGENERATOR" value="([^"]+)"/);
      const eventValidationMatch = html.match(/id="__EVENTVALIDATION" value="([^"]+)"/);
      
      if (!viewStateMatch || !eventValidationMatch) {
        console.log('[SCRAPER] Missing VIEWSTATE or EVENTVALIDATION for rounds postback');
        return [];
      }
      
      const formData = new URLSearchParams({
        '__EVENTTARGET': 'ctl00$P1$LinkButton2',
        '__EVENTARGUMENT': '',
        '__VIEWSTATE': viewStateMatch[1],
        '__VIEWSTATEGENERATOR': viewStateGenMatch ? viewStateGenMatch[1] : '',
        '__EVENTVALIDATION': eventValidationMatch[1],
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": url,
        },
        body: formData.toString(),
      });

      if (response.ok) {
        const roundHtml = await response.text();
        const rounds = this.parseRoundsFromTable(roundHtml);
        console.log(`[SCRAPER] Loaded ${rounds.length} rounds via postback`);
        return rounds;
      } else {
        console.log(`[SCRAPER] Rounds postback failed with status ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to load rounds via postback:', error);
    }
    return [];
  }

  private parsePlayers(html: string): ScrapedPlayer[] {
    const players: ScrapedPlayer[] = [];
    const seenNames = new Set<string>();
    
    // Try multiple patterns for player rows
    const patterns = [
      // Pattern 1: CRg1/CRg2 class rows with full row content
      /<tr[^>]*class="CRg[12][^"]*"[^>]*>([\s\S]*?)<\/tr>/gi,
      // Pattern 2: Any row with rank number in CRc cell
      /<tr[^>]*>([\s\S]*?)<td[^>]*class="CRc"[^>]*>(\d+)<\/td>([\s\S]*?)<\/tr>/gi,
    ];

    for (const pattern of patterns) {
      const matches = [...html.matchAll(pattern)];
      for (const match of matches) {
        let rowHtml: string;
        let rank: number;
        
        if (pattern.source.includes('CRc')) {
          // Pattern 2: rank is in match[2]
          const maybeRank = parseInt(match[2], 10);
          if (isNaN(maybeRank) || maybeRank <= 0) continue;
          rank = maybeRank;
          rowHtml = match[1] + match[3];
        } else {
          // Pattern 1: extract rank from first cell
          rowHtml = match[1];
          const rankMatch = rowHtml.match(/<td[^>]*class="CRc"[^>]*>([\s\S]*?)<\/td>/i);
          if (!rankMatch) continue;
          const maybeRank = parseInt(rankMatch[1].replace(/<[^>]*>/g, '').trim(), 10);
          if (isNaN(maybeRank) || maybeRank <= 0) continue;
          rank = maybeRank;
        }
        
        // Skip header rows
        if (rowHtml.includes('<th') || rowHtml.includes('>No.<') || rowHtml.includes('>Name<')) continue;
        
        // Extract player name - multiple patterns to catch different HTML formats
        let name = "";
        const namePatterns = [
          // Standard: <td class="CR">LastName, FirstName</td>
          /<td[^>]*class="CR"[^>]*>\s*([^<,]+),\s*([^<]+)\s*<\/td>/i,
          // With link: <td class="CR"><a>Name</a></td>
          /<td[^>]*class="CR"[^>]*>\s*<a[^>]*>([^<]+)<\/a>\s*<\/td>/i,
          // Generic td: <td>LastName, FirstName</td>
          /<td[^>]*>\s*([^<,]+),\s*([^<]+)\s*<\/td>/i,
        ];
        
        for (const namePattern of namePatterns) {
          const nameMatch = rowHtml.match(namePattern);
          if (nameMatch && nameMatch[1]) {
            // Handle both "LastName, FirstName" and "<a>LastName, FirstName</a>" formats
            const lastName = nameMatch[1].replace(/<[^>]*>/g, '').trim();
            const firstName = nameMatch[2] ? nameMatch[2].replace(/<[^>]*>/g, '').trim() : '';
            name = `${lastName}, ${firstName}`;
            name = this.decodeHtmlEntities(name);
            break;
          }
        }
        
        if (!name || name.length < 3) continue;
        if (seenNames.has(name.toLowerCase())) continue;
        seenNames.add(name.toLowerCase());
        
        // Extract FIDE ID
        const fideMatch = rowHtml.match(/fide\.com\/profile\/(\d+)/);
        
        // Extract rating from CRr class cell (rating column)
        const ratingMatch = rowHtml.match(/class="CRr"[^>]*>([^<]+)<\/td>/i);
        let rating: number | undefined;
        if (ratingMatch) {
          const maybeRating = parseInt(ratingMatch[1].trim(), 10);
          if (!isNaN(maybeRating) && maybeRating > 0) {
            rating = maybeRating;
          }
        }
        
        // Extract points from CRp class cell (handle both "1.5" and "1&#160;1/2" formats)
        let points: number | undefined;
        const pointsMatch = rowHtml.match(/<td[^>]*class="CRp"[^>]*>([\s\S]*?)<\/td>/i);
        if (pointsMatch) {
          const pointsStr = pointsMatch[1].replace(/<[^>]*>/g, '').replace(/&#160;/g, ' ').trim();
          // Handle fractional points like "1 1/2" or "1½"
          if (pointsStr.includes('½')) {
            points = parseFloat(pointsStr.replace('½', '.5')) || undefined;
          } else if (pointsStr.includes('/')) {
            const parts = pointsStr.split(' ');
            let total = 0;
            for (const part of parts) {
              if (part.includes('/')) {
                const [num, den] = part.split('/');
                total += parseInt(num) / parseInt(den);
              } else {
                total += parseFloat(part) || 0;
              }
            }
            points = total > 0 ? total : undefined;
          } else {
            points = parseFloat(pointsStr);
            if (isNaN(points)) points = undefined;
          }
        }
        
        // Extract Buchholz from CRb class cell
        let tiebreak1: number | undefined;
        const buchholzMatch = rowHtml.match(/<td[^>]*class="CRb"[^>]*>([\s\S]*?)<\/td>/i);
        if (buchholzMatch) {
          const buchholzStr = buchholzMatch[1].replace(/<[^>]*>/g, '').trim();
          tiebreak1 = parseFloat(buchholzStr);
          if (isNaN(tiebreak1)) tiebreak1 = undefined;
        }
        
        // Extract SB (Sonneborn-Berger) from CRs class cell
        let tiebreak2: number | undefined;
        const sbMatch = rowHtml.match(/<td[^>]*class="CRs"[^>]*>([\s\S]*?)<\/td>/i);
        if (sbMatch) {
          const sbStr = sbMatch[1].replace(/<[^>]*>/g, '').trim();
          tiebreak2 = parseFloat(sbStr);
          if (isNaN(tiebreak2)) tiebreak2 = undefined;
        }
        
        // Debug logging for players with missing data
        if (name && (points === undefined || tiebreak1 === undefined || tiebreak2 === undefined)) {
          console.log(`[SCRAPER_DEBUG] Player "${name}" has missing data:`, {
            points: points === undefined ? 'MISSING' : points,
            tiebreak1: tiebreak1 === undefined ? 'MISSING' : tiebreak1,
            tiebreak2: tiebreak2 === undefined ? 'MISSING' : tiebreak2,
            rawPointsMatch: pointsMatch ? pointsMatch[1].substring(0, 50) : null,
            rawBuchholzMatch: buchholzMatch ? buchholzMatch[1].substring(0, 50) : null,
            rawSbMatch: sbMatch ? sbMatch[1].substring(0, 50) : null,
          });
        }
        
        players.push({
          name,
          fideId: fideMatch ? fideMatch[1] : undefined,
          seed: undefined,
          points,
          tiebreak1,
          tiebreak2,
          rank,
          rating,
        });
      }
      
      if (players.length > 0) break;
    }
    
    // Deduplicate
    const seen = new Set<string>();
    return players.filter(p => {
      const key = `${p.name}|${p.rank}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private parseRounds(html: string): ScrapedRound[] {
    return this.parseRoundsFromTable(html);
  }

  private parseRoundsFromTable(html: string): ScrapedRound[] {
    const rounds: ScrapedRound[] = [];
    
    // Look for round headers
    const roundHeaderPattern = /(?:Round|Runde|Runde[\s]+[\d]+|Rd\.?\s*\d+)[\s:.]*(\d+)/gi;
    const headerMatches = [...html.matchAll(roundHeaderPattern)];
    
    console.log(`[SCRAPER] Found ${headerMatches.length} round headers in HTML`);
    
    if (headerMatches.length === 0) {
      // No explicit headers - check for pairing table structure
      const pairings = this.parsePairingsFromTable(html);
      if (pairings.length > 0) {
        console.log(`[SCRAPER] No round headers, found ${pairings.length} pairings in initial table`);
        rounds.push({ number: 1, pairings });
      } else {
        console.log(`[SCRAPER] No round headers and no pairings found`);
      }
      return rounds;
    }
    
    for (let i = 0; i < headerMatches.length; i++) {
      const roundNum = parseInt(headerMatches[i][1], 10);
      const startIdx = headerMatches[i].index!;
      const endIdx = i + 1 < headerMatches.length ? headerMatches[i + 1].index! : html.length;
      const roundSection = html.slice(startIdx, endIdx);
      
      const pairings = this.parsePairingsFromTable(roundSection);
      if (pairings.length > 0) {
        rounds.push({ number: roundNum, pairings });
      }
    }
    
    return rounds;
  }

  private parsePairings(html: string): ScrapedPairing[] {
    return this.parsePairingsFromTable(html);
  }

  /**
   * Extract tournament start and end dates from the page
   * Looks for patterns like "from 01.06.2026 to 03.06.2026" or "01.06.2026 - 03.06.2026"
   */
  private extractTournamentDates(html: string): { startDate?: Date; endDate?: Date } {
    // Try to find date range patterns
    // Pattern 1: "from DD.MM.YYYY to DD.MM.YYYY" or "vom DD.MM.YYYY bis DD.MM.YYYY"
    const rangeMatch = html.match(/(?:from|vom|from)\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*(?:to|bis|\-)\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
    if (rangeMatch) {
      const start = this.parseGermanDate(rangeMatch[1]);
      const end = this.parseGermanDate(rangeMatch[2]);
      return { startDate: start, endDate: end };
    }
    
    // Pattern 2: Look for date spans near "Erstellt" or "Created" or standalone dates
    // Find all DD.MM.YYYY dates and use first and last
    const dateMatches = [...html.matchAll(/(\d{1,2}\.\d{1,2}\.\d{4})/g)];
    if (dateMatches.length >= 2) {
      // Filter out server time (current date) - usually the most recent
      const dates = dateMatches
        .map(m => this.parseGermanDate(m[1]))
        .filter(d => !isNaN(d.getTime()) && d.getFullYear() > 2020 && d.getFullYear() < 2030);
      
      if (dates.length >= 2) {
        return { 
          startDate: dates[0], 
          endDate: dates[dates.length - 1] 
        };
      }
    }
    
    // Pattern 3: Single date like "01.06.2026" 
    const singleDateMatch = html.match(/erstellt|Created|Anfang|Beginn/i);
    if (singleDateMatch) {
      const firstDateMatch = html.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
      if (firstDateMatch) {
        const date = this.parseGermanDate(firstDateMatch[1]);
        return { startDate: date, endDate: date };
      }
    }
    
    return {};
  }

  private parsePairingsFromTable(html: string): ScrapedPairing[] {
    const pairings: ScrapedPairing[] = [];
    
    // Swiss-Manager pairing table format: board, white, black, result in 5 <td> cells
    // Pattern captures: [1]=board, [2]=white, [3]=black, [4]=white_pts, [5]=result
    const pairingPattern = /<tr[^>]*>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
    
    for (const match of html.matchAll(pairingPattern)) {
      const board = parseInt(match[1], 10);
      if (isNaN(board)) continue;
      
      // Extract text content from each cell (may contain links, formatting)
      const white = this.decodeHtmlEntities(match[2].replace(/<[^>]*>/g, '').trim());
      const black = this.decodeHtmlEntities(match[3].replace(/<[^>]*>/g, '').trim());
      const result = this.decodeHtmlEntities(match[5].replace(/<[^>]*>/g, '').trim());
      
      // Skip empty rows or header rows
      if (!white && !black) continue;
      if (white.toLowerCase().includes('white') || black.toLowerCase().includes('black')) continue;
      
      pairings.push({
        board,
        whitePlayer: white || undefined,
        blackPlayer: black || undefined,
        result: result || undefined,
      });
    }
    
    // Fallback: try simpler pattern if no results from main pattern
    if (pairings.length === 0) {
      const simplePattern = /<tr[^>]*>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<td[^>]*>\s*([\s\S]*?)\s*<\/td>\s*<\/tr>/gi;
      for (const match of html.matchAll(simplePattern)) {
        const board = parseInt(match[1], 10);
        if (isNaN(board)) continue;
        
        const white = this.decodeHtmlEntities(match[2].replace(/<[^>]*>/g, '').trim());
        const black = this.decodeHtmlEntities(match[3].replace(/<[^>]*>/g, '').trim());
        const result = this.decodeHtmlEntities(match[4].replace(/<[^>]*>/g, '').trim());
        
        if (!white && !black) continue;
        
        pairings.push({
          board,
          whitePlayer: white || undefined,
          blackPlayer: black || undefined,
          result: result || undefined,
        });
      }
    }
    
    return pairings;
  }
}

export const tournamentScraper = new TournamentScraper();
