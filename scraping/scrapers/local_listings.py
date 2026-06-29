import asyncio
import logging
from datetime import datetime
from typing import List, Optional
from playwright.async_api import async_playwright, Page
from .base import BaseScraper
from ..models import RawLead, SourceType
from ..utils import extract_phone, extract_email

logger = logging.getLogger(__name__)

class LocalListingsScraper(BaseScraper):
    """
    Scraper for Local Listings like Craigslist.
    """

    async def scrape(self, zip_codes: Optional[List[str]] = None, cities: Optional[List[str]] = None, keywords: Optional[List[str]] = None) -> List[RawLead]:
        leads = []
        
        target_cities = cities or self.config.get("cities", ["austin", "houston", "dallas"])
        search_keywords = keywords or self.config.get("keywords", ["remodel", "plumber", "electrician", "fence"])
        zips = zip_codes or self.config.get("zip_codes", [])
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            
            for city in target_cities:
                for kw in search_keywords:
                    if zips:
                        for z in zips:
                            city_leads = await self._scrape_craigslist(page, city, f"{kw} {z}", z)
                            leads.extend(city_leads)
                    else:
                        city_leads = await self._scrape_craigslist(page, city, kw)
                        leads.extend(city_leads)

            await browser.close()
            
        return leads

    async def _scrape_craigslist(self, page: Page, city: str, keyword: str, zip_code: Optional[str] = None) -> List[RawLead]:
        leads = []
        try:
            # Craigslist search for gigs (ggg) or for sale (sss)
            url = f"https://{city}.craigslist.org/search/ggg?query={keyword.replace(' ', '%20')}"
            logger.info(f"Scraping Craigslist ({city}): {keyword}")
            await page.goto(url, wait_until="networkidle")
            
            # Extract result links
            links = await page.query_selector_all("a.cl-app-anchor")
            if not links:
                links = await page.query_selector_all("li.result-row a.result-title")

            post_urls = []
            for link in links:
                href = await link.get_attribute("href")
                if href:
                    post_urls.append(href)
            
            for post_url in post_urls[:10]:
                lead = await self._scrape_craigslist_post(page, post_url, zip_code)
                if lead:
                    leads.append(lead)
                    
        except Exception as e:
            logger.error(f"Error scraping Craigslist {city} for {keyword}: {e}")
            
        return leads

    async def _scrape_craigslist_post(self, page: Page, post_url: str, zip_code: Optional[str] = None) -> Optional[RawLead]:
        try:
            await page.goto(post_url, wait_until="networkidle")
            
            # Extract title and body
            title_elem = await page.query_selector("#titletextonly")
            body_elem = await page.query_selector("#postingbody")
            
            title = await title_elem.inner_text() if title_elem else ""
            body = await body_elem.inner_text() if body_elem else ""
            
            full_text = f"{title}\n{body}"
            if not body:
                return None
                
            # Unique ID
            source_id = f"cl_{post_url.split('/')[-1].replace('.html', '')}"
            
            return RawLead(
                source=SourceType.LOCAL_LISTINGS,
                source_id=source_id,
                source_url=post_url,
                raw_text=full_text,
                zip_code=zip_code,
                external_timestamp=datetime.now(),
                metadata={
                    "city": post_url.split('.')[0].replace('https://', ''),
                    "phone": extract_phone(full_text),
                    "email": extract_email(full_text)
                }
            )
        except Exception as e:
            logger.warning(f"Error scraping Craigslist post {post_url}: {e}")
            return None
