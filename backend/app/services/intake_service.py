"""
IntakeService — Chat state machine, lead scoring, and urgency classification
"""
import re
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.intake import IntakeLead

logger = logging.getLogger("leadforge.intake")

# ── Keyword dictionaries ─────────────────────────────────────────────

URGENCY_KEYWORDS = [
    "arrest", "arrested", "custody", "jail", "prison", "charged", "charges",
    "dui", "dwi", "court date", "court tomorrow", "hearing tomorrow",
    "arraignment", "trial", "statute of limitations", "deadline", "expiring",
    "emergency", "critical", "restraining order", "domestic violence",
    "abuse", "threatened", "hospital", "surgery", "icu", "intensive care",
    "eviction", "foreclosure", "deportation", "deported",
    "just happened", "happened today", "happened yesterday",
]

HOT_KEYWORDS = [
    "need attorney", "need a lawyer", "need lawyer", "hire", "representation",
    "looking for attorney", "find attorney", "ready to", "asap",
    "as soon as possible", "immediately", "right away",
    "settlement", "lawsuit", "sue", "damages", "compensation",
    "serious injury", "wrongful termination", "wrongful death",
    "fired", "terminated", "discrimination",
]

CASE_TYPE_MAP = {
    "personal_injury": [
        "1", "personal injury", "accident", "car accident", "car crash",
        "slip", "fall", "injury", "hurt", "injured", "crash", "collision",
        "dog bite", "medical malpractice", "malpractice",
    ],
    "criminal": [
        "2", "criminal", "crime", "arrest", "arrested", "dui", "dwi",
        "drug", "drugs", "theft", "robbery", "assault", "battery",
        "felony", "misdemeanor", "charges", "charged",
    ],
    "family": [
        "3", "family", "divorce", "custody", "child support", "alimony",
        "adoption", "marriage", "separation", "prenup", "restraining order",
        "domestic", "visitation",
    ],
    "estate": [
        "4", "estate", "will", "trust", "probate", "inheritance",
        "estate planning", "power of attorney", "guardian",
    ],
    "real_estate": [
        "5", "real estate", "property", "mortgage", "landlord", "tenant",
        "eviction", "lease", "contract", "closing", "title",
    ],
    "employment": [
        "6", "employment", "work", "job", "fired", "wrongful termination",
        "discrimination", "harassment", "wage", "overtime", "unpaid",
        "workplace", "boss", "employer",
    ],
    "immigration": [
        "7", "immigration", "visa", "green card", "citizenship",
        "deportation", "deported", "asylum", "refugee", "undocumented",
    ],
}

# ── Chat flow ────────────────────────────────────────────────────────

FLOW_STATES = [
    "greeting",
    "ask_case_type",
    "ask_description",
    "ask_urgency",
    "ask_phone",
    "ask_email",
    "complete",
]

BOT_PROMPTS = {
    "greeting": (
        "Hi! I'm the intake assistant. I'll help connect you with an attorney. "
        "May I have your full name to get started?"
    ),
    "ask_case_type": (
        "Thanks, {name}! What type of legal matter do you need help with? "
        "You can type the number or describe it:\n\n"
        "1. Personal Injury\n"
        "2. Criminal Defense\n"
        "3. Family Law\n"
        "4. Estate Planning\n"
        "5. Real Estate\n"
        "6. Employment\n"
        "7. Immigration\n"
        "8. Other"
    ),
    "ask_description": (
        "Got it. Please briefly describe your situation — "
        "the more detail you share, the better we can help."
    ),
    "ask_urgency": (
        "Is there any urgency to your matter? For example, an upcoming court date, "
        "recent arrest, accident, deadline, or anything time-sensitive? "
        "(Type 'no' if not urgent.)"
    ),
    "ask_phone": (
        "What is the best phone number to reach you?"
    ),
    "ask_email": (
        "And your email address?"
    ),
    "complete": (
        "Thank you, {name}! An attorney will review your information and "
        "contact you {urgency_phrase}. "
        "We appreciate you reaching out and will be in touch soon."
    ),
}


# ── Parsing helpers ──────────────────────────────────────────────────

def _extract_phone(text: str) -> Optional[str]:
    m = re.search(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', text)
    return m.group(0) if m else None


def _extract_email(text: str) -> Optional[str]:
    m = re.search(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', text)
    return m.group(0) if m else None


def _parse_case_type(text: str) -> str:
    lower = text.lower().strip()
    for case_type, keywords in CASE_TYPE_MAP.items():
        if any(kw in lower for kw in keywords):
            return case_type
    return "other"


# ── Lead scoring ─────────────────────────────────────────────────────

def score_lead(lead: IntakeLead) -> tuple[float, bool, bool, list[str]]:
    """Returns (score, is_hot, is_urgent, urgency_indicators)."""
    score = 0.30

    if lead.client_name:
        score += 0.05
    if lead.client_phone:
        score += 0.10
    if lead.client_email:
        score += 0.05
    if lead.case_type and lead.case_type != "other":
        score += 0.10

    combined = " ".join(filter(None, [lead.description, lead.urgency_note])).lower()

    if len(combined) > 50:
        score += 0.10
    if len(combined) > 200:
        score += 0.05

    urgency_hits = [kw for kw in URGENCY_KEYWORDS if kw in combined]
    score += min(len(urgency_hits) * 0.12, 0.35)

    hot_hits = [kw for kw in HOT_KEYWORDS if kw in combined]
    score += min(len(hot_hits) * 0.08, 0.20)

    score = min(score, 1.0)
    is_urgent = len(urgency_hits) > 0
    is_hot = score >= 0.65 or is_urgent

    return round(score, 3), is_hot, is_urgent, urgency_hits


def _next_state(current: str) -> str:
    idx = FLOW_STATES.index(current)
    if idx < len(FLOW_STATES) - 1:
        return FLOW_STATES[idx + 1]
    return "complete"


# ── Session management ───────────────────────────────────────────────

async def get_or_create_session(session_id: Optional[str], db: AsyncSession) -> IntakeLead:
    if session_id:
        result = await db.execute(
            select(IntakeLead).where(IntakeLead.session_id == session_id)
        )
        lead = result.scalar_one_or_none()
        if lead:
            return lead
    lead = IntakeLead()
    db.add(lead)
    await db.flush()
    return lead


async def start_session(db: AsyncSession, source: str = "chat") -> dict:
    """Create a new intake session and return the greeting."""
    lead = IntakeLead(intake_source=source, chat_state="greeting", chat_history=[])
    db.add(lead)
    await db.flush()

    greeting = BOT_PROMPTS["greeting"]
    lead.chat_history = [{"role": "bot", "content": greeting}]

    return {
        "session_id": lead.session_id,
        "message": greeting,
        "state": "greeting",
    }


async def process_message(session_id: str, user_text: str, db: AsyncSession) -> dict:
    """Advance the intake state machine one step and return the bot reply."""
    result = await db.execute(
        select(IntakeLead).where(IntakeLead.session_id == session_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        return {"error": "Session not found", "session_id": session_id}

    if lead.status == "complete":
        return {
            "session_id": session_id,
            "message": "Your intake is already complete. An attorney will contact you soon.",
            "state": "complete",
            "done": True,
        }

    history = lead.chat_history or []
    history.append({"role": "user", "content": user_text})

    current_state = lead.chat_state

    # ── Parse user input for the current state ───────────────────────
    if current_state == "greeting":
        lead.client_name = user_text.strip().title()
        lead.chat_state = _next_state(current_state)
        bot_msg = BOT_PROMPTS["ask_case_type"].format(name=lead.client_name)

    elif current_state == "ask_case_type":
        lead.case_type = _parse_case_type(user_text)
        lead.chat_state = _next_state(current_state)
        bot_msg = BOT_PROMPTS["ask_description"]

    elif current_state == "ask_description":
        lead.description = user_text.strip()
        lead.chat_state = _next_state(current_state)
        bot_msg = BOT_PROMPTS["ask_urgency"]

    elif current_state == "ask_urgency":
        stripped = user_text.strip().lower()
        if stripped not in {"no", "n", "none", "nope", "not really", "nothing"}:
            lead.urgency_note = user_text.strip()
        lead.chat_state = _next_state(current_state)
        bot_msg = BOT_PROMPTS["ask_phone"]

    elif current_state == "ask_phone":
        phone = _extract_phone(user_text) or user_text.strip()
        lead.client_phone = phone
        lead.chat_state = _next_state(current_state)
        bot_msg = BOT_PROMPTS["ask_email"]

    elif current_state == "ask_email":
        email = _extract_email(user_text) or user_text.strip()
        lead.client_email = email
        lead.chat_state = "complete"

        # Score the lead
        score, is_hot, is_urgent, urgency_indicators = score_lead(lead)
        lead.lead_score = score
        lead.is_hot = is_hot
        lead.is_urgent = is_urgent
        lead.urgency_indicators = urgency_indicators
        lead.status = "complete"

        urgency_phrase = "as soon as possible" if is_urgent else "shortly"
        bot_msg = BOT_PROMPTS["complete"].format(
            name=lead.client_name or "there",
            urgency_phrase=urgency_phrase,
        )
        if is_urgent:
            bot_msg += (
                "\n\n⚠️ Your matter has been flagged as urgent. "
                "An attorney will prioritize your call."
            )
        elif is_hot:
            bot_msg += (
                "\n\n✅ Your information looks complete. "
                "Expect a call within 1 business day."
            )

    else:
        bot_msg = "Thank you. An attorney will be in touch soon."

    history.append({"role": "bot", "content": bot_msg})
    lead.chat_history = history

    done = lead.chat_state == "complete"
    return {
        "session_id": session_id,
        "message": bot_msg,
        "state": lead.chat_state,
        "done": done,
        "is_hot": lead.is_hot if done else None,
        "is_urgent": lead.is_urgent if done else None,
        "lead_score": lead.lead_score if done else None,
    }


# ── TwiML voice helpers ──────────────────────────────────────────────

VOICE_STEPS = [
    ("name",        "May I have your full name?"),
    ("case_type",   (
        "What type of legal matter do you need help with? "
        "For example: personal injury, criminal defense, family law, "
        "real estate, employment, or immigration."
    )),
    ("description", (
        "Please briefly describe your situation. "
        "Speak for as long as you need."
    )),
    ("urgency",     (
        "Is there any urgency? For example, an upcoming court date, "
        "recent arrest, accident, or deadline? Say no if not urgent."
    )),
    ("phone",       (
        "What is the best callback number for you? "
        "Please say each digit clearly."
    )),
    ("email",       (
        "And your email address? Spell it out letter by letter."
    )),
]

VOICE_STEP_ORDER = [s[0] for s in VOICE_STEPS]


async def process_voice_step(
    call_sid: str,
    step: str,
    speech_result: str,
    db: AsyncSession,
) -> dict:
    """Process one gather step from a Twilio voice call."""
    result = await db.execute(
        select(IntakeLead).where(IntakeLead.session_id == call_sid)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        lead = IntakeLead(
            session_id=call_sid,
            intake_source="phone",
            chat_state="name",
            chat_history=[],
        )
        db.add(lead)
        await db.flush()

    history = lead.chat_history or []
    history.append({"role": "caller", "step": step, "content": speech_result})

    if step == "name":
        lead.client_name = speech_result.strip().title()
    elif step == "case_type":
        lead.case_type = _parse_case_type(speech_result)
    elif step == "description":
        lead.description = speech_result.strip()
    elif step == "urgency":
        if speech_result.lower().strip() not in {"no", "none", "nope", "nothing"}:
            lead.urgency_note = speech_result.strip()
    elif step == "phone":
        lead.client_phone = _extract_phone(speech_result) or speech_result.strip()
    elif step == "email":
        lead.client_email = speech_result.strip()

    # Determine next step
    try:
        idx = VOICE_STEP_ORDER.index(step)
        next_step = VOICE_STEP_ORDER[idx + 1] if idx + 1 < len(VOICE_STEP_ORDER) else None
    except ValueError:
        next_step = None

    if next_step:
        next_prompt = dict(VOICE_STEPS)[next_step]
        lead.chat_state = next_step
    else:
        # All steps done — score and close
        score, is_hot, is_urgent, indicators = score_lead(lead)
        lead.lead_score = score
        lead.is_hot = is_hot
        lead.is_urgent = is_urgent
        lead.urgency_indicators = indicators
        lead.status = "complete"
        next_step = None
        next_prompt = None

    lead.chat_history = history

    return {
        "lead": lead,
        "next_step": next_step,
        "next_prompt": next_prompt,
        "done": next_step is None,
    }
