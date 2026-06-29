import asyncio
import logging
import httpx
from datetime import datetime
from typing import List
from .scrapers.facebook import FacebookScraper
from .scrapers.instagram import InstagramScraper
from .scrapers.tiktok import TikTokScraper
from .scrapers.snapchat import SnapchatScraper
from .scrapers.nextdoor import NextdoorScraper
from .scrapers.local_listings import LocalListingsScraper
from .models import RawLead, EnrichedLead, SourceType
from .utils import extract_phone, extract_email, classify_trade, geocode_address
from .config import config

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("leadforge.pipeline")

BACKEND_API_URL = "http://localhost:3000/api/leads"

def normalize_lead(raw_lead: RawLead) -> EnrichedLead:
    """Normalize a RawLead into an EnrichedLead with initial enrichment."""
    # Basic mapping
    enriched = EnrichedLead(
        raw_lead=raw_lead,
        project_title=raw_lead.metadata.get("author", "New Lead"),
        description=raw_lead.raw_text,
        contact_name=raw_lead.metadata.get("author"),
        contact_email=raw_lead.metadata.get("email") or extract_email(raw_lead.raw_text),
        contact_phone=raw_lead.metadata.get("phone") or extract_phone(raw_lead.raw_text),
        trade_category=classify_trade(raw_lead.raw_text),
        confidence_score=0.5 # Default starting score
    )
    
    # Try to get coordinates if address is present
    if raw_lead.raw_location:
        lat, lng = geocode_address(raw_lead.raw_location)
        enriched.lat = lat
        enriched.lng = lng
        
    return enriched

def deduplicate_leads(leads: List[RawLead]) -> List[RawLead]:
    """Simple deduplication based on source_id."""
    seen_ids = set()
    unique_leads = []
    for lead in leads:
        if lead.source_id not in seen_ids:
            unique_leads.append(lead)
            seen_ids.add(lead.source_id)
    return unique_leads

def process_leads(raw_leads: List[RawLead]) -> List[EnrichedLead]:
    """Full processing pipeline: normalize → dedup → enrich."""
    # 1. Dedup
    unique_raw = deduplicate_leads(raw_leads)
    
    # 2. Normalize and Enrich
    processed = []
    for raw in unique_raw:
        enriched = normalize_lead(raw)
        processed.append(enriched)
        
    return processed

class ScraperPipeline:
    def __init__(self):
        self.scrapers = []
        
        source_map = {
            "facebook": FacebookScraper,
            "instagram": InstagramScraper,
            "tiktok": TikTokScraper,
            "snapchat": SnapchatScraper,
            "nextdoor": NextdoorScraper,
            "local_listings": LocalListingsScraper
        }
        
        for source_name, scraper_class in source_map.items():
            s_config = config.source_configs.get(source_name, {})
            if s_config.get("enabled", False):
                self.scrapers.append(scraper_class(config=s_config))
                logger.info(f"Loaded scraper for {source_name}")

    async def run(self):
        logger.info("🚀 Starting Lead Scanning Pipeline...")
        
        all_leads = []
        target_zips = config.target_zip_codes
        
        for scraper in self.scrapers:
            try:
                logger.info(f"Running scraper: {scraper.__class__.__name__}")
                leads = await scraper.scrape(zip_codes=target_zips)
                all_leads.extend(leads)
                logger.info(f"Found {len(leads)} leads from {scraper.__class__.__name__}")
            except Exception as e:
                logger.error(f"Error running scraper {scraper.__class__.__name__}: {e}")

        if not all_leads:
            logger.info("No leads found in this run.")
            return

        logger.info(f"Processing {len(all_leads)} total leads...")
        for lead in all_leads:
            await self.send_to_backend(lead)

    async def send_to_backend(self, lead: RawLead):
        """Sends a single lead to the backend API."""
        try:
            # Map RawLead to the format backend expects
            # Backend model fields: source, source_url, source_id, project_title, description, etc.
            payload = {
                "source": lead.source,
                "source_url": lead.source_url,
                "source_id": lead.source_id,
                "zip_code": lead.zip_code,
                "project_title": lead.metadata.get("author", "New Construction Opportunity"),
                "description": lead.raw_text,
                "contact_name": lead.metadata.get("author"),
                "contact_email": lead.metadata.get("email"),
                "contact_phone": lead.metadata.get("phone"),
                "raw_data": lead.dict(),
                "discovered_at": datetime.utcnow().isoformat()
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(BACKEND_API_URL, json=payload)
                if response.status_code in [200, 201]:
                    logger.info(f"Successfully sent lead {lead.source_id} to backend.")
                else:
                    logger.error(f"Failed to send lead {lead.source_id} to backend: {response.status_code} {response.text}")
        except Exception as e:
            logger.error(f"Error sending lead to backend: {e}")

async def main():
    pipeline = ScraperPipeline()
    while True:
        await pipeline.run()
        # Wait for 15 minutes before next run (configurable)
        logger.info("Waiting 15 minutes for next run...")
        await asyncio.sleep(15 * 60)

if __name__ == "__main__":
    asyncio.run(main())
