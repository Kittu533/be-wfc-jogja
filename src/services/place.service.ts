import { createEmptyPlace, isPublicPlace, normalizeAdminPlace, toCafeDetail, toCafeListItem } from "../mappers/place.mapper";
import { readPlaces, writePlaces } from "../repositories/place.repository";
import type { AdminPlace, CafeListItem, ReviewItem } from "../types/domain";
import { HttpError } from "../utils/http-error";
import { getPagination, paginateItems } from "../utils/pagination";
import { getQueryString } from "../utils/query";
import { slugify } from "../utils/slugify";

export async function getPublicCafes(query: Record<string, unknown>): Promise<{
  items: CafeListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  availableAreas: string[];
}> {
  const publicPlaces = (await readPlaces()).filter(isPublicPlace).map(toCafeDetail);
  const filteredItems = publicPlaces.map(toCafeListItem).filter((cafe) => matchesCafeFilters(cafe, query));
  const pagination = getPagination(query);
  const { items, meta } = paginateItems(filteredItems, pagination.page, pagination.limit);

  return {
    items,
    total: meta.total,
    page: meta.page,
    limit: meta.limit,
    totalPages: meta.totalPages,
    availableAreas: Array.from(new Set(publicPlaces.map((cafe) => cafe.area))).sort(),
  };
}

export async function getPublicCafeBySlug(slug: string): Promise<AdminPlace | null> {
  const places = await readPlaces();

  return places.find((place) => place.slug === slug && isPublicPlace(place)) ?? null;
}

export async function getCafeReviews(cafeIdOrSlug: string): Promise<ReviewItem[]> {
  const places = await readPlaces();
  const place = places.find((item) => item.id === cafeIdOrSlug || item.slug === cafeIdOrSlug);

  return place?.reviews ?? [];
}

export async function getAdminPlaces(query: Record<string, unknown>): Promise<{ items: AdminPlace[]; total: number }> {
  const items = (await readPlaces()).filter((place) => matchesAdminFilters(place, query));

  return { items, total: items.length };
}

export async function getAdminPlaceById(id: string): Promise<AdminPlace | null> {
  const places = await readPlaces();

  return places.find((place) => place.id === id) ?? null;
}

export async function createAdminPlace(payload: Partial<AdminPlace>): Promise<AdminPlace> {
  const now = new Date().toISOString();
  const places = await readPlaces();
  const place = normalizeAdminPlace({
    ...createEmptyPlace(),
    ...payload,
    id: payload.id || `admin-${Date.now()}`,
    slug: payload.slug || slugify(payload.name || "tempat-baru"),
    createdAt: now,
    updatedAt: now,
  });

  places.unshift(place);
  await writePlaces(places);

  return place;
}

export async function updateAdminPlace(id: string, payload: Partial<AdminPlace>): Promise<AdminPlace> {
  const places = await readPlaces();
  const index = places.findIndex((place) => place.id === id);

  if (index === -1) {
    throw new HttpError(404, "Place not found");
  }

  const updated = normalizeAdminPlace({
    ...places[index],
    ...payload,
    id: places[index].id,
    createdAt: places[index].createdAt,
    updatedAt: new Date().toISOString(),
  });

  places[index] = updated;
  await writePlaces(places);

  return updated;
}

export async function archiveAdminPlace(id: string): Promise<AdminPlace> {
  return updateAdminPlace(id, { status: "archived" });
}

function matchesCafeFilters(cafe: CafeListItem, query: Record<string, unknown>): boolean {
  const q = getQueryString(query, "q").trim().toLowerCase();

  if (q) {
    const haystack = [cafe.name, cafe.tagline, cafe.area, cafe.address, ...cafe.bestFor, ...cafe.featureHighlights]
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(q)) return false;
  }

  if (getQueryString(query, "area") && cafe.area !== getQueryString(query, "area")) return false;
  if (getQueryString(query, "priceLevel") && cafe.priceLevel !== getQueryString(query, "priceLevel")) return false;
  if (getQueryString(query, "hasSockets") === "true" && !cafe.amenities.hasSockets) return false;
  if (getQueryString(query, "hasMusholla") === "true" && !cafe.amenities.hasMusholla) return false;
  if (getQueryString(query, "hasParking") === "true" && !cafe.amenities.hasParking) return false;

  return true;
}

function matchesAdminFilters(place: AdminPlace, query: Record<string, unknown>): boolean {
  const q = getQueryString(query, "q").trim().toLowerCase();

  if (q) {
    const haystack = [place.name, place.area, place.address, place.category, place.status].join(" ").toLowerCase();

    if (!haystack.includes(q)) return false;
  }

  const status = getQueryString(query, "status");
  const imageStatus = getQueryString(query, "imageStatus");

  if (status && status !== "all" && place.status !== status) return false;
  if (imageStatus && imageStatus !== "all" && place.imageStatus !== imageStatus) return false;

  return true;
}
