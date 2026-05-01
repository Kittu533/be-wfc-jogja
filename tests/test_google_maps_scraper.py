import sys
import unittest
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_DIR))

from google_maps_scraper import (
    clamp_limit,
    mark_source_query,
    merge_output_payload,
    merge_scrape_payloads,
    parse_place_cards,
)


class GoogleMapsScraperTest(unittest.TestCase):
    def test_clamp_limit_allows_fifty_places_but_caps_above_that(self):
        self.assertEqual(clamp_limit(50), 50)
        self.assertEqual(clamp_limit(75), 50)

    def test_parse_place_cards_extracts_names_links_and_image_urls_with_limit(self):
        html = """
        <div role="article">
          <a href="/maps/place/Kopi+Satu/@-7.1,110.1,17z">Kopi Satu</a>
          <img src="https://lh3.googleusercontent.com/photo-one=w408-h306-k-no" />
          <span aria-label="4.7 stars">4.7</span>
        </div>
        <div role="article">
          <a href="https://www.google.com/maps/place/Kopi+Dua/@-7.2,110.2,17z">Kopi Dua</a>
          <img data-src="https://lh3.googleusercontent.com/photo-two=w408-h306-k-no" />
          <span aria-label="4.5 stars">4.5</span>
        </div>
        """

        places = parse_place_cards(html, limit=1)

        self.assertEqual(len(places), 1)
        self.assertEqual(places[0]["name"], "Kopi Satu")
        self.assertEqual(
            places[0]["maps_url"],
            "https://www.google.com/maps/place/Kopi+Satu/@-7.1,110.1,17z",
        )
        self.assertEqual(
            places[0]["image_urls"],
            ["https://lh3.googleusercontent.com/photo-one=w1200-h900-k-no"],
        )
        self.assertEqual(places[0]["rating"], "4.7")

    def test_merge_scrape_payloads_preserves_source_queries_for_filter_sync(self):
        first = mark_source_query(
            {
                "query": "cafe wifi kencang jogja",
                "limit": 1,
                "places": [
                    {
                        "name": "Kopi Satu",
                        "maps_url": "https://www.google.com/maps/place/Kopi+Satu/data=!4m7!3m6!1s0xabc:0xdef",
                        "place_id": "0xabc:0xdef",
                        "image_urls": ["https://lh3.googleusercontent.com/photo-one=w1200-h900-k-no"],
                    }
                ],
            },
            "cafe wifi kencang jogja",
        )
        second = mark_source_query(
            {
                "query": "cafe murah jogja",
                "limit": 1,
                "places": [
                    {
                        "name": "Kopi Satu",
                        "maps_url": "https://www.google.com/maps/place/Kopi+Satu/data=!4m7!3m6!1s0xabc:0xdef",
                        "place_id": "0xabc:0xdef",
                        "image_urls": ["https://lh3.googleusercontent.com/photo-two=w1200-h900-k-no"],
                    }
                ],
            },
            "cafe murah jogja",
        )

        merged = merge_scrape_payloads([first, second])

        self.assertEqual(len(merged["places"]), 1)
        self.assertEqual(
            merged["places"][0]["source_queries"],
            ["cafe wifi kencang jogja", "cafe murah jogja"],
        )
        self.assertEqual(
            merged["places"][0]["image_urls"],
            [
                "https://lh3.googleusercontent.com/photo-one=w1200-h900-k-no",
                "https://lh3.googleusercontent.com/photo-two=w1200-h900-k-no",
            ],
        )

    def test_merge_scrape_payloads_appends_unique_places_without_duplication(self):
        existing = {
            "query": "kopi",
            "limit": 20,
            "places": [
                {
                    "name": "Kopi Satu",
                    "maps_url": "https://www.google.com/maps/place/Kopi+Satu/data=!4m7!3m6!1s0xabc:0xdef",
                    "place_id": "0xabc:0xdef",
                    "source_queries": ["kopi"],
                    "image_urls": [],
                }
            ],
        }
        current = {
            "query": "kopi murah",
            "limit": 20,
            "places": [
                {
                    "name": "Kopi Satu",
                    "maps_url": "https://www.google.com/maps/place/Kopi+Satu/data=!4m7!3m6!1s0xabc:0xdef",
                    "place_id": "0xabc:0xdef",
                    "source_queries": ["kopi murah"],
                    "image_urls": [],
                },
                {
                    "name": "Kopi Dua",
                    "maps_url": "https://www.google.com/maps/place/Kopi+Dua/data=!4m7!3m6!1s0x111:0x222",
                    "place_id": "0x111:0x222",
                    "source_queries": ["kopi murah"],
                    "image_urls": [],
                },
            ],
        }

        merged = merge_scrape_payloads([existing, current])

        self.assertEqual(len(merged["places"]), 2)
        self.assertEqual(
            merged["places"][0]["source_queries"],
            ["kopi", "kopi murah"],
        )

    def test_merge_output_payload_can_replace_or_append_existing_output(self):
        existing = {
            "query": "kopi",
            "limit": 20,
            "places": [
                {
                    "name": "Kopi Satu",
                    "maps_url": "https://www.google.com/maps/place/Kopi+Satu/data=!4m7!3m6!1s0xabc:0xdef",
                    "place_id": "0xabc:0xdef",
                    "source_queries": ["kopi"],
                    "image_urls": [],
                }
            ],
        }
        current = {
            "query": "kopi murah",
            "limit": 20,
            "places": [
                {
                    "name": "Kopi Dua",
                    "maps_url": "https://www.google.com/maps/place/Kopi+Dua/data=!4m7!3m6!1s0x111:0x222",
                    "place_id": "0x111:0x222",
                    "source_queries": ["kopi murah"],
                    "image_urls": [],
                }
            ],
        }

        appended = merge_output_payload(existing, current, replace_output=False)
        replaced = merge_output_payload(existing, current, replace_output=True)

        self.assertEqual(len(appended["places"]), 2)
        self.assertEqual(len(replaced["places"]), 1)
        self.assertEqual(replaced["places"][0]["name"], "Kopi Dua")


if __name__ == "__main__":
    unittest.main()
