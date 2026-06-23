import type { LichessUser, LichessUserStatus } from "./types";

const LICHESS_API_BASE = "https://lichess.org/api";

const RATE_LIMIT_DELAY = 1100; // 1 request per second

let lastRequestTime = 0;

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
      Accept: "application/json",
      ...options.headers,
    },
  });
  
  return response;
}

export class LichessClient {
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
   */
  async getUsers(usernames: string[]): Promise<LichessUser[]> {
    try {
      const response = await rateLimitedFetch(`${LICHESS_API_BASE}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          Accept: "application/x-ndjson",
        },
        body: usernames.join("\n"),
      });

      if (!response.ok) {
        throw new Error(`Lichess API error: ${response.status}`);
      }

      const text = await response.text();
      const lines = text.trim().split("\n");
      
      return lines.map((line) => JSON.parse(line)).filter(Boolean);
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
