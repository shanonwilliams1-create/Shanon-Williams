from abc import ABC, abstractmethod
from typing import List, Optional, Any
from ..models import RawLead

class BaseScraper(ABC):
    """
    Abstract base class for all scrapers.
    Each source-specific scraper must implement the scrape method.
    """

    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}

    @abstractmethod
    async def scrape(self, zip_codes: Optional[List[str]] = None) -> List[RawLead]:
        """
        Main entry point for the scraper.
        Returns a list of RawLead objects.
        """
        pass

    async def fetch(self, url: str) -> str:
        """
        Common method to fetch HTML content from a URL.
        To be implemented using httpx or playwright depending on the source.
        """
        # Default implementation or stub
        pass

    def parse(self, html: str) -> List[dict]:
        """
        Common method to parse HTML content.
        To be implemented using BeautifulSoup or similar.
        """
        pass

    def extract_metadata(self, item: Any) -> dict:
        """
        Common method to extract source-specific metadata.
        """
        return {}
