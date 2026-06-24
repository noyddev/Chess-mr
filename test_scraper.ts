import { tournamentScraper } from "./services/scraper/chess-results";

async function test() {
  console.log("Testing scraper...");
  const result = await tournamentScraper.scrapeTournamentDetails("16349994");
  console.log(JSON.stringify(result, null, 2));
}
test().catch(console.error);
