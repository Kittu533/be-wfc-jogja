import { isPublicPlace, toCafeListItem } from "../mappers/place.mapper";
import { readPlaces } from "../repositories/place.repository";
import type { AdminPlace, CafeListItem, CuratedList } from "../types/domain";
import { getPagination, paginateItems } from "../utils/pagination";

export async function getCuratedLists(): Promise<CuratedList[]> {
  return buildCuratedLists((await readPlaces()).filter(isPublicPlace));
}

export async function getCuratedListBySlug(
  slug: string,
  query: Record<string, unknown> = {},
): Promise<
  | (CuratedList & {
      cafes: CafeListItem[];
      totalCafes: number;
      page: number;
      limit: number;
      totalPages: number;
    })
  | null
> {
  const publicPlaces = (await readPlaces()).filter(isPublicPlace);
  const list = buildCuratedLists(publicPlaces).find((item) => item.slug === slug);

  if (!list) return null;

  const allCafes = list.cafeSlugs
    .map((cafeSlug) => publicPlaces.find((place) => place.slug === cafeSlug))
    .filter((place): place is AdminPlace => Boolean(place))
    .map(toCafeListItem);
  const pagination = getPagination(query);
  const { items: cafes, meta } = paginateItems(allCafes, pagination.page, pagination.limit);

  return {
    ...list,
    cafes,
    totalCafes: meta.total,
    page: meta.page,
    limit: meta.limit,
    totalPages: meta.totalPages,
  };
}

function buildCuratedLists(places: AdminPlace[]): CuratedList[] {
  const byScore = [...places].sort(
    (a, b) => (b.webSignalScore ?? 0) - (a.webSignalScore ?? 0) || a.name.localeCompare(b.name, "id"),
  );
  const coworking = byScore.filter((item) => item.category === "coworking_space");
  const coffee = byScore.filter((item) => item.category === "coffee_shop");
  const wifiReady = byScore.filter(
    (item) => item.amenities?.hasSockets || item.featureHighlights?.some((text) => /wifi/i.test(text)),
  );

  return [
    {
      id: "list-osm-01",
      slug: "spot-wfc-terkurasi-osm",
      title: "Spot WFC Terkurasi OSM",
      summary: "Kandidat paling kuat dari data terkurasi admin.",
      description: "List ini hanya memuat tempat published yang punya real image.",
      heroLabel: "Published spots",
      cafeSlugs: byScore.map((item) => item.slug),
    },
    {
      id: "list-osm-02",
      slug: "coworking-dan-workspace-jogja",
      title: "Coworking dan Workspace Jogja",
      summary: "Tempat kerja serius dari dataset admin.",
      description: "Kurasi coworking/workspace yang sudah published.",
      heroLabel: "Kerja serius",
      cafeSlugs: coworking.map((item) => item.slug),
    },
    {
      id: "list-osm-03",
      slug: "coffee-shop-buat-nugas",
      title: "Coffee Shop Buat Nugas",
      summary: "Coffee shop yang siap tampil karena punya real image.",
      description: "List ini fokus ke coffee shop dari backend admin.",
      heroLabel: "Kopi + fokus",
      cafeSlugs: coffee.map((item) => item.slug),
    },
    {
      id: "list-osm-04",
      slug: "wifi-ready-jogja",
      title: "Wifi Ready Jogja",
      summary: "Tempat published dengan indikasi WFC.",
      description: "Start point sebelum validasi lapangan lebih lanjut.",
      heroLabel: "Wifi signal",
      cafeSlugs: wifiReady.map((item) => item.slug),
    },
  ];
}
