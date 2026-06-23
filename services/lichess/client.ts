import type { LichessUser, LichessUserStatus } from "./types";

const LICHESS_API_BASE = "https://lichess.org/api";

// Rate limits: with token = 60/min, without token = 20/min
const RATE_LIMIT_DELAY = process.env.LICHESS_TOKEN ? 1000 : 3000; 

let lastRequestTime = 0;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  
  if (process.env.LICHESS_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.LICHESS_TOKEN}`;
  }
  
  return headers;
}

async function rateLimitedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise((resolve) =>
      setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
    );
  }
  
  lastRequestTime = Date.now();
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  });
  
  return response;
}

export class LichessClient {
  private hasToken: boolean;

  constructor() {
    this.hasToken = !!process.env.LICHESS_TOKEN;
    console.log(`Lichess client initialized (token: ${this.hasToken ? "yes" : "no"})`);
  }

  /**
   * Get user public data by username
   * GET /api/user/{username}
   */
  async getUser(username: string): Promise<LichessUser | null> {
    try {
      const response = await rateLimitedFetch(
        `${LICHESS_API_BASE}/user/${username}`
      );

      if (response.status === 404) {
        return null;
      }

      if (response.status === 429) {
        // Rate limited, wait and retry
        console.warn("Lichess rate limited, waiting 60s...");
        await new Promise((resolve) => setTimeout(resolve, 60000));
        return this.getUser(username);
      }

      if (!response.ok) {
        throw new Error(`Lichess API error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error(`Failed to fetch user ${username}:`, error);
      return null;
    }
  }

  /**
   * Get real-time users status
   * GET /api/users/status?ids=...
   */
  async getUsersStatus(
    usernames: string[]
  ): Promise<LichessUserStatus[]> {
    try {
      const ids = usernames.join(",");
      const response = await rateLimitedFetch(
        `${LICHESS_API_BASE}/users/status?ids=${ids}`
      );

      if (!response.ok) {
        throw new Error(`Lichess API error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("Failed to fetch users status:", error);
      return [];
    }
  }

  /**
   * Get users by IDs (usernames)
   * POST /api/users
   * 
   * With token: 60 requests/min, 30 users/batch
   * Without token: 20 requests/min, 10 users/batch
   */
  async getUsers(usernames: string[]): Promise<LichessUser[]> {
    try {
      // With token we can batch 30 users, without token only 10
      const batchSize = this.hasToken ? 30 : 10;
      const results: LichessUser[] = [];

      for (let i = 0; i < usernames.length; i += batchSize) {
        const batch = usernames.slice(i, i + batchSize);
        
        const response = await rateLimitedFetch(`${LICHESS_API_BASE}/users`, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            Accept: "application/x-ndjson",
            ...(this.hasToken ? { Authorization: `Bearer ${process.env.LICHESS_TOKEN}` } : {}),
          },
          body: batch.join("\n"),
        });

        if (!response.ok) {
          throw new Error(`Lichess API error: ${response.status}`);
        }

        const text = await response.text();
        const lines = text.trim().split("\n");
        
        results.push(...lines.map((line) => JSON.parse(line)).filter(Boolean));
      }
      
      return results;
    } catch (error) {
      console.error("Failed to fetch users:", error);
      return [];
    }
  }

  /**
   * Get rating history of a user
   * GET /api/user/{username}/rating-history
   */
  async getRatingHistory(username: string): Promise<unknown[]> {
    try {
      const response = await rateLimitedFetch(
        `${LICHESS_API_BASE}/user/${username}/rating-history`
      );

      if (!response.ok) {
        throw new Error(`Lichess API error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error(`Failed to fetch rating history for ${username}:`, error);
      return [];
    }
  }

  /**
   * Extract ratings from Lichess user data
   */
  extractRatings(user: LichessUser): {
    rapid: number | null;
    blitz: number | null;
    classical: number | null;
    title: string | null;
  } {
    return {
      rapid: user.perfs.rapid?.rating || null,
      blitz: user.perfs.blitz?.rating || null,
      classical: user.perfs.classical?.rating || null,
      title: user.title || null,
    };
  }
}

export const lichessClient = new LichessClient();
