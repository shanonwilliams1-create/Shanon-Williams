"""
LeadForge — Shared Enums (all model status/type fields)
"""
import enum


class SubscriptionTier(str, enum.Enum):
    STARTER = "starter"
    PRO = "pro"
    ELITE = "elite"


class TradeCategory(str, enum.Enum):
    ELECTRICIAN = "electrician"
    PLUMBER = "plumber"
    CARPENTER = "carpenter"
    ROOFER = "roofer"
    LANDSCAPER = "landscaper"
    PAINTER = "painter"
    GENERAL = "general"
    HVAC = "hvac"
    OTHER = "other"


class LeadSource(str, enum.Enum):
    FACEBOOK = "facebook"
    JOB_BOARD = "job_board"
    CLASSIFIEDS = "classifieds"
    NEWSPAPER = "newspaper"
    PERMIT = "permit"
    PROPERTY_RECORD = "property_record"
    MANUAL = "manual"


class LeadStatus(str, enum.Enum):
    NEW = "new"
    READ = "read"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    NOT_INTERESTED = "not_interested"
    BOOKED = "booked"
    LOST = "lost"
    CLOSED = "closed"


class OutreachChannel(str, enum.Enum):
    SMS = "sms"
    EMAIL = "email"
    CALL = "call"


class OutreachDirection(str, enum.Enum):
    OUTBOUND = "outbound"
    INBOUND = "inbound"


class OutreachStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    OPENED = "opened"
    REPLIED = "replied"


class AppointmentStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class FollowUpType(str, enum.Enum):
    POST_VISIT = "post_visit"
    POST_QUOTE = "post_quote"
    POST_BOOKING = "post_booking"
    REVIEW_REQUEST = "review_request"


class FollowUpStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class ReviewStatus(str, enum.Enum):
    REQUESTED = "requested"
    PUBLISHED = "published"
    DECLINED = "declined"


class ReferralStatus(str, enum.Enum):
    SENT = "sent"
    SIGNED_UP = "signed_up"
    CONVERTED = "converted"


class RewardStatus(str, enum.Enum):
    PENDING = "pending"
    AWARDED = "awarded"


class ScrapeStatus(str, enum.Enum):
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"


# ── Model imports ────────────────────────────────────────────────────
from app.models.user import User
from app.models.lead import Lead
from app.models.user_lead import UserLead
from app.models.outreach import Outreach
from app.models.appointment import Appointment
from app.models.followup import FollowUp
from app.models.review import Review
from app.models.referral import Referral
from app.models.subscription import SubscriptionPlan
from app.models.scraping import ScrapingSource, ScrapingLog