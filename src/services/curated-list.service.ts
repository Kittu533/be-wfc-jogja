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
    (a, b) =>
      (b.wfcRecommendation?.score ?? 0) - (a.wfcRecommendation?.score ?? 0) ||
      (b.webSignalScore ?? 0) - (a.webSignalScore ?? 0) ||
      a.name.localeCompare(b.name, "id"),
  );
  const wifiReady = byScore.filter((item) => hasSignal(item, /wifi|internet|wfc/i));
  const budget = byScore.filter((item) => item.priceLevel === "murah" || hasSignal(item, /budget|murah|hemat|mahasiswa/i));
  const sockets = byScore.filter((item) => item.amenities?.hasSockets || hasSignal(item, /colokan|socket|stop kontak/i));
  const night = byScore.filter((item) => hasSignal(item, /24\s*jam|malam|tutup pukul 0[0-5]/i));
  const coworking = byScore.filter((item) => item.category === "coworking_space" || hasSignal(item, /coworking|workspace|meeting|ruang kerja/i));

  return [
    {
      id: "list-wfc-01",
      slug: "top-wfc-jogja",
      title: "Top WFC Jogja",
      summary: "Ranking tempat paling kuat dari skor rekomendasi WFC.",
      description: "List otomatis dari data published yang diurutkan berdasarkan sinyal WFC, foto, rating, dan kelengkapan data.",
      heroLabel: "Top picks",
      cafeSlugs: byScore.map((item) => item.slug),
    },
    {
      id: "list-wfc-02",
      slug: "wifi-kencang-jogja",
      title: "Wifi Kencang",
      summary: "Tempat dengan sinyal wifi dan WFC paling kuat.",
      description: "Kumpulan tempat yang muncul dari query, highlight, atau rekomendasi terkait wifi dan kerja remote.",
      heroLabel: "Wifi signal",
      cafeSlugs: wifiReady.map((item) => item.slug),
    },
    {
      id: "list-wfc-03",
      slug: "budget-mahasiswa",
      title: "Budget Mahasiswa",
      summary: "Spot kerja yang lebih ramah kantong.",
      description: "List otomatis untuk tempat berbudget murah atau punya sinyal hemat dari hasil scrape.",
      heroLabel: "Hemat",
      cafeSlugs: budget.map((item) => item.slug),
    },
    {
      id: "list-wfc-04",
      slug: "banyak-colokan",
      title: "Banyak Colokan",
      summary: "Tempat dengan indikasi colokan atau kebutuhan laptop.",
      description: "Cocok untuk sesi kerja panjang yang butuh daya aman.",
      heroLabel: "Power ready",
      cafeSlugs: sockets.map((item) => item.slug),
    },
    {
      id: "list-wfc-05",
      slug: "buka-malam-24-jam",
      title: "Buka Malam / 24 Jam",
      summary: "Opsi kerja sore sampai malam dari sinyal jam operasional.",
      description: "Tempat yang terindikasi buka malam atau 24 jam dari scrape dan data admin.",
      heroLabel: "Late work",
      cafeSlugs: night.map((item) => item.slug),
    },
    {
      id: "list-wfc-06",
      slug: "coworking-dan-meeting",
      title: "Coworking & Meeting",
      summary: "Tempat kerja serius untuk fokus, meeting, atau tim kecil.",
      description: "Kurasi otomatis dari kategori coworking, workspace, dan sinyal meeting.",
      heroLabel: "Kerja serius",
      cafeSlugs: coworking.map((item) => item.slug),
    },
  ];
}

function hasSignal(place: AdminPlace, pattern: RegExp): boolean {
  return pattern.test(
    [
      place.category,
      place.openingHours,
      ...place.featureHighlights,
      ...place.bestFor,
      ...place.wfcRecommendation.badges,
      ...place.wfcRecommendation.reasons,
    ].join(" "),
  );
}
