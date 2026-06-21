import httpx
from typing import Dict, Any

async def dispatch_lead(lead_data: Dict[str, Any], api_url: str, api_token: str):
    """Push a processed lead to the core API."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{api_url}/api/leads",
            json=lead_data,
            headers={"Authorization": f"Bearer {api_token}"}
        )
        response.raise_for_status()
        return response.json()
