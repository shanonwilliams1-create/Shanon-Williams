import re
from typing import Optional, Tuple

def extract_phone(text: str) -> Optional[str]:
    """Extract phone number from text using regex."""
    phone_pattern = re.compile(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}')
    match = phone_pattern.search(text)
    return match.group(0) if match else None

def extract_email(text: str) -> Optional[str]:
    """Extract email from text using regex."""
    email_pattern = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
    match = email_pattern.search(text)
    return match.group(0) if match else None

def geocode_address(address: str) -> Tuple[Optional[float], Optional[float]]:
    """
    Stub for geocoding service.
    Returns (lat, lng).
    """
    return None, None

def classify_trade(text: str) -> str:
    """
    Stub for NLP trade classification.
    Returns trade category.
    """
    return "general"
