from pydantic_settings import BaseSettings
from typing import Dict, Any

class ScraperConfig(BaseSettings):
    """Settings for the scraping engine."""
    
    # Scraper settings
    target_zip_codes: list = ["78701", "78702", "78704"] # Default Austin area
    
    # Facebook settings
    fb_groups: list = []
    fb_check_interval: int = 1800  # seconds
    
    # API settings
    api_url: str = "http://localhost:3000"
    api_token: str = "dev_token"
    
    # Proxy settings
    proxy_list: list = []
    
    # Source-specific configs
    source_configs: Dict[str, Dict[str, Any]] = {
        "facebook": {"enabled": True, "cadence": "30m"},
        "job_boards": {"enabled": True, "cadence": "1h"},
        "classifieds": {"enabled": True, "cadence": "1h"},
        "permits": {"enabled": True, "cadence": "1w"},
        "property_records": {"enabled": True, "cadence": "1w"},
        "instagram": {"enabled": True, "cadence": "1h"},
        "tiktok": {"enabled": True, "cadence": "1h"},
        "snapchat": {"enabled": False, "cadence": "1d"},
        "nextdoor": {"enabled": False, "cadence": "1h"},
        "local_listings": {"enabled": True, "cadence": "1h"},
    }

    class Config:
        env_file = ".env"

config = ScraperConfig()
