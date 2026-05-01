import fsp from "node:fs/promises";
import { paths } from "../config/paths";
import { toAdminPlaceFromGoogleMapsCandidate } from "../mappers/google-maps-import.mapper";
import { readPlaces, writePlaces } from "../repositories/place.repository";
import type { GoogleMapsImportCandidate, GoogleMapsScrapeCandidate, GoogleMapsScrapeFile } from "../types/domain";
import { HttpError } from "../utils/http-error";
import { slugify } from "../utils/slugify";

type GoogleMapsImportPayload = {
  mapsUrl?: string;
  name?: string;
};

export async function getGoogleMapsImportCandidates(): Promise<{
  query: string;
  source: string;
  sourceUrl: string;
  scrapedAt: string;
  items: GoogleMapsImportCandidate[];
  total: number;
}> {
  const scrape = await readGoogleMapsScrapeFile();
  const existingPlaces = await readPlaces();

  const items = scrape.places.map((candidate) => {
    const existing = existingPlaces.find(
      (place) => place.mapsUrl === candidate.maps_url || place.slug === slugify(candidate.name),
    );

    return {
      ...candidate,
      alreadyImported: Boolean(existing),
      importedPlaceId: existing?.id ?? "",
      importedSlug: existing?.slug ?? "",
    };
  });

  return {
    query: scrape.query,
    source: scrape.source,
    sourceUrl: scrape.source_url,
    scrapedAt: scrape.scraped_at,
    items,
    total: items.length,
  };
}

export async function importGoogleMapsCandidate(payload: GoogleMapsImportPayload): Promise<{
  created: boolean;
  item: ReturnType<typeof toAdminPlaceFromGoogleMapsCandidate>;
}> {
  const scrape = await readGoogleMapsScrapeFile();
  const candidate = findCandidate(scrape.places, payload);

  if (!candidate) {
    throw new HttpError(404, "Google Maps candidate not found");
  }

  const places = await readPlaces();
  const existing = places.find((place) => place.mapsUrl === candidate.maps_url || place.slug === slugify(candidate.name));

  if (existing) {
    return { created: false, item: existing };
  }

  const place = toAdminPlaceFromGoogleMapsCandidate(candidate, places.length);
  places.unshift(place);
  await writePlaces(places);

  return { created: true, item: place };
}

async function readGoogleMapsScrapeFile(): Promise<GoogleMapsScrapeFile> {
  let raw: string;

  try {
    raw = await fsp.readFile(paths.googleMapsScrapePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        query: "",
        source: "google_maps_html",
        source_url: "",
        limit: 0,
        scraped_at: "",
        places: [],
      };
    }

    throw error;
  }

  const parsed = JSON.parse(raw) as Partial<GoogleMapsScrapeFile>;

  return {
    query: parsed.query ?? "",
    source: parsed.source ?? "google_maps_html",
    source_url: parsed.source_url ?? "",
    limit: Number(parsed.limit ?? 0),
    scraped_at: parsed.scraped_at ?? "",
    places: Array.isArray(parsed.places) ? parsed.places.map(normalizeCandidate).filter(Boolean) : [],
  };
}

function normalizeCandidate(candidate: Partial<GoogleMapsScrapeCandidate>): GoogleMapsScrapeCandidate {
  return {
    name: String(candidate.name ?? "").trim(),
    maps_url: String(candidate.maps_url ?? "").trim(),
    rating: String(candidate.rating ?? "").trim(),
    category: String(candidate.category ?? "").trim(),
    price_level: String(candidate.price_level ?? "").trim(),
    address: String(candidate.address ?? "").trim(),
    lat: String(candidate.lat ?? "").trim(),
    lng: String(candidate.lng ?? "").trim(),
    review_count: String(candidate.review_count ?? "").trim(),
    is_open: String(candidate.is_open ?? "").trim(),
    closes_at: String(candidate.closes_at ?? "").trim(),
    opens_at: String(candidate.opens_at ?? "").trim(),
    source_query: String(candidate.source_query ?? "").trim(),
    source_queries: Array.isArray(candidate.source_queries) ? candidate.source_queries.map(String).filter(Boolean) : [],
    image_urls: Array.isArray(candidate.image_urls) ? candidate.image_urls.map(String).filter(Boolean) : [],
    text_preview: String(candidate.text_preview ?? "").trim(),
  };
}

function findCandidate(
  candidates: GoogleMapsScrapeCandidate[],
  payload: GoogleMapsImportPayload,
): GoogleMapsScrapeCandidate | undefined {
  const mapsUrl = String(payload.mapsUrl ?? "").trim();
  const name = String(payload.name ?? "").trim().toLowerCase();

  return candidates.find((candidate) => {
    if (mapsUrl && candidate.maps_url === mapsUrl) return true;
    if (name && candidate.name.toLowerCase() === name) return true;

    return false;
  });
}
