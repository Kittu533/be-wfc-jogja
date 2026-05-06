import type {
  AdminPlace,
  CafeListItem,
  PlaceCategory,
  PriceLevel,
  ReviewItem,
  SeedCandidate,
} from "../types/domain";
import { averageRating, defaultRatings } from "../utils/rating";
import { defaultWfcRecommendation, normalizeWfcRecommendation } from "../utils/wfc-recommendation";

export function toAdminPlace(candidate: SeedCandidate, index: number): AdminPlace {
  const now = "2026-04-26T09:00:00+07:00";
  const id = `osm-${candidate.sourceId.replace("/", "-")}`;
  const area = normalizeArea(candidate);
  const imageStatus = candidate.imageStatus === "scraped" ? "scraped" : "fallback";
  const coverImage = imageStatus === "scraped" ? candidate.imageUrl ?? "" : candidate.fallbackCoverImage ?? "";
  const ratings = defaultRatings(3.9 + candidate.wfcScore * 0.18);

  return normalizeAdminPlace({
    id,
    slug: candidate.slug,
    name: candidate.name,
    tagline: `${categoryLabel(candidate.category)} di ${area} untuk kandidat WFC Jogja.`,
    area,
    address: candidate.address || candidate.rawTags?.description || `Area ${area}`,
    category: candidate.category,
    priceLevel: inferPriceLevel(candidate),
    coffeePriceMin: inferCoffeePriceMin(candidate),
    coordinates: {
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    },
    coverImage,
    imageStatus,
    realImageUrl: candidate.realImageUrl || "",
    galleryImages: imageStatus === "scraped" && candidate.imageUrl ? [candidate.imageUrl] : [],
    featureHighlights: buildHighlights(candidate),
    bestFor: buildBestFor(candidate),
    amenities: {
      hasSockets: candidate.category === "coworking_space" || candidate.wfcScore >= 4,
      hasMusholla: false,
      hasParking: candidate.category !== "coworking_space" || candidate.wfcScore >= 4,
      smokingArea: candidate.rawTags?.outdoor_seating === "yes",
      indoorOutdoor: true,
    },
    description: candidate.notes,
    openingHours: candidate.openingHours,
    contactPhone: candidate.phone,
    instagram: candidate.instagram,
    website: candidate.website,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${candidate.latitude},${candidate.longitude}`,
    ratingBreakdown: ratings,
    recommendedMenu: buildMenu(candidate),
    reviews: [buildReview(id, ratings, index)],
    status: imageStatus === "scraped" && candidate.realImageUrl ? "published" : "draft",
    adminNotes: imageStatus === "scraped" ? "Auto-published karena punya real image." : "Lengkapi cover image asli sebelum publish.",
    sourceMentions: candidate.sourceMentions ?? [],
    webSignalScore: candidate.webSignalScore ?? 0,
    wfcRecommendation: defaultWfcRecommendation(),
    freshnessStatus: candidate.freshnessStatus ?? "osm-only",
    createdAt: now,
    updatedAt: now,
  });
}

export function normalizeAdminPlace(place: Partial<AdminPlace>): AdminPlace {
  const base = createEmptyPlace();

  return {
    ...base,
    ...place,
    category: normalizeCategory(place.category ?? base.category),
    priceLevel: normalizePriceLevel(place.priceLevel ?? base.priceLevel),
    coordinates: {
      latitude: Number(place.coordinates?.latitude ?? base.coordinates.latitude),
      longitude: Number(place.coordinates?.longitude ?? base.coordinates.longitude),
    },
    coffeePriceMin: Number(place.coffeePriceMin ?? base.coffeePriceMin),
    galleryImages: Array.isArray(place.galleryImages) ? place.galleryImages : [],
    featureHighlights: Array.isArray(place.featureHighlights) ? place.featureHighlights : [],
    bestFor: Array.isArray(place.bestFor) ? place.bestFor : [],
    recommendedMenu: Array.isArray(place.recommendedMenu) ? place.recommendedMenu : [],
    reviews: Array.isArray(place.reviews) ? place.reviews : [],
    sourceMentions: Array.isArray(place.sourceMentions) ? place.sourceMentions : [],
    webSignalScore: Number(place.webSignalScore ?? 0),
    wfcRecommendation: normalizeWfcRecommendation(place.wfcRecommendation),
  };
}

export function createEmptyPlace(): AdminPlace {
  const now = new Date().toISOString();

  return {
    id: "",
    slug: "",
    name: "",
    tagline: "",
    area: "",
    address: "",
    category: "coffee_shop",
    priceLevel: "menengah",
    coffeePriceMin: 0,
    coordinates: { latitude: -7.797068, longitude: 110.370529 },
    coverImage: "",
    imageStatus: "missing",
    realImageUrl: "",
    galleryImages: [],
    featureHighlights: [],
    bestFor: [],
    amenities: {
      hasSockets: false,
      hasMusholla: false,
      hasParking: false,
      smokingArea: false,
      indoorOutdoor: true,
    },
    description: "",
    openingHours: "",
    contactPhone: "",
    instagram: "",
    website: "",
    mapsUrl: "",
    ratingBreakdown: defaultRatings(4),
    recommendedMenu: [],
    reviews: [],
    status: "draft",
    adminNotes: "",
    sourceMentions: [],
    webSignalScore: 0,
    wfcRecommendation: defaultWfcRecommendation(),
    freshnessStatus: "osm-only",
    createdAt: now,
    updatedAt: now,
  };
}

export function isPublicPlace(place: AdminPlace): boolean {
  return (
    place.status === "published" &&
    ["scraped", "uploaded"].includes(place.imageStatus) &&
    Boolean(place.coverImage) &&
    !place.coverImage.startsWith("/dataset-images/")
  );
}

export function toCafeDetail(place: AdminPlace): AdminPlace {
  return place;
}

export function toCafeListItem(cafe: AdminPlace): CafeListItem {
  return {
    id: cafe.id,
    slug: cafe.slug,
    name: cafe.name,
    tagline: cafe.tagline,
    area: cafe.area,
    address: cafe.address,
    priceLevel: cafe.priceLevel,
    rating: averageRating(cafe.ratingBreakdown),
    reviewCount: cafe.reviews.length,
    coordinates: cafe.coordinates,
    coverImage: cafe.coverImage,
    featureHighlights: cafe.featureHighlights,
    bestFor: cafe.bestFor,
    amenities: cafe.amenities,
    wfcRecommendation: cafe.wfcRecommendation,
  };
}

function normalizeArea(candidate: SeedCandidate): string {
  const rawArea = [candidate.areaHint, candidate.rawTags?.description].join(" ");

  if (/sleman|condong|catur|depok/i.test(rawArea)) return "Sleman";
  if (/yogyakarta|jogja|kota/i.test(rawArea)) return "Yogyakarta";
  if (candidate.latitude > -7.755) return "Kaliurang";
  if (candidate.longitude > 110.397 && candidate.latitude > -7.792) return "Seturan";
  if (candidate.longitude > 110.385 && candidate.latitude > -7.805) return "Gejayan";

  return "Yogyakarta";
}

function inferPriceLevel(candidate: SeedCandidate): PriceLevel {
  if (/cowork|workspace|roastery|reserve|specialty/i.test(`${candidate.name} ${candidate.category}`)) {
    return "premium";
  }

  return "menengah";
}

function inferCoffeePriceMin(candidate: SeedCandidate): number {
  if (candidate.category === "coworking_space") return 35000;
  if (/specialty|roastery|reserve/i.test(candidate.name)) return 30000;

  return 22000;
}

function buildHighlights(candidate: SeedCandidate): string[] {
  return [
    categoryLabel(candidate.category),
    candidate.hasWifiSignal || candidate.internetAccess ? "Indikasi wifi" : "Perlu cek wifi",
    candidate.imageStatus === "scraped" ? "Punya real image" : "Butuh image",
  ];
}

function buildBestFor(candidate: SeedCandidate): string[] {
  if (candidate.category === "coworking_space") return ["Remote work", "Meeting", "Deep work"];
  if (candidate.hasWifiSignal) return ["Nugas", "Kerja remote", "Online meeting"];

  return ["Coffee break", "Nugas ringan"];
}

function buildMenu(candidate: SeedCandidate) {
  return [
    {
      name: candidate.category === "coworking_space" ? "Day Pass / Workspace" : "Kopi Signature",
      priceLabel: "Cek menu",
      note: "Lengkapi harga dari admin.",
    },
  ];
}

function buildReview(cafeId: string, ratings: AdminPlace["ratingBreakdown"], index: number): ReviewItem {
  return {
    id: `admin-seed-review-${index + 1}`,
    cafeId,
    author: "Kurator WFC Jogja",
    role: "Dataset reviewer",
    comment: "Review WFC awal dari dataset. Silakan edit setelah validasi lapangan.",
    visitDate: "2026-04-26",
    createdAt: "2026-04-26T09:00:00+07:00",
    ratings,
  };
}

function categoryLabel(category: PlaceCategory): string {
  switch (category) {
    case "coworking_space":
      return "Coworking space";
    case "coffee_shop":
      return "Coffee shop";
    case "wifi_spot":
      return "Wifi spot";
    case "cafe":
      return "Cafe";
  }
}

function normalizeCategory(category: string): PlaceCategory {
  if (["coffee_shop", "coworking_space", "wifi_spot", "cafe"].includes(category)) {
    return category as PlaceCategory;
  }

  return "coffee_shop";
}

function normalizePriceLevel(priceLevel: string): PriceLevel {
  if (priceLevel === "hemat") {
    return "murah";
  }

  if (["murah", "menengah", "premium"].includes(priceLevel)) {
    return priceLevel as PriceLevel;
  }

  return "menengah";
}
