from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class SourceType(str, Enum):
    FACEBOOK = "facebook"
    JOB_BOARD = "job_board"
    CLASSIFIEDS = "classifieds"
    PERMIT = "permit"
    PROPERTY_RECORD = "property_record"

class RawLead(BaseModel):
    source: SourceType
    source_id: str
    source_url: str
    raw_text: str
    raw_location: Optional[str] = None
    external_timestamp: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)

class EnrichedLead(BaseModel):
    raw_lead: RawLead
    project_title: str
    description: str
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_zip: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    trade_category: str
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    project_timeline: Optional[str] = None
    confidence_score: float = 0.0
    enriched_at: datetime = Field(default_factory=datetime.utcnow)
