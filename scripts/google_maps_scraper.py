#!/usr/bin/env python3
"""Small Google Maps discovery scraper for local dataset enrichment.

The scraper intentionally keeps conservative defaults. It uses Selenium to load
Google Maps, then BeautifulSoup to parse the loaded HTML snapshot.

Caching: results are stored per-query in a cache index file. If a query has
already been scraped, the cached result is returned immediately without hitting
the browser — unless --force-refresh is passed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import parse_qsl, quote_plus, urlencode, urljoin, urlparse, urlunparse

from bs4 import BeautifulSoup


GOOGLE_MAPS_ORIGIN = "https://www.google.com"
DEFAULT_LIMIT = 5
MAX_SAFE_LIMIT = 50
DEFAULT_DELAY_SECONDS = 2.5
MIN_DELAY_SECONDS = 2.0

# Cache index file lives next to the output file (same directory).
CACHE_INDEX_FILENAME = ".scrape_cache_index.json"


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def _query_key(query: str, limit: int) -> str:
    """Deterministic cache key derived from (query, limit)."""
    raw = f"{query.strip().lower()}|limit={limit}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _load_cache_index(cache_path: Path) -> Dict[str, Any]:
    if cache_path.exists():
        try:
            return json.loads(cache_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def _save_cache_index(cache_path: Path, index: Dict[str, Any]) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(
        json.dumps(index, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def get_cached_result(
    cache_dir: Path,
    query: str,
    limit: int,
) -> Optional[Dict[str, Any]]:
    """Return cached payload if it exists, otherwise None."""
    index = _load_cache_index(cache_dir / CACHE_INDEX_FILENAME)
    key = _query_key(query, limit)
    entry = index.get(key)
    if not entry:
        return None

    result_file = cache_dir / entry["file"]
    if not result_file.exists():
        return None

    try:
        payload = json.loads(result_file.read_text(encoding="utf-8"))
        return payload
    except (json.JSONDecodeError, OSError):
        return None


def save_to_cache(
    cache_dir: Path,
    query: str,
    limit: int,
    payload: Dict[str, Any],
) -> None:
    """Persist payload and record it in the cache index."""
    key = _query_key(query, limit)
    filename = f"scrape_{key[:12]}.json"
    result_file = cache_dir / filename

    result_file.parent.mkdir(parents=True, exist_ok=True)
    result_file.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    index_path = cache_dir / CACHE_INDEX_FILENAME
    index = _load_cache_index(index_path)
    index[key] = {
        "query": query,
        "limit": limit,
        "file": filename,
        "scraped_at": payload.get("scraped_at", ""),
    }
    _save_cache_index(index_path, index)


def list_cached_queries(cache_dir: Path) -> List[Dict[str, Any]]:
    """Return a summary list of all cached queries."""
    index = _load_cache_index(cache_dir / CACHE_INDEX_FILENAME)
    return list(index.values())


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def clamp_limit(value: int) -> int:
    return max(1, min(value, MAX_SAFE_LIMIT))


def clamp_delay(value: float) -> float:
    return max(MIN_DELAY_SECONDS, value)


def clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def dedupe_keep_order(values: Iterable[str]) -> List[str]:
    seen = set()
    result = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            result.append(value)
    return result


def normalize_maps_url(href: Optional[str]) -> str:
    if not href:
        return ""
    href = href.strip()
    if href.startswith("/"):
        return urljoin(GOOGLE_MAPS_ORIGIN, href)
    if href.startswith("https://www.google.com/maps") or href.startswith("https://maps.google.com"):
        return href
    return ""


def is_maps_place_url(href: Optional[str]) -> bool:
    normalized = normalize_maps_url(href)
    return "/maps/place/" in normalized or "/maps/search/" in normalized


def to_large_google_image_url(src: str) -> str:
    if not src:
        return ""

    parsed = urlparse(src)
    if parsed.netloc == "streetviewpixels-pa.googleapis.com":
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        query["w"] = "1200"
        query["h"] = "900"
        return urlunparse(parsed._replace(query=urlencode(query)))

    if "googleusercontent.com" in parsed.netloc:
        if re.search(r"=w\d+-h\d+", src):
            return re.sub(r"=w\d+-h\d+(-p)?(-k-no)?$", "=w1200-h900-k-no", src)
        if "=" not in src:
            return f"{src}=w1200-h900-k-no"

    return src


def extract_image_urls(container: Any) -> List[str]:
    urls = []
    for image in container.find_all("img"):
        for attr in ("src", "data-src"):
            src = clean_text(image.get(attr))
            if not src or src.startswith("data:"):
                continue
            if src.startswith("//"):
                src = f"https:{src}"
            if src.startswith("http"):
                urls.append(to_large_google_image_url(src))
    return dedupe_keep_order(urls)


def extract_rating(container: Any) -> str:
    for element in container.find_all(attrs={"aria-label": True}):
        label = clean_text(element.get("aria-label"))
        match = re.search(r"\b([0-5](?:[.,]\d)?)\s*(?:stars?|bintang)\b", label, re.IGNORECASE)
        if match:
            return match.group(1).replace(",", ".")

    text = container.get_text(" ", strip=True)
    match = re.search(r"\b([0-5](?:[.,]\d)?)\s*(?:stars?|bintang)\b", text, re.IGNORECASE)
    return match.group(1).replace(",", ".") if match else ""


def extract_review_count(container: Any) -> str:
    """Extract total number of reviews e.g. '(1.234)' → '1234'."""
    text = container.get_text(" ", strip=True)
    # Matches (1.234) or (1,234) or (123)
    match = re.search(r"\(\s*([\d][.,\d]*)\s*\)", text)
    if match:
        raw = match.group(1).replace(".", "").replace(",", "")
        return raw if raw.isdigit() else ""
    return ""


def extract_name(anchor: Any, container: Any) -> str:
    for candidate in (anchor.get("aria-label"), anchor.get_text(" ", strip=True)):
        name = clean_text(candidate)
        if name:
            return name

    for text in container.stripped_strings:
        candidate = clean_text(text)
        if candidate and len(candidate) > 2:
            return candidate
    return ""


def extract_category(container: Any, name: str) -> str:
    """Extract business category / type e.g. 'Kedai Kopi', 'Restoran'."""
    full_text = clean_text(container.get_text(" ", strip=True))
    # Category usually appears right after the name in the card text
    after_name = full_text.replace(name, "", 1).strip()

    # Try aria-label on span/div elements that look like category chips
    for el in container.find_all(["span", "div"], attrs={"aria-label": True}):
        label = clean_text(el.get("aria-label"))
        # Skip labels that look like ratings or reviews
        if label and not re.search(r"[\d]", label) and len(label) < 60:
            if any(kw in label.lower() for kw in ("kopi", "cafe", "resto", "makan", "food", "coffee", "bar", "bakery", "bistro", "warung")):
                return label

    # Fallback: first short segment after rating pattern
    # e.g. "4,4 · Kedai Kopi · Jl. Affandi..."
    match = re.search(r"[0-5][.,]\d\s*·?\s*([^·\n]{3,50}?)(?:\s*·|\s*$)", after_name)
    if match:
        candidate = clean_text(match.group(1))
        if candidate and not re.search(r"\d{2,}", candidate):
            return candidate
    return ""


def extract_address(container: Any) -> str:
    """Extract street address from card text."""
    text = clean_text(container.get_text(" ", strip=True))

    # Common Indonesian street prefixes
    match = re.search(
        r"(Jl\.?\s+[^·\n,]{5,80}|Jalan\s+[^·\n,]{5,80}|Gang\s+[^·\n,]{5,60}|Gg\.?\s+[^·\n,]{5,60})",
        text,
        re.IGNORECASE,
    )
    return clean_text(match.group(1)) if match else ""


def extract_open_status(container: Any) -> Dict[str, str]:
    """Extract open/close status and closing time.

    Returns dict with keys:
      - status: 'open' | 'closed' | 'unknown'
      - closes_at: e.g. '01.00' or ''
      - opens_at: e.g. '08.00' or ''
      - raw: original text snippet
    """
    text = clean_text(container.get_text(" ", strip=True))

    result: Dict[str, str] = {"status": "unknown", "closes_at": "", "opens_at": "", "raw": ""}

    # Indonesian & English open signals
    open_match = re.search(
        r"(Buka\b[^·\n]{0,60}|Open\b[^·\n]{0,60})",
        text,
        re.IGNORECASE,
    )
    close_match = re.search(
        r"(Tutup\b[^·\n]{0,60}|Closed\b[^·\n]{0,60})",
        text,
        re.IGNORECASE,
    )

    if open_match:
        result["status"] = "open"
        result["raw"] = clean_text(open_match.group(1))
        # "Tutup pukul 01.00" often appears right after "Buka ·"
        t = re.search(r"[Tt]utup\s+pukul\s+([\d]{1,2}[.:]\d{2})", text)
        if t:
            result["closes_at"] = t.group(1)
        t2 = re.search(r"[Bb]uka\s+pukul\s+([\d]{1,2}[.:]\d{2})", text)
        if t2:
            result["opens_at"] = t2.group(1)
    elif close_match:
        result["status"] = "closed"
        result["raw"] = clean_text(close_match.group(1))
        t3 = re.search(r"[Bb]uka\s+pukul\s+([\d]{1,2}[.:]\d{2})", text)
        if t3:
            result["opens_at"] = t3.group(1)

    return result


def extract_price_level(container: Any) -> str:
    """Extract price indicator: '·' separated segment that looks like currency symbol."""
    text = clean_text(container.get_text(" ", strip=True))
    # Google Maps uses Rp, $, ££, etc. between dots
    match = re.search(r"·\s*(Rp[\s\d.,]+|[$€£]{1,3})\s*·", text)
    return clean_text(match.group(1)) if match else ""


def extract_coordinates_from_url(maps_url: str) -> Dict[str, str]:
    """Parse lat/lng from Google Maps place URL if present."""
    match = re.search(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)", maps_url)
    if match:
        return {"lat": match.group(1), "lng": match.group(2)}
    return {"lat": "", "lng": ""}


def extract_place_id(maps_url: str) -> str:
    """Extract the CID / place data identifier from maps URL."""
    # Format: 0x...:0x...
    match = re.search(r"(0x[0-9a-f]+:0x[0-9a-f]+)", maps_url, re.IGNORECASE)
    return match.group(1) if match else ""


def text_preview(container: Any) -> str:
    text = clean_text(container.get_text(" ", strip=True))
    return text[:400]


def find_candidate_containers(soup: BeautifulSoup) -> List[Any]:
    containers = soup.select('[role="article"], div.Nv2PK, div[aria-label][role="article"]')
    if containers:
        return containers

    fallback = []
    for anchor in soup.find_all("a", href=is_maps_place_url):
        fallback.append(anchor.find_parent("div") or anchor)
    return fallback


def parse_place_cards(html: str, limit: int = DEFAULT_LIMIT) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    safe_limit = clamp_limit(limit)
    places = []
    seen_urls = set()

    for container in find_candidate_containers(soup):
        anchor = container.find("a", href=is_maps_place_url)
        if not anchor and getattr(container, "name", "") == "a" and is_maps_place_url(container.get("href")):
            anchor = container
        if not anchor:
            continue

        maps_url = normalize_maps_url(anchor.get("href"))
        if not maps_url or maps_url in seen_urls:
            continue

        name = extract_name(anchor, container)
        if not name:
            continue

        seen_urls.add(maps_url)

        coords = extract_coordinates_from_url(maps_url)
        open_status = extract_open_status(container)

        places.append(
            {
                # ── Identity ─────────────────────────────────────────────
                "name": name,
                "maps_url": maps_url,
                "place_id": extract_place_id(maps_url),
                # ── Location ─────────────────────────────────────────────
                "address": extract_address(container),
                "lat": coords["lat"],
                "lng": coords["lng"],
                # ── Business info ─────────────────────────────────────────
                "category": extract_category(container, name),
                "price_level": extract_price_level(container),
                # ── Ratings ───────────────────────────────────────────────
                "rating": extract_rating(container),
                "review_count": extract_review_count(container),
                # ── Hours ─────────────────────────────────────────────────
                "is_open": open_status["status"],
                "closes_at": open_status["closes_at"],
                "opens_at": open_status["opens_at"],
                # ── Media ─────────────────────────────────────────────────
                "image_urls": extract_image_urls(container),
                # ── Raw fallback ──────────────────────────────────────────
                "text_preview": text_preview(container),
            }
        )

        if len(places) >= safe_limit:
            break

    return places


def mark_source_query(payload: Dict[str, Any], query: str) -> Dict[str, Any]:
    for place in payload.get("places", []):
        place["source_query"] = query
        place["source_queries"] = dedupe_keep_order([query] + place.get("source_queries", []))
    return payload


def merge_scrape_payloads(payloads: List[Dict[str, Any]]) -> Dict[str, Any]:
    merged_places: Dict[str, Dict[str, Any]] = {}

    for payload in payloads:
        query = payload.get("query", "")
        for place in payload.get("places", []):
            key = place.get("place_id") or place.get("maps_url") or place.get("name")
            if not key:
                continue

            if key not in merged_places:
                merged_places[key] = {
                    **place,
                    "source_queries": dedupe_keep_order(place.get("source_queries", []) or ([query] if query else [])),
                }
                continue

            current = merged_places[key]
            current["source_queries"] = dedupe_keep_order(
                current.get("source_queries", []) + place.get("source_queries", []) + ([query] if query else [])
            )
            current["source_query"] = " | ".join(current["source_queries"])
            current["image_urls"] = dedupe_keep_order(current.get("image_urls", []) + place.get("image_urls", []))[:10]

            for field in ("category", "price_level", "address", "review_count", "is_open", "closes_at", "opens_at", "lat", "lng"):
                if not current.get(field) and place.get(field):
                    current[field] = place[field]

    queries = [payload.get("query", "") for payload in payloads if payload.get("query")]
    return {
        "query": " | ".join(queries),
        "source": "google_maps_html",
        "source_url": "",
        "limit": sum(int(payload.get("limit", 0) or 0) for payload in payloads),
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "places": list(merged_places.values()),
    }


def merge_output_payload(
    existing_payload: Optional[Dict[str, Any]],
    current_payload: Dict[str, Any],
    replace_output: bool = False,
) -> Dict[str, Any]:
    if replace_output or not existing_payload:
        return current_payload

    return merge_scrape_payloads([existing_payload, current_payload])


def read_output_payload(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


# ---------------------------------------------------------------------------
# Browser / Selenium helpers
# ---------------------------------------------------------------------------

def build_search_url(query: str) -> str:
    return f"{GOOGLE_MAPS_ORIGIN}/maps/search/{quote_plus(query)}"


def create_driver(headless: bool):
    from selenium import webdriver

    options = webdriver.ChromeOptions()
    options.add_argument("--lang=id-ID")
    options.add_argument("--window-size=1365,900")
    options.add_argument("--disable-notifications")
    if headless:
        options.add_argument("--headless=new")
    return webdriver.Chrome(options=options)


def wait_for_maps(driver: Any, timeout: int) -> None:
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait

    WebDriverWait(driver, timeout).until(EC.presence_of_element_located((By.TAG_NAME, "body")))


def try_accept_consent(driver: Any) -> None:
    from selenium.common.exceptions import WebDriverException
    from selenium.webdriver.common.by import By

    labels = ("Accept all", "I agree", "Saya setuju", "Setuju", "Terima semua")
    for label in labels:
        try:
            buttons = driver.find_elements(
                By.XPATH,
                f"//button//*[contains(normalize-space(), '{label}')]/ancestor::button",
            )
            if buttons:
                buttons[0].click()
                time.sleep(1)
                return
        except WebDriverException:
            continue


def _count_place_cards(driver: Any) -> int:
    """Count how many place cards are currently visible in the DOM."""
    from selenium.webdriver.common.by import By
    try:
        cards = driver.find_elements(By.CSS_SELECTOR, '[role="article"], div.Nv2PK')
        return len(cards)
    except Exception:
        return 0


def _end_of_list_reached(driver: Any) -> bool:
    """Return True if Google Maps shows the 'end of list' signal."""
    from selenium.webdriver.common.by import By
    try:
        # Google Maps renders a span with role="img" and aria-label that contains
        # "Anda telah mencapai akhir daftar" (ID) or "You've reached the end of the list" (EN)
        end_signals = driver.find_elements(
            By.XPATH,
            "//*[contains(@aria-label, 'akhir daftar') or contains(@aria-label, 'end of the list')]",
        )
        return len(end_signals) > 0
    except Exception:
        return False


def scroll_results(driver: Any, delay_seconds: float, max_scrolls: int, target_limit: int = MAX_SAFE_LIMIT) -> None:
    """Scroll the results panel, waiting for new cards to load after each scroll.

    Stops early when:
    - enough cards (>= target_limit) are loaded, OR
    - Google Maps signals end-of-list, OR
    - two consecutive scrolls yield no new cards (truly stuck).
    """
    from selenium.common.exceptions import WebDriverException
    from selenium.webdriver.common.by import By

    delay = clamp_delay(delay_seconds)
    stale_scrolls = 0

    for scroll_num in range(max(0, max_scrolls)):
        prev_count = _count_place_cards(driver)

        # Perform the scroll on the feed panel (sidebar), fallback to body
        try:
            feeds = driver.find_elements(By.CSS_SELECTOR, '[role="feed"]')
            target = feeds[0] if feeds else driver.find_element(By.TAG_NAME, "body")
            driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", target)
        except WebDriverException:
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")

        # Wait up to ~4 s for new cards to appear (poll every 0.5 s)
        waited = 0.0
        poll = 0.5
        new_count = prev_count
        while waited < max(delay, 4.0):
            time.sleep(poll)
            waited += poll
            new_count = _count_place_cards(driver)
            if new_count > prev_count:
                break  # new items loaded — no need to keep waiting

        loaded = new_count - prev_count
        print(f"  scroll {scroll_num + 1}/{max_scrolls}: {prev_count} → {new_count} cards (+{loaded})")

        if _end_of_list_reached(driver):
            print("  [scroll] end-of-list marker detected, stopping early.")
            break

        if loaded == 0:
            stale_scrolls += 1
            if stale_scrolls >= 2:
                print("  [scroll] no new cards after 2 scrolls, stopping early.")
                break
        else:
            stale_scrolls = 0  # reset counter when progress is made

        if new_count >= target_limit:
            print(f"  [scroll] reached target of {target_limit} cards, stopping early.")
            break


# ---------------------------------------------------------------------------
# Detail page — image fetcher
# ---------------------------------------------------------------------------

def fetch_place_images(driver: Any, maps_url: str, delay_seconds: float, min_images: int = 3) -> List[str]:
    """Open the place detail page, click the photo panel, and collect image URLs.

    Returns a deduplicated list of at least `min_images` URLs when available.
    Falls back gracefully — never raises.
    """
    from selenium.common.exceptions import WebDriverException, TimeoutException
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait

    delay = clamp_delay(delay_seconds)
    images: List[str] = []

    try:
        driver.get(maps_url)
        # Wait for the main place panel to load
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, '[role="main"], [role="region"]'))
        )
        time.sleep(delay)

        # ── Step 1: grab any images already visible on the detail page ──────
        soup = BeautifulSoup(driver.page_source, "html.parser")
        for img in soup.find_all("img"):
            for attr in ("src", "data-src"):
                src = clean_text(img.get(attr))
                if src and not src.startswith("data:"):
                    if src.startswith("//"):
                        src = f"https:{src}"
                    # Filter out tiny icons (usually < 50 px encoded in URL)
                    if src.startswith("http") and "googleusercontent.com" in src:
                        images.append(to_large_google_image_url(src))

        if len(images) >= min_images:
            return dedupe_keep_order(images)[:10]

        # ── Step 2: try clicking the photo/gallery button ────────────────────
        photo_btn_selectors = [
            'button[aria-label*="foto" i]',
            'button[aria-label*="photo" i]',
            'button[aria-label*="gambar" i]',
            '[data-photo-index]',
            'div[role="img"][aria-label]',
            'button.gallery-button',
        ]
        clicked = False
        for sel in photo_btn_selectors:
            try:
                btns = driver.find_elements(By.CSS_SELECTOR, sel)
                if btns:
                    driver.execute_script("arguments[0].click()", btns[0])
                    time.sleep(delay)
                    clicked = True
                    break
            except WebDriverException:
                continue

        if clicked:
            # Parse the photo viewer page
            soup2 = BeautifulSoup(driver.page_source, "html.parser")
            for img in soup2.find_all("img"):
                for attr in ("src", "data-src"):
                    src = clean_text(img.get(attr))
                    if src and not src.startswith("data:") and "googleusercontent.com" in src:
                        if src.startswith("//"):
                            src = f"https:{src}"
                        images.append(to_large_google_image_url(src))

    except (WebDriverException, TimeoutException, Exception) as exc:
        print(f"  [images] warning for {maps_url}: {exc}")

    return dedupe_keep_order(images)[:10]


# ---------------------------------------------------------------------------
# Core scrape (browser)
# ---------------------------------------------------------------------------

def scrape_google_maps(
    query: str,
    limit: int,
    delay_seconds: float,
    max_scrolls: int,
    headless: bool,
    timeout: int,
    fetch_images: bool = True,
    min_images: int = 3,
) -> Dict[str, Any]:
    safe_limit = clamp_limit(limit)
    driver = create_driver(headless=headless)
    try:
        url = build_search_url(query)
        driver.get(url)
        wait_for_maps(driver, timeout=timeout)
        try_accept_consent(driver)
        time.sleep(clamp_delay(delay_seconds))
        scroll_results(driver, delay_seconds=delay_seconds, max_scrolls=max_scrolls, target_limit=safe_limit)
        places = parse_place_cards(driver.page_source, limit=safe_limit)

        # ── Enrich each place with more images from its detail page ─────────
        if fetch_images:
            for i, place in enumerate(places):
                card_images = place.get("image_urls", [])
                if len(card_images) >= min_images:
                    continue  # already enough from the card
                print(f"  [images] fetching detail for '{place['name']}' ({i+1}/{len(places)}) …")
                detail_images = fetch_place_images(
                    driver,
                    place["maps_url"],
                    delay_seconds=delay_seconds,
                    min_images=min_images,
                )
                # Merge: card images first, then detail images, deduplicated
                merged = dedupe_keep_order(card_images + detail_images)
                place["image_urls"] = merged[:10]

        return {
            "query": query,
            "source": "google_maps_html",
            "source_url": url,
            "limit": safe_limit,
            "scraped_at": datetime.now(timezone.utc).isoformat(),
            "places": places,
        }
    finally:
        driver.quit()


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape small Google Maps candidate data with Selenium + BeautifulSoup."
    )
    parser.add_argument("--query", default="cafe wfc jogja", help="Google Maps search query.")
    parser.add_argument(
        "--queries",
        default="",
        help="Comma-separated Google Maps queries. Example: 'cafe wifi kencang jogja,cafe murah jogja,cafe colokan jogja'.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=DEFAULT_LIMIT,
        help=f"Number of places to keep. Hard capped at {MAX_SAFE_LIMIT}.",
    )
    parser.add_argument(
        "--delay-seconds",
        type=float,
        default=DEFAULT_DELAY_SECONDS,
        help=f"Delay between browser actions. Minimum {MIN_DELAY_SECONDS}s.",
    )
    parser.add_argument(
        "--max-scrolls",
        type=int,
        default=10,
        help="Max number of result-list scrolls. Script stops early if end-of-list or no new cards.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=20,
        help="Browser wait timeout in seconds.",
    )
    parser.add_argument("--headless", action="store_true", help="Run Chrome in headless mode.")
    parser.add_argument(
        "--output",
        default=str(Path(__file__).resolve().parents[1] / "data" / "google-maps-scrape.json"),
        help="JSON output path.",
    )
    # ── Cache controls ──────────────────────────────────────────────────────
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Ignore cached data and re-scrape even if this query was fetched before.",
    )
    parser.add_argument(
        "--replace-output",
        action="store_true",
        help="Replace output file instead of appending and deduplicating with existing output.",
    )
    parser.add_argument(
        "--list-cache",
        action="store_true",
        help="Print all cached queries and exit.",
    )
    parser.add_argument(
        "--cache-dir",
        default=None,
        help=(
            "Directory used to store the cache index and individual result files. "
            "Defaults to the same directory as --output."
        ),
    )
    # ── Image controls ──────────────────────────────────────────────────────
    parser.add_argument(
        "--no-fetch-images",
        action="store_true",
        help="Skip opening detail pages to collect more images (faster, but image_urls may have only 1 entry).",
    )
    parser.add_argument(
        "--min-images",
        type=int,
        default=3,
        help="Minimum number of images to collect per place by visiting its detail page (default: 3).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output = Path(args.output)
    cache_dir = Path(args.cache_dir) if args.cache_dir else output.parent

    # ── --list-cache: show what has been scraped and exit ───────────────────
    if args.list_cache:
        entries = list_cached_queries(cache_dir)
        if not entries:
            print("Cache is empty.")
        else:
            print(f"{'Query':<40} {'Limit':>5}  {'Scraped at'}")
            print("-" * 70)
            for e in entries:
                print(f"{e['query']:<40} {e['limit']:>5}  {e['scraped_at']}")
        return

    safe_limit = clamp_limit(args.limit)
    queries = [q.strip() for q in args.queries.split(",") if q.strip()] or [args.query]
    payloads = []

    for query in queries:
        if not args.force_refresh:
            cached = get_cached_result(cache_dir, query, safe_limit)
            if cached is not None:
                print(
                    f"[cache hit] Query '{query}' (limit={safe_limit}) was scraped on "
                    f"{cached.get('scraped_at', '?')}. Returning {len(cached['places'])} cached places."
                )
                payloads.append(mark_source_query(cached, query))
                continue

        print(f"[scraping] '{query}' (limit={safe_limit}) …")
        payload = scrape_google_maps(
            query=query,
            limit=safe_limit,
            delay_seconds=args.delay_seconds,
            max_scrolls=args.max_scrolls,
            headless=args.headless,
            timeout=args.timeout,
            fetch_images=not args.no_fetch_images,
            min_images=args.min_images,
        )
        payload = mark_source_query(payload, query)
        save_to_cache(cache_dir, query, safe_limit, payload)
        payloads.append(payload)

    payload = payloads[0] if len(payloads) == 1 else merge_scrape_payloads(payloads)
    existing_output = read_output_payload(output)
    payload = merge_output_payload(existing_output, payload, replace_output=args.replace_output)
    write_json(output, payload)
    print(f"Wrote {len(payload['places'])} merged places from {len(queries)} query set(s) to {output}")


if __name__ == "__main__":
    main()
