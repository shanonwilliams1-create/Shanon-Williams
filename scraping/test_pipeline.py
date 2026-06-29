import asyncio
import os
import sys
import logging

# Add the project root to sys.path to allow module imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

from scraping.dispatcher import run_pipeline

async def main():
    print("🚀 Starting Full Pipeline Test...")
    
    # Ensure Playwright browsers path is set
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = os.path.join(base_dir, ".browsers")
    
    try:
        await run_pipeline()
        print("\n✅ Pipeline test run finished.")
    except Exception as e:
        print(f"\n❌ Pipeline test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
