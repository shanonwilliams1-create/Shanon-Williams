import asyncio
import os
import sys
import logging

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from scraping.pipeline import ScraperPipeline

async def test_pipeline():
    # Set the browsers path for playwright
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = os.path.join(base_dir, ".browsers")
    
    pipeline = ScraperPipeline()
    await pipeline.run()

if __name__ == "__main__":
    asyncio.run(test_pipeline())
