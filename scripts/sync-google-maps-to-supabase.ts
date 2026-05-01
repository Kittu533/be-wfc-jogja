import "dotenv/config";
import fsp from "node:fs/promises";
import { paths } from "../src/config/paths";
import { readPlaces, toGoogleMapsSeedPlaces, writePlaces } from "../src/repositories/place.repository";
import type { GoogleMapsScrapeFile } from "../src/types/domain";

async function main() {
  const raw = await fsp.readFile(paths.googleMapsScrapePath, "utf8");
  const scrape = JSON.parse(raw) as GoogleMapsScrapeFile;
  const googlePlaces = toGoogleMapsSeedPlaces(scrape);
  const existing = await readPlaces();
  const googleIds = new Set(googlePlaces.map((place) => place.id));
  const merged = [...googlePlaces, ...existing.filter((place) => !googleIds.has(place.id))];

  await writePlaces(merged);

  console.log(
    JSON.stringify(
      {
        syncedGoogleMapsPlaces: googlePlaces.length,
        previousTotal: existing.length,
        mergedTotal: merged.length,
        query: scrape.query,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
