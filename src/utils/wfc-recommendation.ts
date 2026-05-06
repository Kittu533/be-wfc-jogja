import type {
  AdminPlace,
  CafeUseCase,
  GoogleMapsScrapeCandidate,
  WfcRecommendation,
  WfcRecommendationConfidence,
  WfcRecommendationTier,
} from "../types/domain";
import { averageRating } from "./rating";

const DEFAULT_RECOMMENDATION: WfcRecommendation = {
  score: 0,
  tier: "needs_review",
  badges: ["Perlu kurasi"],
  reasons: ["Data WFC belum cukup lengkap untuk direkomendasikan kuat."],
  confidence: "low",
};

export function defaultWfcRecommendation(): WfcRecommendation {
  return { ...DEFAULT_RECOMMENDATION, badges: [...DEFAULT_RECOMMENDATION.badges], reasons: [...DEFAULT_RECOMMENDATION.reasons] };
}

export function normalizeWfcRecommendation(value: Partial<WfcRecommendation> | undefined): WfcRecommendation {
  const score = clampScore(Number(value?.score ?? 0));
  const badges = uniqueNonEmpty(value?.badges ?? DEFAULT_RECOMMENDATION.badges);
  const reasons = uniqueNonEmpty(value?.reasons ?? DEFAULT_RECOMMENDATION.reasons);
  const confidence = normalizeConfidence(value?.confidence);

  return {
    score,
    tier: normalizeTier(value?.tier, score),
    badges,
    reasons,
    confidence,
  };
}

export function buildWfcRecommendationForGoogleMapsCandidate(
  candidate: GoogleMapsScrapeCandidate,
  place: Pick<
    AdminPlace,
    | "category"
    | "priceLevel"
    | "imageStatus"
    | "coverImage"
    | "galleryImages"
    | "featureHighlights"
    | "bestFor"
    | "amenities"
    | "openingHours"
    | "ratingBreakdown"
    | "webSignalScore"
  >,
  sourceQuery = "",
): WfcRecommendation {
  const signalText = [
    sourceQuery,
    candidate.source_query,
    ...(candidate.source_queries ?? []),
    candidate.name,
    candidate.category,
    candidate.price_level,
    candidate.address,
    candidate.text_preview,
    place.openingHours,
    ...place.featureHighlights,
    ...place.bestFor,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const reviewCount = parseReviewCount(candidate.review_count);
  const rating = averageRating(place.ratingBreakdown);
  const hasImage = Boolean(place.coverImage || place.galleryImages.length || (candidate.image_urls ?? []).length);
  const hasWifiSignal = /wifi|wi-fi|internet|wfc|remote|kerja|nugas|laptop|coworking|workspace/i.test(signalText);
  const hasSocketSignal = place.amenities.hasSockets || /colokan|socket|stop kontak|charger/i.test(signalText);
  const hasNightSignal = /24\s*jam|tutup pukul 0[0-5]|buka malam|night/i.test(signalText);
  const hasMeetingSignal = /meeting|coworking|workspace|ruang kerja/i.test(signalText);
  const isBudget = place.priceLevel === "murah" || /murah|hemat|budget|mahasiswa|terjangkau/i.test(signalText);
  const isCoworking = place.category === "coworking_space" || /coworking|workspace|ruang kerja/i.test(signalText);

  let score = 20;
  if (hasWifiSignal) score += 18;
  if (hasSocketSignal) score += 14;
  if (isCoworking) score += 12;
  if (isBudget) score += 8;
  if (hasNightSignal) score += 7;
  if (hasMeetingSignal) score += 6;
  if (hasImage) score += 10;
  if (rating >= 4.7) score += 8;
  else if (rating >= 4.4) score += 6;
  else if (rating >= 4.0) score += 3;
  if (reviewCount >= 1000) score += 7;
  else if (reviewCount >= 250) score += 5;
  else if (reviewCount >= 50) score += 3;
  score += Math.min(8, Math.max(0, Math.round(place.webSignalScore / 2)));

  const badges = [
    hasWifiSignal ? "Wifi signal" : "",
    hasSocketSignal ? "Banyak colokan" : "",
    isBudget ? "Budget murah" : "",
    hasNightSignal ? "Buka 24 jam" : "",
    isCoworking ? "Kerja serius" : "",
    hasMeetingSignal ? "Meeting friendly" : "",
    hasImage ? "Punya foto asli" : "",
  ];
  const reasons = [
    hasWifiSignal ? "Muncul dari sinyal pencarian atau deskripsi yang relevan untuk WFC." : "",
    hasSocketSignal ? "Ada indikasi colokan atau kebutuhan laptop." : "",
    isBudget ? "Cocok untuk pengguna yang cari tempat kerja hemat." : "",
    hasNightSignal ? "Punya sinyal jam operasional malam atau 24 jam." : "",
    rating >= 4.4 ? `Rating Google Maps terbaca kuat (${rating.toFixed(1)}).` : "",
    reviewCount >= 50 ? `Punya ${reviewCount.toLocaleString("id-ID")} ulasan sebagai sinyal popularitas.` : "",
    hasImage ? "Sudah punya foto asli dari hasil scrape." : "",
  ];

  return normalizeWfcRecommendation({
    score,
    badges,
    reasons,
    confidence: getConfidence({ hasImage, hasWifiSignal, reviewCount, rating }),
  });
}

export function matchesUseCase(place: AdminPlace, useCase: string): boolean {
  if (!isCafeUseCase(useCase)) return true;

  const haystack = [
    place.category,
    place.priceLevel,
    place.openingHours,
    ...place.featureHighlights,
    ...place.bestFor,
    ...place.wfcRecommendation.badges,
    ...place.wfcRecommendation.reasons,
  ]
    .join(" ")
    .toLowerCase();

  switch (useCase) {
    case "wifi":
      return /wifi|internet|wfc/i.test(haystack);
    case "budget":
      return place.priceLevel === "murah" || /budget|murah|hemat|mahasiswa/i.test(haystack);
    case "sockets":
      return place.amenities.hasSockets || /colokan|socket|stop kontak/i.test(haystack);
    case "night":
      return /24\s*jam|malam|tutup pukul 0[0-5]/i.test(haystack);
    case "meeting":
      return /meeting|ruang kerja|workspace/i.test(haystack);
    case "coworking":
      return place.category === "coworking_space" || /coworking|workspace/i.test(haystack);
  }
}

export function isCafeUseCase(value: string): value is CafeUseCase {
  return ["wifi", "budget", "sockets", "night", "meeting", "coworking"].includes(value);
}

function getConfidence(input: {
  hasImage: boolean;
  hasWifiSignal: boolean;
  reviewCount: number;
  rating: number;
}): WfcRecommendationConfidence {
  const signals = [input.hasImage, input.hasWifiSignal, input.reviewCount >= 50, input.rating >= 4.2].filter(Boolean).length;
  if (signals >= 3) return "high";
  if (signals >= 2) return "medium";
  return "low";
}

function normalizeTier(tier: unknown, score: number): WfcRecommendationTier {
  if (tier === "excellent" || tier === "good" || tier === "okay" || tier === "needs_review") return tier;
  if (score >= 78) return "excellent";
  if (score >= 62) return "good";
  if (score >= 42) return "okay";
  return "needs_review";
}

function normalizeConfidence(confidence: unknown): WfcRecommendationConfidence {
  if (confidence === "high" || confidence === "medium" || confidence === "low") return confidence;
  return "low";
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function parseReviewCount(value = "") {
  const parsed = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
