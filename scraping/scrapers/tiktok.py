import asyncio
import logging
from datetime import datetime
from typing import List, Optional
from playwright.async_api import async_playwright, Page
from .base import BaseScraper
from ..models import RawLead, SourceType
from ..utils import extract_phone, extract_email

logger = logging.getLogger(__name__)

class TikTokScraper(BaseScraper):
    """
    Scraper for TikTok using Playwright.
    """

    async def scrape(self, zip_codes: Optional[List[str]] = None, keywords: Optional[List[str]] = None) -> List[RawLead]:
        leads = []
        search_keywords = keywords or self.config.get("keywords", ["hiring contractor", "need a plumber", "home renovation"])
        zips = zip_codes or self.config.get("zip_codes", [])
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            
            for kw in search_keywords:
                if zips:
                    for z in zips:
                        kw_leads = await self._scrape_search(page, f"{kw} {z}", z)
                        leads.extend(kw_leads)
                else:
                    kw_leads = await self._scrape_search(page, kw)
                    leads.extend(kw_leads)

            await browser.close()
            
        return leads

    async def _scrape_search(self, page: Page, keyword: str, zip_code: Optional[str] = None) -> List[RawLead]:
        leads = []
        try:
            url = f"https://www.tiktok.com/search/video?q={keyword.replace(' ', '%20')}"
            logger.info(f"Searching TikTok for: {keyword}")
            await page.goto(url, wait_until="networkidle")
            
            # TikTok often shows a captcha or login. 
            await asyncio.sleep(5)
            
            # Extract video result links
            video_elements = await page.query_selector_all("div[data-e2e='search_video-item']")
            
            for element in video_elements[:5]:
                try:
                    # Extract description
                    desc_elem = await element.query_selector("div[data-e2e='search_video-item-desc']")
                    description = await desc_elem.inner_text() if desc_elem else ""
                    
                    # Extract link
                    link_elem = await element.query_selector("a")
                    href = await link_elem.get_attribute("href") if link_elem else ""
                    
                    if not description or not href:
                        continue
                        
                    full_url = f"https://www.tiktok.com{href}" if href.startswith("/") else href
                    
                    # Extract author
                    author_elem = await element.query_selector("a[data-e2e='search_video-item-author-name']")
                    author_name = await author_elem.inner_text() if author_elem else "Unknown"

                    source_id = f"tt_{full_url.split('/')[-1]}"
                    
                    leads.append(RawLead(
                        source=SourceType.TIKTOK,
                        source_id=source_id,
                        source_url=full_url,
                        raw_text=description,
                        zip_code=zip_code,
                        external_timestamp=datetime.now(),
                        metadata={
                            "author": author_name,
                            "phone": extract_phone(description),
                            "email": extract_email(description)
                        }
                    ))
                except Exception as e:
                    logger.warning(f"Error parsing TikTok search result: {e}")

        except Exception as e:
            logger.error(f"Error searching TikTok for {keyword}: {e}")
            
        return leads
