import path from "node:path";

const rootDir = process.cwd();

export const paths = {
  rootDir,
  dataDir: path.join(rootDir, "data"),
  uploadDir: path.join(rootDir, "uploads"),
  placesPath: path.join(rootDir, "data", "places.json"),
  googleMapsScrapePath: path.join(rootDir, "data", "google-maps-scrape.json"),
};
