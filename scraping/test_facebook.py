import asyncio
import os
import sys
from datetime import datetime

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scraping.scrapers.facebook import FacebookScraper
from scraping.models import SourceType

async def test_facebook_scraper():
    print("🚀 Starting Facebook Scraper test...")
    
    # Set the browsers path for playwright
    # Note: Using absolute path to be safe
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = os.path.join(base_dir, ".browsers")
    
    # Configuration for the test
    # Using a sample group URL (public group for testing if possible, or just a dummy one)
    sample_group = "https://www.facebook.com/groups/123456789" # Placeholder
    keywords = ["need a plumber", "renovation", "handyman"]
    
    scraper = FacebookScraper()
    
    print(f"🔍 Scraping with keywords: {keywords}")
    
    # For testing, we might want to use a real public group if we had one, 
    # but for this environment we will just trigger the search fallback 
    # or use the placeholder group.
    try:
        leads = await scraper.scrape(group_urls=[], keywords=keywords)
        
        print(f"\n✅ Scraping completed. Found {len(leads)} leads.")
        
        for i, lead in enumerate(leads[:5]):
            print(f"\n--- Lead #{i+1} ---")
            print(f"Source ID: {lead.source_id}")
            print(f"URL: {lead.source_url}")
            print(f"Author: {lead.metadata.get('author')}")
            print(f"Phone: {lead.metadata.get('phone')}")
            print(f"Email: {lead.metadata.get('email')}")
            print(f"Text Snippet: {lead.raw_text[:150].replace('\n', ' ')}...")
            
    except Exception as e:
        print(f"❌ Error during test: {e}")

if __name__ == "__main__":
    asyncio.run(test_facebook_scraper())
