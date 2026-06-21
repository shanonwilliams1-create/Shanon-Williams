import asyncio
import os
import sys
from datetime import datetime

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scraping.scrapers.facebook import FacebookScraper
from scraping.models import SourceType

async def test_facebook_scraper():
    print("Starting Facebook Scraper test...")
    
    # Set the browsers path for playwright
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = os.path.abspath(os.path.join(os.path.dirname(__file__), ".browsers"))
    
    config = {
        "keywords": ["handyman"],
        "fb_groups": [] # Leave empty for general search
    }
    
    scraper = FacebookScraper(config)
    leads = await scraper.scrape()
    
    print(f"Scraping completed. Found {len(leads)} leads.")
    for lead in leads[:5]:
        print(f"--- Lead ---")
        print(f"Source ID: {lead.source_id}")
        print(f"Text Preview: {lead.raw_text[:100]}...")
        print(f"Phone: {lead.metadata.get('phone')}")
        print(f"Email: {lead.metadata.get('email')}")

if __name__ == "__main__":
    asyncio.run(test_facebook_scraper())
