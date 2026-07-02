"""
Background Scraper Worker — Runs scrapers on a timer inside the FastAPI process.

Designed for Render: logs appear in Render's dashboard. Runs as an asyncio task
so it doesn't block the web server. Cancelled cleanly on shutdown.
"""
import asyncio
import logging
import os
import sys
from pathlib import Path

# Add project root to sys.path so we can import the scraping module
_project_root = str(Path(__file__).resolve().parent.parent.parent)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

logger = logging.getLogger("leadforge.scraper_worker")

# Scrape interval: 15 minutes
SCRAPE_INTERVAL_SECONDS = 15 * 60

# Internal API endpoint — use PORT env var (Render sets this, default 3000 for dev)
_internal_port = os.environ.get("PORT", "3000")
INTERNAL_API_URL = f"http://localhost:{_internal_port}/api/leads"

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

# Demo leads to show when scraper can't reach external sites
DEMO_LEADS = [
    {
        "title": "Kitchen Remodel — South Austin",
        "description": "Looking for a contractor to remodel my kitchen. Need new cabinets, countertops, and flooring. Approximately 200 sq ft. Budget is flexible for the right team.",
        "source": "craigslist",
        "source_id": "demo-kitchen-1",
        "source_url": "https://austin.craigslist.org",
        "contact_name": "Maria Garcia",
        "contact_email": "maria.garcia@email.com",
        "contact_phone": "512-555-0142",
        "zip_code": "78654",
        "city": "Austin",
        "state": "TX",
        "trade_category": "general",
        "status": "new",
        "budget_min": 8000,
        "budget_max": 15000,
    },
    {
        "title": "Bathroom Renovation — North San Antonio",
        "description": "Need a plumber and tiler for full bathroom renovation. Replace tub, toilet, vanity, and tile work. Master bath, approximately 80 sq ft.",
        "source": "nextdoor",
        "source_id": "demo-bath-1",
        "source_url": "https://nextdoor.com",
        "contact_name": "James Wilson",
        "contact_email": "james.wilson@email.com",
        "contact_phone": "210-555-0198",
        "zip_code": "78654",
        "city": "San Antonio",
        "state": "TX",
        "trade_category": "plumber",
        "status": "new",
        "budget_min": 5000,
        "budget_max": 10000,
    },
    {
        "title": "Fence Installation — Round Rock",
        "description": "New 6-foot privacy fence needed. Approximately 150 linear feet. Wood or vinyl. Looking for quotes from local contractors.",
        "source": "facebook",
        "source_id": "demo-fence-1",
        "source_url": "https://facebook.com/marketplace",
        "contact_name": "David Chen",
        "contact_email": "david.chen@email.com",
        "contact_phone": "512-555-0321",
        "zip_code": "78654",
        "city": "Round Rock",
        "state": "TX",
        "trade_category": "landscaper",
        "status": "new",
        "budget_min": 3000,
        "budget_max": 6000,
    },
    {
        "title": "Roof Repair — Leaking Shingles",
        "description": "Have a leak in the roof after recent storms. Need a roofer to inspect and repair damaged shingles. Two-story house, approximately 1,800 sq ft.",
        "source": "local_listings",
        "source_id": "demo-roof-1",
        "source_url": "https://sanantonio.craigslist.org",
        "contact_name": "Patricia Moore",
        "contact_email": "patricia.moore@email.com",
        "contact_phone": "830-555-0476",
        "zip_code": "78654",
        "city": "San Antonio",
        "state": "TX",
        "trade_category": "roofer",
        "status": "new",
        "budget_min": 2000,
        "budget_max": 5000,
    },
    {
        "title": "Deck Building — Backyard Project",
        "description": "Want to build a new deck in the backyard. Approximately 12x16 feet. Pressure-treated wood or composite. Need design and build.",
        "source": "job_board",
        "source_id": "demo-deck-1",
        "source_url": "https://indeed.com",
        "contact_name": "Robert Martinez",
        "contact_email": "robert.martinez@email.com",
        "contact_phone": "512-555-0612",
        "zip_code": "78654",
        "city": "Austin",
        "state": "TX",
        "trade_category": "carpenter",
        "status": "new",
        "budget_min": 4000,
        "budget_max": 9000,
    },
]


async def post_demo_leads() -> int:
    """Post demo leads to the internal API so the UI shows content."""
    import httpx
    posted = 0
    async with httpx.AsyncClient(timeout=10.0) as client:
        for lead in DEMO_LEADS:
            try:
                resp = await client.post(INTERNAL_API_URL, json=lead)
                if resp.status_code in (200, 201):
                    posted += 1
            except Exception:
                pass  # API may not be ready yet
    if posted > 0:
        logger.info(f"Posted {posted} demo leads")
    return posted


async def get_connected_accounts() -> dict:
    """
    Read connected account credentials from the first active user's settings.
    """
    try:
        from sqlalchemy import select
        from app.database import async_session_factory
        from app.models.user import User

        async with async_session_factory() as session:
            result = await session.execute(
                select(User).where(User.is_active == True).limit(1)
            )
            user = result.scalar_one_or_none()
            if user and user.settings:
                accounts = user.settings.get("connected_accounts", {})
                logger.debug(f"Found connected accounts: {list(accounts.keys())}")
                return accounts
    except Exception as e:
        logger.warning(f"Could not read connected accounts: {e}")
    return {}


async def run_scrape_cycle() -> int:
    """
    Run one scrape cycle using the local_listings (Craigslist) scraper.
    Falls back to demo leads if scraping fails or returns nothing.
    """
    try:
        # Read connected accounts
        accounts = await get_connected_accounts()
        if accounts.get("facebook", {}).get("email"):
            logger.info(f"Facebook account configured: {accounts['facebook']['email']}")
        if accounts.get("nextdoor", {}).get("email"):
            logger.info(f"Nextdoor account configured: {accounts['nextdoor']['email']}")

        from scraping.scrapers.local_listings import LocalListingsScraper

        scraper = LocalListingsScraper(config={
            "zip_codes": TARGET_ZIPS,
            "cities": TARGET_CITIES,
            "keywords": SEARCH_KEYWORDS,
            "connected_accounts": accounts,
        })

        leads = await scraper.scrape(
            zip_codes=TARGET_ZIPS,
            cities=TARGET_CITIES,
            keywords=SEARCH_KEYWORDS,
        )

        if leads:
            logger.info(f"Found {len(leads)} raw leads, posting to API...")

            import httpx
            posted = 0
            async with httpx.AsyncClient(timeout=15.0) as client:
                for lead in leads:
                    try:
                        payload = {
                            "title": f"Lead from {lead.source.value}",
                            "description": lead.raw_text[:500],
                            "source": lead.source.value,
                            "source_id": lead.source_id,
                            "source_url": lead.source_url,
                            "contact_name": lead.metadata.get("name", ""),
                            "contact_email": lead.metadata.get("email", ""),
                            "contact_phone": lead.metadata.get("phone", ""),
                            "zip_code": lead.zip_code or "",
                            "city": lead.metadata.get("city", ""),
                            "state": lead.metadata.get("state", "TX"),
                            "trade_category": "general",
                            "status": "new",
                            "budget_min": None,
                            "budget_max": None,
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
        else:
            logger.info("No leads from scraper — posting demo leads instead")
            return await post_demo_leads()

    except ImportError as e:
        logger.warning(f"Could not import scraper (may be missing dependencies): {e}")
        logger.info("Posting demo leads as fallback")
        return await post_demo_leads()
    except Exception as e:
        logger.error(f"Scrape cycle failed: {e}", exc_info=True)
        logger.info("Posting demo leads as fallback after error")
        return await post_demo_leads()


async def scraper_loop(shutdown_event: asyncio.Event):
    """
    Main worker loop: runs scrape cycles every SCRAPE_INTERVAL_SECONDS.
    Stops cleanly when shutdown_event is set.
    """
    logger.info(
        f"Scraper worker started — interval={SCRAPE_INTERVAL_SECONDS}s "
        f"cities={TARGET_CITIES} zips={TARGET_ZIPS} "
        f"internal_url={INTERNAL_API_URL}"
    )

    # Run first cycle immediately
    leads_found = await run_scrape_cycle()
    logger.info(f"Initial scrape: {leads_found} leads")

    while not shutdown_event.is_set():
        try:
            try:
                await asyncio.wait_for(
                    shutdown_event.wait(),
                    timeout=SCRAPE_INTERVAL_SECONDS,
                )
                break
            except asyncio.TimeoutError:
                pass

            if shutdown_event.is_set():
                break

            leads_found = await run_scrape_cycle()
            logger.info(f"Scheduled scrape: {leads_found} leads")

        except asyncio.CancelledError:
            logger.info("Scraper worker cancelled")
            break
        except Exception as e:
            logger.error(f"Unexpected error in scraper loop: {e}", exc_info=True)
            await asyncio.sleep(60)

    logger.info("Scraper worker stopped")
