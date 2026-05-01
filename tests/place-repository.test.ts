import assert from "node:assert/strict";
import test from "node:test";
import type { AdminPlace, GoogleMapsScrapeFile } from "../src/types/domain";
import { ensureUniquePlaceSlugs, toGoogleMapsSeedPlaces } from "../src/repositories/place.repository";
import { createEmptyPlace } from "../src/mappers/place.mapper";

function makePlace(id: string, slug: string, name: string): AdminPlace {
  return {
    ...createEmptyPlace(),
    id,
    slug,
    name,
  };
}

test("ensureUniquePlaceSlugs suffixes duplicate seed slugs without changing first item", () => {
  const places = [
    makePlace("osm-node-1", "internet-cafe", "Internet cafe"),
    makePlace("osm-node-2", "internet-cafe", "Internet cafe"),
    makePlace("osm-way-1", "paperplane-coffee", "Paperplane Coffee"),
    makePlace("osm-way-2", "paperplane-coffee", "Paperplane Coffee"),
  ];

  const result = ensureUniquePlaceSlugs(places);

  assert.deepEqual(
    result.map((place) => place.slug),
    ["internet-cafe", "internet-cafe-2", "paperplane-coffee", "paperplane-coffee-2"],
  );
  assert.equal(result[0].id, "osm-node-1");
  assert.equal(result[1].id, "osm-node-2");
});

test("toGoogleMapsSeedPlaces builds backend seed data from google maps scrape file", () => {
  const scrape: GoogleMapsScrapeFile = {
    query: "kafe",
    source: "google_maps_html",
    source_url: "https://www.google.com/maps/search/kafe",
    limit: 2,
    scraped_at: "2026-04-26T16:14:00.341428+00:00",
    places: [
      {
        name: "Svarga Flora Coffee & Plants",
        maps_url:
          "https://www.google.com/maps/place/Svarga+Flora+Coffee+%26+Plants/data=!4m7!3m6!1s0x2e7a598f1c4530d9:0x93ddd9982e4ae5b5!8m2!3d-7.7612473!4d110.3940399!16s%2Fg%2F11mbpvxqqx",
        rating: "4.4",
        image_urls: ["https://lh3.googleusercontent.com/svarga=w86-h114-k-no"],
        text_preview: "Svarga Flora Coffee & Plants 4,4 Kedai Kopi · Jl. Affandi No.26A Buka · Tutup pukul 01.00",
      },
    ],
  };

  const result = toGoogleMapsSeedPlaces(scrape);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "gmaps-svarga-flora-coffee-plants");
  assert.equal(result[0].slug, "svarga-flora-coffee-plants");
  assert.equal(result[0].mapsUrl, scrape.places[0].maps_url);
  assert.equal(result[0].coverImage, "https://lh3.googleusercontent.com/svarga=w1200-h900-k-no");
  assert.equal(result[0].freshnessStatus, "web-enriched");
  assert.equal(result[0].status, "published");
  assert.equal(result[0].adminNotes, "Seed dari Google Maps scrape dan auto-published agar tampil di frontend.");
});
