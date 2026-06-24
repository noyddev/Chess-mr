import { TournamentStatus } from "@prisma/client";

export interface ScrapedTournament {
  externalId: string;
  name: string;
  location: string;
  startDate: Date;
  endDate: Date;
  status: TournamentStatus;
  playerCount: number;
}

export interface ScrapedPlayer {
  name: string;
  federation?: string;
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
  private baseUrl = "https://www.chess-results.com";

  /**
   * Scrape active tournaments from Chess-Results for Mauritania
   * This uses the Chess-Results pagination system
   * Federation code: MTN (Mauritania)
   */
  async scrapeActiveTournaments(): Promise<ScrapedTournament[]> {
    try {
      // Chess-Results uses a specific URL pattern for federations
      // MTN = Mauritania FIDE federation code
      const url = `${this.baseUrl}/tnrarrer.aspx?From=R&Fed=MTN&Flag=h`;
      
      console.log(`[CHESS_RESULTS] Scraping tournaments from: ${url}`);

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

  /**
   * Parse tournament list from Chess-Results HTML
   */
  private parseTournamentList(html: string): ScrapedTournament[] {
    const tournaments: ScrapedTournament[] = [];

    // Chess-Results tournament entries are typically in table rows
    // Pattern: <tr class="CRg"> or <tr class="CRg1">
    const rowPattern =
      /<tr[^>]*class="CRg\d?"[^>]*>([\s\S]*?)<\/tr>/gi;
    const matches = html.matchAll(rowPattern);

    for (const match of matches) {
      const rowHtml = match[1];

      // Extract tournament name and link
      const nameMatch = rowHtml.match(
        /<a[^>]*href=" tournamentDetail\.aspx\?TournamentID=(\d+)"[^>]*>([^<]+)<\/a>/i
      );
      const linkMatch = rowHtml.match(
        /href="(tournamentDetail\.aspx\?TournamentID=\d+)"[^>]*>([^<]+)<\/a>/i
      );

      // Extract dates - typically in format DD.MM.YYYY or similar
      const dateMatch = rowHtml.match(
        /(\d{1,2}[\.\-]\d{1,2}[\.\-]\d{2,4})/g
      );

      // Extract location
      const locationMatch = rowHtml.match(/<td[^>]*>([^<]+)<\/td>/gi);

      if (nameMatch || linkMatch) {
        const name = nameMatch
          ? nameMatch[2].trim()
          : linkMatch
          ? linkMatch[2].trim()
          : "Unknown";
        const externalId = nameMatch
          ? nameMatch[1]
          : linkMatch
          ? linkMatch[1].match(/\d+/)?.[0] || "0"
          : "0";

        // Parse dates
        let startDate = new Date();
        let endDate = new Date();
        if (dateMatch && dateMatch.length >= 2) {
          startDate = this.parseGermanDate(dateMatch[0]);
          endDate = this.parseGermanDate(dateMatch[1]);
        }

        // Extract location from table cells
        let location = "موريتانيا";
        if (locationMatch && locationMatch.length > 1) {
          location = locationMatch[1].replace(/<[^>]+>/g, "").trim() || location;
        }

        // Determine status based on dates
        const now = new Date();
        let status: TournamentStatus = "UPCOMING";
        if (now >= startDate && now <= endDate) {
          status = "ACTIVE";
        } else if (now > endDate) {
          status = "FINISHED";
        }

        tournaments.push({
          externalId,
          name,
          location,
          startDate,
          endDate,
          status,
          playerCount: 0, // Will be updated when scraping details
        });
      }
    }

    return tournaments;
  }

  /**
   * Parse German date format (DD.MM.YYYY) to Date
   */
  private parseGermanDate(dateStr: string): Date {
    // Handle DD.MM.YYYY or DD-MM-YYYY formats
    const parts = dateStr.split(/[\.\-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
      let year = parseInt(parts[2], 10);
      
      // Handle 2-digit years
      if (year < 100) {
        year += year > 50 ? 1900 : 2000;
      }

      return new Date(year, month, day);
    }
    return new Date();
  }

  /**
   * Scrape detailed tournament data
   */
  async scrapeTournamentDetails(externalId: string): Promise<{
    players: ScrapedPlayer[];
    rounds: ScrapedRound[];
  } | null> {
    try {
      const url = `${this.baseUrl}/tournamentDetail.aspx?TournamentID=${externalId}`;

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

  /**
   * Parse player list from tournament detail page
   */
  private parsePlayers(html: string): ScrapedPlayer[] {
    const players: ScrapedPlayer[] = [];

    // Player rows in Chess-Results are typically in a table with class "VRg"
    const rowPattern = /<tr[^>]*class="VRg\d?"[^>]*>([\s\S]*?)<\/tr>/gi;
    const matches = html.matchAll(rowPattern);

    for (const match of matches) {
      const rowHtml = match[1];

      // Extract player name
      const nameMatch = rowHtml.match(/<a[^>]*>([^<]+)<\/a>/i);

      // Extract seeding
      const seedMatch = rowHtml.match(/<td[^>]*>(\d+)<\/td>/);

      // Extract points
      const pointsMatch = rowHtml.match(/Pts[:\s]*(\d+[\.,]\d+)/i);

      // Extract rank
      const rankMatch = rowHtml.match(/<b>(\d+)<\/b>/);

      if (nameMatch) {
        players.push({
          name: nameMatch[1].trim(),
          seed: seedMatch ? parseInt(seedMatch[1], 10) : undefined,
          points: pointsMatch
            ? parseFloat(pointsMatch[1].replace(",", "."))
            : undefined,
          rank: rankMatch ? parseInt(rankMatch[1], 10) : undefined,
        });
      }
    }

    return players;
  }

  /**
   * Parse rounds and pairings from tournament detail page
   */
  private parseRounds(html: string): ScrapedRound[] {
    const rounds: ScrapedRound[] = [];

    // Round sections are typically marked with headers
    const roundPattern =
      /<h[23][^>]*>[\s]*Round\s*(\d+)[\s]*(<[^>]*>.*?<\/[^>]*>)?[\s]*<\/h[23]>/gi;
    const roundMatches = html.matchAll(roundPattern);

    for (const roundMatch of roundMatches) {
      const roundNumber = parseInt(roundMatch[1], 10);

      // Find pairings after this round header
      const startIndex = roundMatch.index! + roundMatch[0].length;
      const nextRoundMatch = Array.from(
        html.matchAll(roundPattern)
      ).find((m) => m.index! > startIndex);
      const endIndex = nextRoundMatch
        ? nextRoundMatch.index!
        : html.length;

      const roundHtml = html.slice(startIndex, endIndex);
      const pairings = this.parsePairings(roundHtml);

      rounds.push({
        number: roundNumber,
        pairings,
      });
    }

    return rounds;
  }

  /**
   * Parse pairings from a round section
   */
  private parsePairings(html: string): ScrapedPairing[] {
    const pairings: ScrapedPairing[] = [];

    // Pairing rows are typically in tables with board numbers
    const pairingPattern =
      /<tr[^>]*>([\s\S]*?)<td[^>]*>(\d+)<\/td>([\s\S]*?)<\/tr>/gi;

    for (const match of html.matchAll(pairingPattern)) {
      const boardNum = parseInt(match[2], 10);
      const rowHtml = match[1] + match[3];

      // Extract white player
      const whiteMatch = rowHtml.match(/<td[^>]*>([^<]+)<\/td>/i);

      // Extract result
      const resultMatch = rowHtml.match(
        /<(?:b|strong)[^>]*>(1[\-/]2|1|0)<\s*[\-/]\s*(1[\-/]2|1|0|)><\/(?:b|strong)>/i
      );

      // Extract black player (second player name)
      const blackMatch = rowHtml.match(
        /<td[^>]*>\s*<a[^>]*>[^<]+<\/a>\s*<\/td>\s*<td[^>]*>([^<]+)<\/td>/i
      );

      if (whiteMatch) {
        pairings.push({
          board: boardNum,
          whitePlayer: whiteMatch[1].trim(),
          blackPlayer: blackMatch ? blackMatch[1].trim() : undefined,
          result: resultMatch ? `${resultMatch[1]}-${resultMatch[2]}` : undefined,
        });
      }
    }

    return pairings;
  }
}

export const tournamentScraper = new TournamentScraper();
