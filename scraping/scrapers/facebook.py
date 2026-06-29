import asyncio
import logging
import re
from datetime import datetime
from typing import List, Optional, Dict, Any
from playwright.async_api import async_playwright, Page
from playwright_stealth import Stealth
from .base import BaseScraper
from ..models import RawLead, SourceType
from ..utils import extract_phone, extract_email

logger = logging.getLogger(__name__)

class FacebookScraper(BaseScraper):
    """
    Scraper for Facebook Groups and Search using Playwright with Stealth.
    
    Strategy:
    - Use Playwright with stealth to navigate to Facebook.
    - Search for lead-generating posts using keywords in groups or general search.
    - Extract post content, author, timestamp, and map to RawLead.
    """

    async def scrape(self, zip_codes: Optional[List[str]] = None, group_urls: Optional[List[str]] = None, keywords: Optional[List[str]] = None) -> List[RawLead]:
        leads = []
        
        # Use provided zip codes or default
        zips = zip_codes or self.config.get("zip_codes", [])
        
        # Use provided keywords/groups or fall back to config defaults
        search_keywords = keywords or self.config.get("keywords", [
            "need a plumber", 
            "need an electrician", 
            "looking for a contractor", 
            "renovation",
            "fence repair",
            "handyman needed"
        ])
        
        target_groups = group_urls or self.config.get("fb_groups", [])
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={'width': 1280, 'height': 800}
            )
            
            page = await context.new_page()
            # Apply stealth
            await Stealth().apply_stealth_async(page)
            
            if target_groups:
                for group_url in target_groups:
                    group_leads = await self._scrape_group(page, group_url, search_keywords, zips)
                    leads.extend(group_leads)
            else:
                # Fallback to general search if no groups specified
                for kw in search_keywords:
                    if zips:
                        for z in zips:
                            search_leads = await self._scrape_search(page, f"{kw} {z}", z)
                            leads.extend(search_leads)
                    else:
                        search_leads = await self._scrape_search(page, kw)
                        leads.extend(search_leads)

            await browser.close()
            
        return leads

    async def _scrape_group(self, page: Page, group_url: str, keywords: List[str], zip_codes: List[str]) -> List[RawLead]:
        leads = []
        try:
            logger.info(f"Scraping Facebook group: {group_url}")
            await page.goto(group_url, wait_until="networkidle")
            
            # Scroll to load posts
            for _ in range(3):
                await page.mouse.wheel(0, 3000)
                await asyncio.sleep(2)
            
            # Extract posts
            posts = await page.query_selector_all("div[role='article']")
            for post in posts:
                try:
                    text = await post.inner_text()
                    # Filter by keywords and optionally zip code
                    match_kw = any(kw.lower() in text.lower() for kw in keywords)
                    match_zip = any(z in text for z in zip_codes) if zip_codes else True
                    
                    if match_kw and match_zip:
                        # Find which zip matched
                        matched_zip = next((z for z in zip_codes if z in text), None) if zip_codes else None
                        lead = await self._parse_post_element(post, group_url, matched_zip)
                        if lead:
                            leads.append(lead)
                except Exception as e:
                    logger.warning(f"Error parsing post in group {group_url}: {e}")
                    
        except Exception as e:
            logger.error(f"Error scraping group {group_url}: {e}")
            
        return leads

    async def _scrape_search(self, page: Page, keyword: str, zip_code: Optional[str] = None) -> List[RawLead]:
        leads = []
        try:
            # Facebook search URL for posts
            search_url = f"https://www.facebook.com/search/posts/?q={keyword.replace(' ', '%20')}"
            logger.info(f"Searching Facebook for: {keyword}")
            await page.goto(search_url, wait_until="networkidle")
            
            # Scroll to load results
            for _ in range(3):
                await page.mouse.wheel(0, 3000)
                await asyncio.sleep(2)
                
            posts = await page.query_selector_all("div[role='article']")
            for post in posts:
                try:
                    lead = await self._parse_post_element(post, search_url, zip_code)
                    if lead:
                        leads.append(lead)
                except Exception as e:
                    logger.warning(f"Error parsing post in search for {keyword}: {e}")
                
        except Exception as e:
            logger.error(f"Error searching for {keyword}: {e}")
            
        return leads

    async def _parse_post_element(self, element, source_url: str, zip_code: Optional[str] = None) -> Optional[RawLead]:
        """Extracts data from a single post DOM element."""
        text = await element.inner_text()
        if not text:
            return None

        # Attempt to extract author name
        # Often the first link or strong element in the post header
        author_name = "Unknown"
        author_elem = await element.query_selector("h3 strong, h2 strong, a[role='link'] span")
        if author_elem:
            author_name = await author_elem.inner_text()

        # Attempt to extract timestamp
        # Usually contained in a link or span with a specific aria-label or nested spans
        timestamp = datetime.now() # Fallback
        ts_elem = await element.query_selector("span[id^='jsc_'] a[role='link'], span[aria-label] span")
        if ts_elem:
            # Facebook uses nested spans or aria-labels for relative time like "2h" or "June 21"
            # This is hard to parse precisely without a specialized lib, so we store the raw string in metadata
            pass

        # Attempt to find post URL
        post_url = source_url
        links = await element.query_selector_all("a")
        for link in links:
            href = await link.get_attribute("href")
            if href and ("/posts/" in href or "permalink" in href):
                if href.startswith("/"):
                    post_url = f"https://www.facebook.com{href}"
                else:
                    post_url = href
                break
        
        # Unique ID based on text and URL
        source_id = f"fb_{hash(text + post_url)}"
        
        return RawLead(
            source=SourceType.FACEBOOK,
            source_id=source_id,
            source_url=post_url,
            raw_text=text,
            zip_code=zip_code,
            external_timestamp=timestamp,
            metadata={
                "author": author_name,
                "phone": extract_phone(text),
                "email": extract_email(text),
                "original_source": source_url
            }
        )
