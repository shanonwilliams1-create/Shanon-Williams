"""
SalesService — Lead-capture chat flow for the IntakeAI marketing site itself
(selling the product to law firms). Separate from intake_service.py, which
runs the client-intake chat that law firms embed for their own clients.
"""
import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intake import IntakeLead
from app.services.intake_service import _extract_email, _extract_phone

logger = logging.getLogger("leadforge.sales")

PLAN_LABELS = {
    "self_serve": "Self-Serve ($250/mo)",
    "managed": "Managed ($200/mo + $500 setup)",
}

SALES_FLOW = ["greeting", "ask_firm", "ask_team_size", "ask_email", "ask_phone", "complete"]

SALES_PROMPTS = {
    "ask_firm": "Nice to meet you, {name}! What's the name of your law firm?",
    "ask_team_size": "Got it. Roughly how many attorneys are on your team?",
    "ask_email": "What's the best email to reach you at?",
    "ask_phone": "And a phone number in case we need to follow up?",
    "complete": (
        "Thanks, {name}! \U0001F389 We've got everything we need. Someone from our "
        "team will reach out to {email} within 1 business day to get {firm} "
        "set up{plan_phrase}."
    ),
}


def _next_state(current: str) -> str:
    idx = SALES_FLOW.index(current)
    return SALES_FLOW[idx + 1] if idx < len(SALES_FLOW) - 1 else "complete"


async def start_sales_session(db: AsyncSession, plan: Optional[str] = None) -> dict:
    """Create a new sales-lead chat session and return the opening message."""
    plan_label = PLAN_LABELS.get(plan)
    plan_phrase = f" on the {plan_label} plan" if plan_label else ""

    lead = IntakeLead(
        intake_source="sales",
        chat_state="greeting",
        case_type=plan,
        chat_history=[],
    )
    db.add(lead)
    await db.flush()

    greeting = (
        f"Hi there! \U0001F44B I can get your firm set up with IntakeAI{plan_phrase}. "
        "First, what's your name?"
    )
    lead.chat_history = [{"role": "bot", "content": greeting}]

    return {"session_id": lead.session_id, "message": greeting, "state": "greeting"}


async def process_sales_message(session_id: str, user_text: str, db: AsyncSession) -> dict:
    """Advance the sales chat state machine one step and return the bot reply."""
    result = await db.execute(select(IntakeLead).where(IntakeLead.session_id == session_id))
    lead = result.scalar_one_or_none()
    if not lead:
        return {"error": "Session not found", "session_id": session_id}

    if lead.status == "complete":
        return {
            "session_id": session_id,
            "message": "You're all set — our team already has your information and will be in touch soon.",
            "state": "complete",
            "done": True,
        }

    history = lead.chat_history or []
    history.append({"role": "user", "content": user_text})

    current_state = lead.chat_state

    if current_state == "greeting":
        lead.client_name = user_text.strip().title()
        lead.chat_state = _next_state(current_state)
        bot_msg = SALES_PROMPTS["ask_firm"].format(name=lead.client_name)

    elif current_state == "ask_firm":
        lead.description = f"Firm: {user_text.strip()}"
        lead.chat_state = _next_state(current_state)
        bot_msg = SALES_PROMPTS["ask_team_size"]

    elif current_state == "ask_team_size":
        lead.description = f"{lead.description or ''} | Team size: {user_text.strip()}"
        lead.chat_state = _next_state(current_state)
        bot_msg = SALES_PROMPTS["ask_email"]

    elif current_state == "ask_email":
        lead.client_email = _extract_email(user_text) or user_text.strip()
        lead.chat_state = _next_state(current_state)
        bot_msg = SALES_PROMPTS["ask_phone"]

    elif current_state == "ask_phone":
        lead.client_phone = _extract_phone(user_text) or user_text.strip()
        lead.chat_state = "complete"
        lead.status = "complete"
        lead.is_hot = True

        plan_label = PLAN_LABELS.get(lead.case_type)
        plan_phrase = f" on the {plan_label} plan" if plan_label else ""
        firm = (lead.description or "your firm").split("Firm: ")[-1].split(" | ")[0]
        bot_msg = SALES_PROMPTS["complete"].format(
            name=lead.client_name or "there",
            email=lead.client_email or "your email",
            firm=firm,
            plan_phrase=plan_phrase,
        )

    else:
        bot_msg = "Thanks! Our team will be in touch soon."

    history.append({"role": "bot", "content": bot_msg})
    lead.chat_history = history

    done = lead.chat_state == "complete"
    return {
        "session_id": session_id,
        "message": bot_msg,
        "state": lead.chat_state,
        "done": done,
    }
