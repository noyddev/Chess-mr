import { TournamentStatus } from "@prisma/client";

export interface ScrapedTournament {
  externalId: string;
  name: string;
  location: string;
  startDate: Date;
  endDate: Date;
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

        let status: TournamentStatus = "UPCOMING";
        if (statusMatch) {
          const statusCode = statusMatch[1];
          if (statusCode === "18") status = "ACTIVE";
          else if (statusCode === "5") status = "FINISHED";
        }

        // Location not available on federation list page - default to Mauritania
        const location = "موريتانيا";

        const now = new Date();
        let startDate = new Date();
        let endDate = new Date();
        
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

  async scrapeTournamentDetails(externalId: string): Promise<{
    players: ScrapedPlayer[];
    rounds: ScrapedRound[];
  } | null> {
    try {
      const url = `${this.baseUrl}/tnr${externalId}.aspx?lan=1`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        return null;
      }

      const html = await response.text();
      return {
        players: this.parsePlayers(html),
        rounds: this.parseRounds(html),
      };
    } catch (error) {
      console.error(`Failed to scrape tournament ${externalId}:`, error);
      return null;
    }
  }

  private parsePlayers(html: string): ScrapedPlayer[] {
    const players: ScrapedPlayer[] = [];
    // Chess-Results uses CRg1/CRg2 classes for player rows (not VRg)
    // Pattern: <tr class="CRg1 MTN"><td class="CRc">rank</td><td class="CR"></td><td class="CR">Name</td>...
    const rowPattern = /<tr[^>]*class="CRg[12](?:\s+[^"]*)?"[^>]*>([\s\S]*?)<\/tr>/gi;
    const matches = html.matchAll(rowPattern);

    for (const match of matches) {
      const rowHtml = match[1];
      
      // Skip header rows
      if (rowHtml.includes('<th') || rowHtml.includes('No.') || rowHtml.includes('Name')) {
        continue;
      }
      
      // Extract all <td> cells (must use [\s\S] to capture HTML inside)
      const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
      
      if (cells.length < 4) continue;
      
      // Structure: [rank, empty, name, fideId, fed, rating]
      const rankCell = cells[0]?.[1] || "";
      const nameCell = cells[2]?.[1] || "";
      const fideCell = cells[3]?.[1] || "";
      const ratingCell = cells[5]?.[1] || "";
      
      const rank = parseInt(rankCell, 10);
      const rating = parseInt(ratingCell, 10);
      const name = nameCell.trim();
      
      if (name && !name.match(/^(No\.?|Name|FIDE|Fed|Rtg|Points|Pts)$/i) && rank > 0) {
        // Extract FIDE ID from anchor tag or plain text
        const fideMatch = fideCell.match(/profile\/(\d+)/) || fideCell.match(/(\d{6,})/);
        players.push({
          name: this.decodeHtmlEntities(name),
          fideId: fideMatch ? fideMatch[1] : undefined,
          seed: undefined,
          points: undefined,
          rank: rank,
        });
      }
    }
    return players;
  }

  private parseRounds(html: string): ScrapedRound[] {
    const rounds: ScrapedRound[] = [];
    const roundPattern = /<h[23][^>]*>[\s]*Round\s*(\d+)[\s]*(<[^>]*>.*?<\/[^>]*>)?[\s]*<\/h[23]>/gi;
    const roundMatches = html.matchAll(roundPattern);

    for (const roundMatch of roundMatches) {
      const roundNumber = parseInt(roundMatch[1], 10);
      const startIndex = roundMatch.index! + roundMatch[0].length;
      const nextRoundMatch = Array.from(html.matchAll(roundPattern)).find((m) => m.index! > startIndex);
      const endIndex = nextRoundMatch ? nextRoundMatch.index! : html.length;
      const roundHtml = html.slice(startIndex, endIndex);
      const pairings = this.parsePairings(roundHtml);
      rounds.push({ number: roundNumber, pairings });
    }
    return rounds;
  }

  private parsePairings(html: string): ScrapedPairing[] {
    const pairings: ScrapedPairing[] = [];
    const pairingPattern = /<tr[^>]*>([\s\S]*?)<td[^>]*>(\d+)<\/td>([\s\S]*?)<\/tr>/gi;

    for (const match of html.matchAll(pairingPattern)) {
      const boardNum = parseInt(match[2], 10);
      const rowHtml = match[1] + match[3];
      const whiteMatch = rowHtml.match(/<td[^>]*>([^<]+)<\/td>/i);
      const resultMatch = rowHtml.match(/<(?:b|strong)[^>]*>(1[\-/]2|1|0)<\s*[\-/]\s*(1[\-/]2|1|0|)><\/(?:b|strong)>/i);
      const blackMatch = rowHtml.match(/<td[^>]*>\s*<a[^>]*>[^<]+<\/a>\s*<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);

      if (whiteMatch) {
        pairings.push({
          board: boardNum,
          whitePlayer: this.decodeHtmlEntities(whiteMatch[1].trim()),
          blackPlayer: blackMatch ? this.decodeHtmlEntities(blackMatch[1].trim()) : undefined,
          result: resultMatch ? `${resultMatch[1]}-${resultMatch[2]}` : undefined,
        });
      }
    }
    return pairings;
  }
}

export const tournamentScraper = new TournamentScraper();
