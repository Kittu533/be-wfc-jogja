import assert from "node:assert/strict";
import test from "node:test";
import { toAdminPlaceFromGoogleMapsCandidate } from "../src/mappers/google-maps-import.mapper";

test("maps a Google Maps scrape candidate into a draft admin place", () => {
  const place = toAdminPlaceFromGoogleMapsCandidate(
    {
      name: "Good Space Jogjakarta",
      maps_url:
        "https://www.google.com/maps/place/Good+Space+Jogjakarta/data=!4m7!3m6!1s0x2e7a59abef9a42a1:0x6119e3c2b3357d9d!8m2!3d-7.7701042!4d110.4054187!16s%2Fg%2F11q4gwjnc4!19sChIJoUKa76tZei4RnX01s8LjGWE",
      rating: "4.8",
      image_urls: ["https://lh3.googleusercontent.com/good-space=w114-h86-k-no"],
      category: "Kafe",
      price_level: "",
      address: "Jl. Perumnas No.9",
      text_preview: "Good Space Jogjakarta 4,8 Kafe · Jl. Perumnas No.9 Buka · Tutup pukul 00.00",
    },
    0,
    "2026-04-26T14:30:00.000Z",
  );

  assert.equal(place.id, "gmaps-good-space-jogjakarta");
  assert.equal(place.slug, "good-space-jogjakarta");
  assert.equal(place.name, "Good Space Jogjakarta");
  assert.equal(place.status, "draft");
  assert.equal(place.imageStatus, "scraped");
  assert.equal(place.coverImage, "https://lh3.googleusercontent.com/good-space=w1200-h900-k-no");
  assert.deepEqual(place.galleryImages, ["https://lh3.googleusercontent.com/good-space=w1200-h900-k-no"]);
  assert.equal(place.mapsUrl.includes("Good+Space+Jogjakarta"), true);
  assert.deepEqual(place.coordinates, { latitude: -7.7701042, longitude: 110.4054187 });
  assert.equal(place.address, "Jl. Perumnas No.9");
  assert.equal(place.category, "cafe");
  assert.equal(place.ratingBreakdown.food, 4.8);
  assert.equal(place.adminNotes, "Imported dari Google Maps scrape. Lengkapi fasilitas WFC sebelum publish.");
});

test("enriches Google Maps candidates for frontend filters", () => {
  const place = toAdminPlaceFromGoogleMapsCandidate(
    {
      name: "Kopi Hemat Wifi",
      maps_url:
        "https://www.google.com/maps/place/Kopi+Hemat+Wifi/data=!4m7!3m6!1s0x2e7a59abef9a42a1:0x6119e3c2b3357d9d!8m2!3d-7.7701042!4d110.4054187!16s%2Fg%2F11q4gwjnc4",
      rating: "4.6",
      image_urls: ["https://lh3.googleusercontent.com/kopi-hemat=w114-h86-k-no"],
      category: "Kedai Kopi",
      price_level: "Rp 1-25.000",
      address: "Jl. Hemat No.1",
      text_preview: "Kopi Hemat Wifi 4,6 Kedai Kopi · murah · wifi · colokan · Buka 24 jam",
    },
    0,
    "2026-04-26T14:30:00.000Z",
    { sourceQuery: "cafe wifi kencang murah jogja" },
  );

  assert.equal(place.priceLevel, "murah");
  assert.equal(place.coffeePriceMin, 18000);
  assert.equal(place.amenities.hasSockets, true);
  assert.equal(place.amenities.hasParking, true);
  assert.equal(place.openingHours, "Buka 24 jam");
  assert.deepEqual(place.bestFor, ["Wifi kencang", "Nugas", "Kerja remote", "Budget hemat"]);
  assert.equal(place.featureHighlights.includes("Wifi kencang"), true);
  assert.equal(place.featureHighlights.includes("Budget murah"), true);
  assert.equal(place.featureHighlights.includes("Buka 24 jam"), true);
});

test("maps Google Street View thumbnails into larger image URLs", () => {
  const place = toAdminPlaceFromGoogleMapsCandidate(
    {
      name: "Street View Cafe",
      maps_url:
        "https://www.google.com/maps/place/Street+View+Cafe/data=!4m7!3m6!1s0x2e7a59abef9a42a1:0x6119e3c2b3357d9d!8m2!3d-7.7701042!4d110.4054187!16s%2Fg%2F11q4gwjnc4",
      rating: "4.5",
      image_urls: [
        "https://streetviewpixels-pa.googleapis.com/v1/thumbnail?panoid=abc&cb_client=search.gws-prod.gps&w=80&h=92&yaw=277&pitch=0&thumbfov=100",
      ],
      text_preview: "Street View Cafe 4,5 Kafe · Jl. Testing No.1",
    },
    0,
    "2026-04-26T14:30:00.000Z",
  );

  assert.equal(
    place.coverImage,
    "https://streetviewpixels-pa.googleapis.com/v1/thumbnail?panoid=abc&cb_client=search.gws-prod.gps&w=1200&h=900&yaw=277&pitch=0&thumbfov=100",
  );
});
