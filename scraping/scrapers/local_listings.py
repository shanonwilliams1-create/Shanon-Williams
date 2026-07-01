"""
Local Listings Scraper — Craigslist and other classifieds
Uses httpx (fast, no browser needed) instead of Playwright.
"""
import asyncio
import logging
import re
from datetime import datetime
from typing import List, Optional
import httpx

from .base import BaseScraper
from ..models import RawLead, SourceType
from ..utils import extract_phone, extract_email

logger = logging.getLogger(__name__)

# Craigslist city -> zip mapping for Texas
TEXAS_CITIES = {
    "austin": ["78653", "78654", "78660", "78701", "78702", "78704"],
    "sanantonio": ["78201", "78205", "78209", "78210", "78212"],
    "houston": ["77001", "77002", "77003", "77004", "77005"],
    "dallas": ["75201", "75202", "75204", "75205", "75206"],
    "ftworth": ["76101", "76102", "76103", "76104", "76105"],
}

class LocalListingsScraper(BaseScraper):
    """
    Scraper for Craigslist and local classifieds.
    Uses httpx — fast, no browser overhead.
    """

    async def scrape(self, zip_codes: Optional[List[str]] = None, cities: Optional[List[str]] = None, keywords: Optional[List[str]] = None) -> List[RawLead]:
        leads = []

        target_zips = zip_codes or self.config.get("zip_codes", [])
        target_cities = cities or self.config.get("cities", [])
        search_keywords = keywords or self.config.get("keywords", [
            "remodel", "home renovation", "plumber", "electrician",
            "fence", "deck", "roof", "painter", "handyman",
            "contractor", "landscaping", "drywall", "flooring",
            "cabinets", "countertops", "demolition",
        ])

        # If no cities specified, find matching cities from zip codes
        if not target_cities and target_zips:
            for city, zips in TEXAS_CITIES.items():
                if any(z in target_zips for z in zips):
                    target_cities.append(city)
            target_cities = list(set(target_cities))

        if not target_cities:
            target_cities = ["austin", "sanantonio"]

        logger.info(f"Scraping Craigslist cities={target_cities} zips={target_zips} kw={len(search_keywords)}")

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            for city in target_cities:
                for kw in search_keywords:
                    try:
                        city_leads = await self._scrape_craigslist(client, city, kw)
                        leads.extend(city_leads)
                        # Brief pause between requests to be polite
                        await asyncio.sleep(1)
                    except Exception as e:
                        logger.warning(f"Error scraping {city}/{kw}: {e}")

        # Filter by zip if needed
        if target_zips:
            filtered = []
            for lead in leads:
                for z in target_zips:
                    if z in lead.raw_text:
                        lead.zip_code = z
                        filtered.append(lead)
                        break
            logger.info(f"Filtered {len(leads)} leads to {len(filtered)} by zip {target_zips}")
            leads = filtered

        logger.info(f"Total leads found: {len(leads)}")
        return leads

    async def _scrape_craigslist(self, client: httpx.AsyncClient, city: str, keyword: str) -> List[RawLead]:
        """Scrape Craigslist gigs/services for a city + keyword."""
        leads = []
        url = f"https://{city}.craigslist.org/search/ggg?query={keyword.replace(' ', '+')}&sort=date"

        try:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            if resp.status_code != 200:
                logger.debug(f"CL {city}/{keyword}: HTTP {resp.status_code}")
                return leads

            html = resp.text

            # Parse post listings — Craigslist uses postings JSON embedded or simple HTML
            # Try to find post URLs and titles
            post_pattern = re.compile(
                r'<a\s+href="(/[^"]+/d/[^"]+\.html)"[^>]*>([^<]+)</a>',
                re.IGNORECASE
            )
            matches = post_pattern.findall(html)

            # Also try newer CL format
            if not matches:
                post_pattern = re.compile(
                    r'<a\s+class="[^"]*cl-app-anchor[^"]*"[^>]*href="(/[^"]+)"[^>]*>([^<]+)</a>',
                    re.IGNORECASE
                )
                matches = post_pattern.findall(html)

            seen = set()
            for href, title in matches:
                full_url = f"https://{city}.craigslist.org{href}" if href.startswith("/") else href
                if full_url in seen:
                    continue
                seen.add(full_url)

                lead = await self._scrape_post(client, full_url, title.strip())
                if lead:
                    leads.append(lead)

                if len(leads) >= 15:  # Limit per keyword
                    break

        except Exception as e:
            logger.warning(f"Request error for {url}: {e}")

        return leads

    async def _scrape_post(self, client: httpx.AsyncClient, url: str, title: str) -> Optional[RawLead]:
        """Scrape an individual Craigslist post."""
        try:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            if resp.status_code != 200:
                return None

            html = resp.text

            # Extract body text — try different CL formats
            body = ""

            # Try #postingbody
            body_match = re.search(r'<section\s+id="postingbody"[^>]*>(.*?)</section>', html, re.DOTALL)
            if body_match:
                body = re.sub(r'<[^>]+>', '', body_match.group(1)).strip()

            # Try meta description
            if not body:
                desc_match = re.search(r'<meta\s+name="description"[^>]*content="([^"]+)"', html)
                if desc_match:
                    body = desc_match.group(1)

            if not body:
                return None

            full_text = f"{title}\n{body}"

            # Extract post ID from URL
            post_id_match = re.search(r'/(\d+)\.html', url)
            source_id = f"cl_{post_id_match.group(1)}" if post_id_match else f"cl_{abs(hash(url))}"

            # Extract location from post
            location = ""
            loc_match = re.search(r'<span[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)</span>', html, re.IGNORECASE)
            if loc_match:
                location = loc_match.group(1).strip()

            return RawLead(
                source=SourceType.LOCAL_LISTINGS,
                source_id=source_id,
                source_url=url,
                raw_text=full_text,
                zip_code=None,  # Will be set by zip filter in scrape()
                external_timestamp=datetime.now(),
                metadata={
                    "city": location or url.split('.')[0].replace('https://', ''),
                    "phone": extract_phone(full_text),
                    "email": extract_email(full_text)
                }
            )

        except Exception as e:
            logger.warning(f"Error scraping post {url}: {e}")
            return None