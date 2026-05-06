export type PlaceCategory = "coffee_shop" | "coworking_space" | "wifi_spot" | "cafe";
export type PriceLevel = "murah" | "menengah" | "premium";
export type ImageStatus = "missing" | "fallback" | "scraped" | "uploaded";
export type PlaceStatus = "draft" | "published" | "archived";
export type FreshnessStatus = "osm-only" | "web-enriched" | "verified";
export type WfcRecommendationTier = "excellent" | "good" | "okay" | "needs_review";
export type WfcRecommendationConfidence = "high" | "medium" | "low";
export type CafeSort = "recommended" | "rating" | "reviews" | "newest";
export type CafeUseCase = "wifi" | "budget" | "sockets" | "night" | "meeting" | "coworking";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface PlaceAmenities {
  hasSockets: boolean;
  hasMusholla: boolean;
  hasParking: boolean;
  smokingArea: boolean;
  indoorOutdoor: boolean;
}

export interface RatingBreakdown {
  food: number;
  drink: number;
  wifi: number;
  ambience: number;
  workFriendly: number;
  value: number;
}

export interface MenuItem {
  name: string;
  priceLabel: string;
  note: string;
}

export interface ReviewItem {
  id: string;
  cafeId: string;
  author: string;
  role: string;
  comment: string;
  visitDate: string;
  createdAt: string;
  ratings: RatingBreakdown;
}

export interface SourceMention {
  source?: string;
  title?: string;
  url?: string;
  excerpt?: string;
  publishedAt?: string;
}

export interface WfcRecommendation {
  score: number;
  tier: WfcRecommendationTier;
  badges: string[];
  reasons: string[];
  confidence: WfcRecommendationConfidence;
}

export interface AdminPlace {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  area: string;
  address: string;
  category: PlaceCategory;
  priceLevel: PriceLevel;
  coffeePriceMin: number;
  coordinates: Coordinates;
  coverImage: string;
  imageStatus: ImageStatus;
  realImageUrl: string;
  galleryImages: string[];
  featureHighlights: string[];
  bestFor: string[];
  amenities: PlaceAmenities;
  description: string;
  openingHours: string;
  contactPhone: string;
  instagram: string;
  website: string;
  mapsUrl: string;
  ratingBreakdown: RatingBreakdown;
  recommendedMenu: MenuItem[];
  reviews: ReviewItem[];
  status: PlaceStatus;
  adminNotes: string;
  sourceMentions: SourceMention[];
  webSignalScore: number;
  wfcRecommendation: WfcRecommendation;
  freshnessStatus: FreshnessStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CafeListItem {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  area: string;
  address: string;
  priceLevel: PriceLevel;
  rating: number;
  reviewCount: number;
  coordinates: Coordinates;
  coverImage: string;
  featureHighlights: string[];
  bestFor: string[];
  amenities: PlaceAmenities;
  wfcRecommendation: WfcRecommendation;
}

export interface CuratedList {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  heroLabel: string;
  cafeSlugs: string[];
}

export interface SeedCandidate {
  sourceId: string;
  slug: string;
  name: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
  address?: string;
  areaHint?: string;
  imageStatus?: ImageStatus;
  imageUrl?: string;
  fallbackCoverImage?: string;
  realImageUrl?: string;
  wfcScore: number;
  notes: string;
  openingHours: string;
  phone: string;
  instagram: string;
  website: string;
  hasWifiSignal?: boolean;
  internetAccess?: boolean;
  sourceMentions?: SourceMention[];
  webSignalScore?: number;
  freshnessStatus?: FreshnessStatus;
  rawTags?: {
    description?: string;
    outdoor_seating?: string;
  };
}

export interface GoogleMapsScrapeCandidate {
  name: string;
  maps_url: string;
  place_id?: string;
  address?: string;
  lat?: string;
  lng?: string;
  category?: string;
  price_level?: string;
  rating: string;
  review_count?: string;
  is_open?: string;
  closes_at?: string;
  opens_at?: string;
  source_query?: string;
  source_queries?: string[];
  image_urls: string[];
  text_preview: string;
}

export interface GoogleMapsScrapeFile {
  query: string;
  source: string;
  source_url: string;
  limit: number;
  scraped_at: string;
  places: GoogleMapsScrapeCandidate[];
}

export interface GoogleMapsImportCandidate extends GoogleMapsScrapeCandidate {
  alreadyImported: boolean;
  importedPlaceId: string;
  importedSlug: string;
}
