import asyncio
import httpx
import logging
from typing import Dict, Any, List
from .models import EnrichedLead
from .pipeline import process_leads, ScraperPipeline
from .config import config

logger = logging.getLogger("leadforge.dispatcher")

BACKEND_API_URL = "http://localhost:3000/api/leads"

async def dispatch_lead(enriched_lead: EnrichedLead):
    """Push an enriched lead to the core API."""
    # Map EnrichedLead to the format backend expects
    payload = {
        "source": enriched_lead.raw_lead.source,
        "source_url": enriched_lead.raw_lead.source_url,
        "source_id": enriched_lead.raw_lead.source_id,
        "zip_code": enriched_lead.raw_lead.zip_code,
        "project_title": enriched_lead.project_title,
        "description": enriched_lead.description,
        "contact_name": enriched_lead.contact_name,
        "contact_email": enriched_lead.contact_email,
        "contact_phone": enriched_lead.contact_phone,
        "address_street": enriched_lead.address_street,
        "address_city": enriched_lead.address_city,
        "address_state": enriched_lead.address_state,
        "address_zip": enriched_lead.address_zip,
        "lat": enriched_lead.lat,
        "lng": enriched_lead.lng,
        "trade_category": enriched_lead.trade_category,
        "budget_min": enriched_lead.budget_min,
        "budget_max": enriched_lead.budget_max,
        "project_timeline": enriched_lead.project_timeline,
        "lead_score": enriched_lead.confidence_score,
        "raw_data": enriched_lead.raw_lead.dict(),
        "discovered_at": enriched_lead.raw_lead.external_timestamp.isoformat()
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                BACKEND_API_URL,
                json=payload
            )
            response.raise_for_status()
            logger.info(f"Successfully dispatched lead {enriched_lead.raw_lead.source_id}")
            return response.json()
        except Exception as e:
            logger.error(f"Failed to dispatch lead {enriched_lead.raw_lead.source_id}: {e}")
            return None

async def run_pipeline():
    """
    Full pipeline execution:
    - Runs all enabled scrapers (via ScraperPipeline)
    - Passes results through pipeline.process_leads() (normalize → dedup → enrich)
    - Dispatches each enriched lead to the API via POST
    """
    logger.info("Starting integrated scraper pipeline...")
    
    pipeline = ScraperPipeline()
    all_raw_leads = []
    target_zips = config.target_zip_codes
    
    for scraper in pipeline.scrapers:
        try:
            logger.info(f"Running scraper: {scraper.__class__.__name__}")
            leads = await scraper.scrape(zip_codes=target_zips)
            all_raw_leads.extend(leads)
            logger.info(f"Found {len(leads)} leads from {scraper.__class__.__name__}")
        except Exception as e:
            logger.error(f"Error running scraper {scraper.__class__.__name__}: {e}")

    if not all_raw_leads:
        logger.info("No leads found. Pipeline finished.")
        return

    # 2. Process leads (normalize → dedup → enrich)
    enriched_leads = process_leads(all_raw_leads)
    logger.info(f"Processed into {len(enriched_leads)} unique enriched leads.")

    # 3. Dispatch leads
    for lead in enriched_leads:
        await dispatch_lead(lead)

    logger.info("Pipeline execution completed.")
