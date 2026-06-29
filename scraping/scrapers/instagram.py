import asyncio
import logging
from datetime import datetime
from typing import List, Optional
from playwright.async_api import async_playwright, Page
from playwright_stealth import Stealth
from .base import BaseScraper
from ..models import RawLead, SourceType
from ..utils import extract_phone, extract_email

logger = logging.getLogger(__name__)

class InstagramScraper(BaseScraper):
    """
    Scraper for Instagram using Playwright with Stealth.
    Searches for leads via hashtags.
    """

    async def scrape(self, zip_codes: Optional[List[str]] = None, hashtags: Optional[List[str]] = None) -> List[RawLead]:
        leads = []
        
        search_hashtags = hashtags or self.config.get("hashtags", [
            "hiringcontractor",
            "needaplumber",
            "remodel",
            "hiringhandyman",
            "constructionjobs"
        ])
        
        zips = zip_codes or self.config.get("zip_codes", [])
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={'width': 1280, 'height': 800}
            )
            
            page = await context.new_page()
            await Stealth().apply_stealth_async(page)
            
            for tag in search_hashtags:
                if zips:
                    for z in zips:
                        # Searching by hashtag + zip is not standard but we can try keywords or filtering
                        tag_leads = await self._scrape_hashtag(page, f"{tag}_{z}", z)
                        leads.extend(tag_leads)
                        # Also try just the tag and filter by zip in text
                        tag_leads = await self._scrape_hashtag(page, tag, z)
                        leads.extend(tag_leads)
                else:
                    tag_leads = await self._scrape_hashtag(page, tag)
                    leads.extend(tag_leads)

            await browser.close()
            
        return leads

    async def _scrape_hashtag(self, page: Page, tag: str, zip_code: Optional[str] = None) -> List[RawLead]:
        leads = []
        try:
            url = f"https://www.instagram.com/explore/tags/{tag}/"
            logger.info(f"Scraping Instagram hashtag: #{tag}")
            await page.goto(url, wait_until="networkidle")
            
            # Wait for content or login wall
            await asyncio.sleep(5)
            
            if "login" in page.url:
                logger.warning(f"Instagram login wall encountered for #{tag}")
                return leads

            # Scroll to load more
            for _ in range(2):
                await page.mouse.wheel(0, 2000)
                await asyncio.sleep(2)
            
            links = await page.query_selector_all("a[href*='/p/']")
            post_urls = []
            for link in links:
                href = await link.get_attribute("href")
                if href:
                    full_url = f"https://www.instagram.com{href}" if href.startswith("/") else href
                    if full_url not in post_urls:
                        post_urls.append(full_url)
            
            for post_url in post_urls[:5]:
                lead = await self._scrape_post(page, post_url, zip_code)
                if lead:
                    leads.append(lead)
                    
        except Exception as e:
            logger.error(f"Error scraping hashtag #{tag}: {e}")
            
        return leads

    async def _scrape_post(self, page: Page, post_url: str, zip_code: Optional[str] = None) -> Optional[RawLead]:
        try:
            await page.goto(post_url, wait_until="networkidle")
            await asyncio.sleep(2)
            
            # Extract caption
            caption_elem = await page.query_selector("h1, span._ap3a")
            text = await caption_elem.inner_text() if caption_elem else ""
            
            if not text:
                return None
            
            # Filter by zip if provided
            if zip_code and zip_code not in text:
                return None
                
            # Extract author
            author_elem = await page.query_selector("a.x1i10hfl")
            author_name = await author_elem.inner_text() if author_elem else "Unknown"
            
            # Unique ID
            source_id = f"ig_{post_url.split('/')[-2]}"
            
            return RawLead(
                source=SourceType.INSTAGRAM,
                source_id=source_id,
                source_url=post_url,
                raw_text=text,
                zip_code=zip_code,
                external_timestamp=datetime.now(),
                metadata={
                    "author": author_name,
                    "phone": extract_phone(text),
                    "email": extract_email(text)
                }
            )
        except Exception as e:
            logger.warning(f"Error scraping Instagram post {post_url}: {e}")
            return None
