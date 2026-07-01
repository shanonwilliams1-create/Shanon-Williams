"""
Background Scraper Worker — Runs scrapers on a timer inside the FastAPI process.

Designed for Render: logs appear in Render's dashboard. Runs as an asyncio task
so it doesn't block the web server. Cancelled cleanly on shutdown.
"""
import asyncio
import logging
import sys
from pathlib import Path

# Add project root to sys.path so we can import the scraping module
_project_root = str(Path(__file__).resolve().parent.parent.parent)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

logger = logging.getLogger("leadforge.scraper_worker")

# Scrape interval: 15 minutes
SCRAPE_INTERVAL_SECONDS = 15 * 60

# Internal API endpoint for posting leads
INTERNAL_API_URL = "http://localhost:3000/api/leads"

# Target cities & zip for Texas leads
TARGET_CITIES = ["austin", "sanantonio"]
TARGET_ZIPS = ["78654"]

# Construction/remodel keywords to search for
SEARCH_KEYWORDS = [
    "remodel", "home renovation", "plumber", "electrician",
    "fence", "deck", "roof", "painter", "handyman",
    "contractor", "landscaping", "drywall", "flooring",
    "cabinets", "countertops", "demolition",
]


async def run_scrape_cycle() -> int:
    """
    Run one scrape cycle using the local_listings (Craigslist) scraper.
    Posts found leads to the internal API. Returns the number of leads found.
    """
    try:
        from scraping.scrapers.local_listings import LocalListingsScraper

        scraper = LocalListingsScraper(config={
            "zip_codes": TARGET_ZIPS,
            "cities": TARGET_CITIES,
            "keywords": SEARCH_KEYWORDS,
        })

        leads = await scraper.scrape(
            zip_codes=TARGET_ZIPS,
            cities=TARGET_CITIES,
            keywords=SEARCH_KEYWORDS,
        )

        if not leads:
            logger.info("Scrape cycle complete — no leads found")
            return 0

        logger.info(f"Found {len(leads)} raw leads, posting to API...")

        import httpx
        posted = 0
        async with httpx.AsyncClient(timeout=15.0) as client:
            for lead in leads:
                try:
                    payload = {
                        "source": lead.source.value,
                        "source_id": lead.source_id,
                        "source_url": lead.source_url,
                        "title": f"Lead from {lead.source.value}",
                        "contact_name": lead.metadata.get("name", ""),
                        "contact_email": lead.metadata.get("email", ""),
                        "contact_phone": lead.metadata.get("phone", ""),
                        "address_zip": lead.zip_code or "",
                        "description": lead.raw_text[:500],
                        "trade_category": "general",
                    }
                    resp = await client.post(INTERNAL_API_URL, json=payload)
                    if resp.status_code in (200, 201):
                        posted += 1
                    else:
                        logger.warning(f"API post returned {resp.status_code} for lead {lead.source_id}")
                except Exception as e:
                    logger.warning(f"Failed to post lead {lead.source_id}: {e}")

        logger.info(f"Scrape cycle complete — {posted}/{len(leads)} leads posted")
        return posted

    except ImportError as e:
        logger.warning(f"Could not import scraper (may be missing dependencies): {e}")
        return 0
    except Exception as e:
        logger.error(f"Scrape cycle failed: {e}", exc_info=True)
        return 0


async def scraper_loop(shutdown_event: asyncio.Event):
    """
    Main worker loop: runs scrape cycles every SCRAPE_INTERVAL_SECONDS.
    Stops cleanly when shutdown_event is set.
    """
    logger.info(
        f"Scraper worker started — interval={SCRAPE_INTERVAL_SECONDS}s "
        f"cities={TARGET_CITIES} zips={TARGET_ZIPS}"
    )

    # Run first cycle immediately
    leads_found = await run_scrape_cycle()
    logger.info(f"Initial scrape: {leads_found} leads")

    while not shutdown_event.is_set():
        try:
            # Wait for the interval or until shutdown is requested
            try:
                await asyncio.wait_for(
                    shutdown_event.wait(),
                    timeout=SCRAPE_INTERVAL_SECONDS,
                )
                # shutdown_event was set — exit
                break
            except asyncio.TimeoutError:
                pass  # Normal — interval elapsed, time to scrape

            if shutdown_event.is_set():
                break

            leads_found = await run_scrape_cycle()
            logger.info(f"Scheduled scrape: {leads_found} leads")

        except asyncio.CancelledError:
            logger.info("Scraper worker cancelled")
            break
        except Exception as e:
            logger.error(f"Unexpected error in scraper loop: {e}", exc_info=True)
            # Keep running despite errors
            await asyncio.sleep(60)

    logger.info("Scraper worker stopped")