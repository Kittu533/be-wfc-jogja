import type { AdminPlace, GoogleMapsScrapeCandidate, PlaceCategory } from "../types/domain";
import { defaultRatings } from "../utils/rating";
import { slugify } from "../utils/slugify";
import { createEmptyPlace, normalizeAdminPlace } from "./place.mapper";

export function toAdminPlaceFromGoogleMapsCandidate(
  candidate: GoogleMapsScrapeCandidate,
  index: number,
  now = new Date().toISOString(),
  options: {
    status?: AdminPlace["status"];
    adminNotes?: string;
    sourceQuery?: string;
  } = {},
): AdminPlace {
  const slug = slugify(candidate.name || `google-maps-place-${index + 1}`);
  const imageUrls = candidate.image_urls.map(toLargeGoogleImageUrl);
  const firstImage = imageUrls[0] ?? "";
  const rating = normalizeRating(candidate.rating);
  const signalText = buildSignalText(
    candidate,
    candidate.source_query || candidate.source_queries?.join(" ") || options.sourceQuery,
  );
  const coordinates = extractCoordinates(candidate);
  const address = candidate.address?.trim() || extractAddress(candidate.text_preview);
  const category = inferCategory(signalText);
  const priceLevel = inferPriceLevel(signalText, candidate.price_level);
  const openingHours = extractOpeningHours(candidate);
  const featureHighlights = buildFeatureHighlights(category, firstImage, signalText, priceLevel, openingHours);
  const bestFor = buildBestFor(signalText, priceLevel);
  const hasWifiSignal = /wifi|wi-fi|internet|wfc|work.?from|remote|nugas|kerja|laptop|colokan|socket|stop kontak/i.test(signalText);

  return normalizeAdminPlace({
    ...createEmptyPlace(),
    id: `gmaps-${slug}`,
    slug,
    name: candidate.name,
    tagline: `${categoryLabel(category)} kandidat WFC Jogja dari Google Maps.`,
    area: inferArea(candidate.text_preview, coordinates.latitude, coordinates.longitude),
    address,
    category,
    priceLevel,
    coffeePriceMin: inferCoffeePriceMin(category, signalText, priceLevel),
    coordinates,
    coverImage: firstImage,
    imageStatus: firstImage ? "scraped" : "missing",
    realImageUrl: firstImage,
    galleryImages: imageUrls,
    featureHighlights,
    bestFor,
    amenities: {
      hasSockets: hasWifiSignal,
      hasMusholla: false,
      hasParking: true,
      smokingArea: false,
      indoorOutdoor: true,
    },
    description:
      candidate.text_preview ||
      "Kandidat tempat dari Google Maps scrape. Verifikasi manual fasilitas WFC sebelum publish.",
    openingHours,
    mapsUrl: candidate.maps_url,
    ratingBreakdown: defaultRatings(rating),
    recommendedMenu: [
      {
        name: category === "coworking_space" ? "Day Pass / Workspace" : "Kopi Signature",
        priceLabel: "Cek menu",
        note: "Lengkapi harga dari admin.",
      },
    ],
    reviews: [],
    status: options.status ?? "draft",
    adminNotes: options.adminNotes ?? "Imported dari Google Maps scrape. Lengkapi fasilitas WFC sebelum publish.",
    sourceMentions: [
      {
        source: "Google Maps scrape",
        title: candidate.name,
        url: candidate.maps_url,
        excerpt: signalText,
      },
    ],
    webSignalScore: calculateWebSignalScore(firstImage, hasWifiSignal, priceLevel, candidate.review_count),
    freshnessStatus: "web-enriched",
    createdAt: now,
    updatedAt: now,
  });
}

export function toLargeGoogleImageUrl(imageUrl: string): string {
  if (!imageUrl) return "";

  try {
    const url = new URL(imageUrl);

    if (url.hostname === "streetviewpixels-pa.googleapis.com") {
      url.searchParams.set("w", "1200");
      url.searchParams.set("h", "900");
      return url.toString();
    }
  } catch {
    return imageUrl;
  }

  if (imageUrl.includes("googleusercontent.com")) {
    if (/=w\d+-h\d+/.test(imageUrl)) {
      return imageUrl.replace(/=w\d+-h\d+(-p)?(-k-no)?$/, "=w1200-h900-k-no");
    }

    if (!imageUrl.includes("=")) {
      return `${imageUrl}=w1200-h900-k-no`;
    }
  }

  return imageUrl;
}

function normalizeRating(value: string): number {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) return 4;

  return Math.min(5, Math.max(1, parsed));
}

function buildSignalText(candidate: GoogleMapsScrapeCandidate, sourceQuery = ""): string {
  return [
    sourceQuery,
    candidate.name,
    candidate.category,
    candidate.price_level,
    candidate.address,
    candidate.text_preview,
  ]
    .filter(Boolean)
    .join(" ");
}

function extractCoordinates(candidate: GoogleMapsScrapeCandidate): AdminPlace["coordinates"] {
  const lat = Number(candidate.lat);
  const lng = Number(candidate.lng);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { latitude: lat, longitude: lng };
  }

  const match = candidate.maps_url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (!match) {
    return createEmptyPlace().coordinates;
  }

  return {
    latitude: Number(match[1]),
    longitude: Number(match[2]),
  };
}

function extractAddress(textPreview: string): string {
  const match = textPreview.match(/(?:Kafe|Kedai Kopi|Coworking space|Ruang kerja bersama|Restoran)\s*·\s*(.+?)(?:\s+Buka|\s+Tutup|\s+Kafe|\s+Pesan online|$)/i);
  if (!match) return "";

  return match[1].replace(/^[^\w]+/, "").trim();
}

function extractOpeningHours(candidate: GoogleMapsScrapeCandidate): string {
  if (/24\s*jam/i.test(candidate.text_preview)) return "Buka 24 jam";
  if (candidate.closes_at) return `Tutup pukul ${candidate.closes_at}`;
  if (candidate.opens_at) return `Buka pukul ${candidate.opens_at}`;

  const match = candidate.text_preview.match(/(?:Buka|Tutup)\s*·\s*Tutup pukul\s*([0-9:.]+)/i);
  return match ? `Tutup pukul ${match[1]}` : "";
}

function inferCategory(textPreview: string): PlaceCategory {
  if (/coworking|workspace|ruang kerja/i.test(textPreview)) return "coworking_space";
  if (/kedai kopi|coffee/i.test(textPreview)) return "coffee_shop";
  if (/wifi/i.test(textPreview)) return "wifi_spot";

  return "cafe";
}

function inferArea(textPreview: string, latitude: number, longitude: number): string {
  if (/gejayan|affandi|gondang|perumnas|seturan/i.test(textPreview)) return "Gejayan";
  if (/kranggan|tugu|malioboro/i.test(textPreview)) return "Yogyakarta";
  if (latitude > -7.755) return "Kaliurang";
  if (longitude > 110.397 && latitude > -7.792) return "Seturan";
  if (longitude > 110.385 && latitude > -7.805) return "Gejayan";

  return "Yogyakarta";
}

function inferPriceLevel(textPreview: string, priceLevel = ""): AdminPlace["priceLevel"] {
  const combined = `${priceLevel} ${textPreview}`;

  if (/murah|hemat|terjangkau|budget|mahasiswa|Rp\s*1\s*[-–]\s*25[.,]?000|Rp\s*0\s*[-–]\s*25[.,]?000/i.test(combined)) {
    return "murah";
  }

  if (/premium|coworking|workspace|roaster|roastery|specialty|reserve|Rp\s*(?:5[0-9]|[6-9][0-9]|[1-9]\d{2})[.,]?000/i.test(combined)) {
    return "premium";
  }

  return "menengah";
}

function inferCoffeePriceMin(category: PlaceCategory, textPreview: string, priceLevel: AdminPlace["priceLevel"]): number {
  if (category === "coworking_space") return 35000;
  if (priceLevel === "murah") return 18000;
  if (/roaster|roastery|specialty/i.test(textPreview)) return 30000;

  return 22000;
}

function buildFeatureHighlights(
  category: PlaceCategory,
  firstImage: string,
  signalText: string,
  priceLevel: AdminPlace["priceLevel"],
  openingHours: string,
): string[] {
  const highlights = [
    categoryLabel(category),
    firstImage ? "Punya real image" : "Butuh image",
  ];

  if (/wifi|wi-fi|internet|wfc|nugas|kerja|remote|laptop/i.test(signalText)) {
    highlights.push("Wifi kencang");
  } else {
    highlights.push("Perlu cek wifi");
  }

  if (/colokan|socket|stop kontak|charger|laptop/i.test(signalText)) {
    highlights.push("Banyak colokan");
  }

  if (priceLevel === "murah") {
    highlights.push("Budget murah");
  }

  if (/24\s*jam/i.test(openingHours || signalText)) {
    highlights.push("Buka 24 jam");
  }

  return Array.from(new Set(highlights));
}

function buildBestFor(signalText: string, priceLevel: AdminPlace["priceLevel"]): string[] {
  const bestFor = [];

  if (/wifi|wi-fi|internet|wfc/i.test(signalText)) bestFor.push("Wifi kencang");
  bestFor.push("Nugas", "Kerja remote");
  if (/meeting|coworking|workspace/i.test(signalText)) bestFor.push("Meeting");
  if (priceLevel === "murah") bestFor.push("Budget hemat");

  return Array.from(new Set(bestFor));
}

function calculateWebSignalScore(firstImage: string, hasWifiSignal: boolean, priceLevel: AdminPlace["priceLevel"], reviewCount = "") {
  let score = firstImage ? 8 : 4;
  if (hasWifiSignal) score += 5;
  if (priceLevel === "murah") score += 2;

  const reviews = Number(reviewCount);
  if (Number.isFinite(reviews) && reviews >= 100) score += 3;

  return score;
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
