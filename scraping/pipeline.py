import asyncio
import logging
import httpx
from datetime import datetime
from typing import List
from .scrapers.facebook import FacebookScraper
from .models import RawLead, SourceType

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("leadforge.pipeline")

BACKEND_API_URL = "http://localhost:3000/api/leads"

class ScraperPipeline:
    def __init__(self):
        self.scrapers = [
            FacebookScraper()
            # Add other scrapers here as they are implemented
        ]

    async def run(self):
        logger.info("🚀 Starting Lead Scanning Pipeline...")
        
        all_leads = []
        for scraper in self.scrapers:
            try:
                logger.info(f"Running scraper: {scraper.__class__.__name__}")
                leads = await scraper.scrape()
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
