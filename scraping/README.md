# LeadForge Scraping Engine

This package handles the discovery and extraction of leads from various public sources.

## Structure

- `scrapers/`: Modular source-specific scrapers.
  - `facebook.py`: Facebook Groups and Marketplace.
  - `job_boards.py`: Indeed, Craigslist, etc.
  - `classifieds.py`: Local classifieds.
  - `permits.py`: Building permit offices.
  - `property_records.py`: Property transaction records.
- `pipeline.py`: Normalization, deduplication, and enrichment logic.
- `dispatcher.py`: Logic for pushing processed leads to the core API.

## Setup

1. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```
2. Configure environment variables (see `.env.example`).
