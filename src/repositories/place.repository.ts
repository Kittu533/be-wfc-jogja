import fsp from "node:fs/promises";
import { paths } from "../config/paths";
import { getSupabaseAdmin } from "../config/supabase";
import { toAdminPlaceFromGoogleMapsCandidate } from "../mappers/google-maps-import.mapper";
import type { AdminPlace, GoogleMapsScrapeFile } from "../types/domain";
import type { Json } from "../types/supabase";
import { HttpError } from "../utils/http-error";

const TABLE = "admin_places";

type AdminPlaceRow = {
  id: string;
  slug: string;
  name: string;
  area: string;
  category: string;
  status: string;
  image_status: string;
  updated_at: string;
  payload: Json;
};

export async function ensurePlaceStorage(): Promise<void> {
  await fsp.mkdir(paths.uploadDir, { recursive: true });
  await seedPlacesIfEmpty();
}

export async function readPlaces(): Promise<AdminPlace[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("payload")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new HttpError(500, `Supabase read failed: ${error.message}`);
  }

  return (data ?? []).map((row) => row.payload as unknown as AdminPlace);
}

export async function writePlaces(places: AdminPlace[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  const rows = places.map(toRow);
  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: "id" });

  if (error) {
    throw new HttpError(500, `Supabase write failed: ${error.message}`);
  }
}

async function seedPlacesIfEmpty(): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new HttpError(500, `Supabase table check failed: ${error.message}`);
  }

  if ((count ?? 0) > 0) {
    return;
  }

  await writePlaces(await loadSeedPlaces());
}

async function loadSeedPlaces(): Promise<AdminPlace[]> {
  const raw = JSON.parse(await fsp.readFile(paths.googleMapsScrapePath, "utf8")) as GoogleMapsScrapeFile;

  return toGoogleMapsSeedPlaces(raw);
}

export function toGoogleMapsSeedPlaces(scrape: GoogleMapsScrapeFile): AdminPlace[] {
  const places = Array.isArray(scrape.places) ? scrape.places : [];

  return ensureUniquePlaceSlugs(
    places
      .filter((candidate) => candidate.name && candidate.maps_url)
      .map((candidate, index) =>
        toAdminPlaceFromGoogleMapsCandidate(candidate, index, scrape.scraped_at || undefined, {
          status: "published",
          adminNotes: "Seed dari Google Maps scrape dan auto-published agar tampil di frontend.",
          sourceQuery: scrape.query,
        }),
      ),
  );
}

export function ensureUniquePlaceSlugs(places: AdminPlace[]): AdminPlace[] {
  const slugCounts = new Map<string, number>();
  const usedSlugs = new Set<string>();

  return places.map((place) => {
    const baseSlug = place.slug || place.id;
    let currentCount = (slugCounts.get(baseSlug) ?? 0) + 1;
    let slug = currentCount === 1 ? baseSlug : `${baseSlug}-${currentCount}`;

    while (usedSlugs.has(slug)) {
      currentCount += 1;
      slug = `${baseSlug}-${currentCount}`;
    }

    slugCounts.set(baseSlug, currentCount);
    usedSlugs.add(slug);

    return {
      ...place,
      slug,
    };
  });
}

function toRow(place: AdminPlace): AdminPlaceRow {
  return {
    id: place.id,
    slug: place.slug,
    name: place.name,
    area: place.area,
    category: place.category,
    status: place.status,
    image_status: place.imageStatus,
    updated_at: place.updatedAt,
    payload: place as unknown as Json,
  };
}
