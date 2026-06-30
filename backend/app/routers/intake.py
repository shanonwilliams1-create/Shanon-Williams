"""
Intake Router — Client intake via chat widget and Twilio voice calls

Chat endpoints:
  POST /intake/chat/start          → create session, return greeting
  POST /intake/chat/message        → process user message, return bot reply

Attorney dashboard:
  GET  /intake/leads               → list all intake leads (requires auth)
  GET  /intake/leads/{id}          → full detail with transcript
  PATCH /intake/leads/{id}/status  → mark contacted / rejected

Twilio voice webhooks (no auth — validated by Twilio signature):
  POST /intake/voice               → initial TwiML (answer call)
  POST /intake/voice/gather        → gather-step callback
  POST /intake/voice/recording     → transcription/recording callback
"""
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Form, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth_middleware import get_current_user
from app.models.intake import IntakeLead
from app.models.user import User
from app.services.intake_service import (
    start_session,
    process_message,
    process_voice_step,
    VOICE_STEPS,
)
from app.services.notification_service import notify_attorney

router = APIRouter(prefix="/intake", tags=["intake"])


# ── Pydantic schemas ─────────────────────────────────────────────────

class StartRequest(BaseModel):
    source: str = "chat"


class MessageRequest(BaseModel):
    session_id: str
    message: str


class StatusUpdate(BaseModel):
    status: str  # contacted | rejected


# ── Chat endpoints ───────────────────────────────────────────────────

@router.post("/chat/start")
async def chat_start(req: StartRequest, db: AsyncSession = Depends(get_db)):
    """Create a new intake session and return the opening message."""
    session_data = await start_session(db, source=req.source)
    return session_data


@router.post("/chat/message")
async def chat_message(req: MessageRequest, db: AsyncSession = Depends(get_db)):
    """
    Process a user message and advance the intake state machine.
    When the session completes, scores the lead and notifies the attorney
    if is_hot or is_urgent.
    """
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    result = await process_message(req.session_id, req.message, db)

    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])

    # Notify attorney when session just completed
    if result.get("done"):
        res = await db.execute(
            select(IntakeLead).where(IntakeLead.session_id == req.session_id)
        )
        lead = res.scalar_one_or_none()
        if lead and not lead.attorney_notified:
            await notify_attorney(lead, db)

    return result


# ── Attorney dashboard ───────────────────────────────────────────────

@router.get("/leads")
async def list_intake_leads(
    status: Optional[str] = None,
    urgent_only: bool = False,
    hot_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List intake leads, newest first. Filterable by status, hot, urgent."""
    q = select(IntakeLead).order_by(desc(IntakeLead.created_at))

    if status:
        q = q.where(IntakeLead.status == status)
    if urgent_only:
        q = q.where(IntakeLead.is_urgent == True)  # noqa: E712
    elif hot_only:
        q = q.where(IntakeLead.is_hot == True)     # noqa: E712

    q = q.offset(offset).limit(limit)
    rows = (await db.execute(q)).scalars().all()

    return [_serialize_lead(r) for r in rows]


@router.get("/leads/{lead_id}")
async def get_intake_lead(
    lead_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full intake lead including chat transcript."""
    result = await db.execute(select(IntakeLead).where(IntakeLead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Intake lead not found")
    return _serialize_lead(lead, include_history=True)


@router.patch("/leads/{lead_id}/status")
async def update_intake_status(
    lead_id: str,
    body: StatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Attorney marks a lead as contacted or rejected."""
    valid = {"contacted", "rejected", "complete", "chatting"}
    if body.status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid}")

    result = await db.execute(select(IntakeLead).where(IntakeLead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Intake lead not found")

    lead.status = body.status
    await db.flush()
    return _serialize_lead(lead)


# ── Test / simulation endpoint ──────────────────────────────────────

@router.post("/test/simulate-call")
async def simulate_call(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a realistic fake phone-intake lead and runs the full pipeline
    (scoring + attorney notification) without a real Twilio call.
    Safe to call repeatedly — each run creates a new unique session.
    """
    import uuid

    from app.services.intake_service import score_lead

    fake_sid = f"SIM_{uuid.uuid4().hex[:20].upper()}"

    lead = IntakeLead(
        session_id=fake_sid,
        intake_source="phone",
        chat_state="complete",
        client_name="Maria Gonzalez",
        client_phone="(555) 213-4478",
        client_email="maria.g@email.com",
        case_type="personal_injury",
        description=(
            "I was in a serious car accident yesterday on I-95. "
            "The other driver ran a red light and hit me. "
            "I was taken to the hospital and had surgery on my shoulder. "
            "I'm currently in the ICU. The other driver's insurance is already "
            "calling me and I don't know what to say. I need an attorney asap."
        ),
        urgency_note=(
            "Patient in ICU following surgery — just happened yesterday. "
            "Insurance company already making contact."
        ),
        chat_history=[
            {"role": "system",
             "content": "[Simulated phone call — no real Twilio number required]"},
            {"role": "caller", "step": "name",        "content": "Maria Gonzalez"},
            {"role": "caller", "step": "case_type",   "content": "car accident, personal injury"},
            {"role": "caller", "step": "description", "content": "Serious car crash on I-95 yesterday, now in the ICU after shoulder surgery"},
            {"role": "caller", "step": "urgency",     "content": "Yes, I'm in the hospital right now, it just happened yesterday"},
            {"role": "caller", "step": "phone",       "content": "five five five two one three four four seven eight"},
            {"role": "caller", "step": "email",       "content": "maria dot g at email dot com"},
        ],
        status="complete",
    )
    db.add(lead)
    await db.flush()

    score, is_hot, is_urgent, indicators = score_lead(lead)
    lead.lead_score = score
    lead.is_hot = is_hot
    lead.is_urgent = is_urgent
    lead.urgency_indicators = indicators

    await notify_attorney(lead, db)

    return {
        **_serialize_lead(lead, include_history=True),
        "simulated": True,
        "notification_attempted": True,
    }


# ── Twilio voice webhooks ────────────────────────────────────────────

def _twiml(say_text: str, action_url: Optional[str] = None) -> str:
    """Generate TwiML for a gather step or a final say."""
    if action_url:
        return (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            "<Response>"
            f'<Gather input="speech" action="{action_url}" method="POST" '
            f'timeout="6" speechTimeout="auto" language="en-US">'
            f"<Say>{say_text}</Say>"
            "</Gather>"
            # Fallback if caller doesn't speak
            f"<Say>I didn't catch that. {say_text}</Say>"
            "</Response>"
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f"<Response><Say>{say_text}</Say><Hangup/></Response>"
    )


@router.post("/voice")
async def voice_incoming(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Twilio calls this when a client dials in.
    Returns TwiML that greets and asks for the caller's name.
    """
    form = await request.form()
    call_sid = form.get("CallSid", "unknown")

    # Create a session keyed by CallSid
    existing = await db.execute(
        select(IntakeLead).where(IntakeLead.session_id == call_sid)
    )
    if not existing.scalar_one_or_none():
        lead = IntakeLead(
            session_id=call_sid,
            intake_source="phone",
            chat_state="name",
            chat_history=[],
        )
        db.add(lead)
        await db.flush()

    base = str(request.base_url).rstrip("/")
    action = f"{base}/api/intake/voice/gather?step=name"
    xml = _twiml(
        "Hello! Thank you for calling. I am the intake assistant. "
        "I will collect some basic information so an attorney can help you. "
        "May I have your full name?",
        action_url=action,
    )
    return Response(content=xml, media_type="application/xml")


@router.post("/voice/gather")
async def voice_gather(
    request: Request,
    step: str = "name",
    db: AsyncSession = Depends(get_db),
):
    """
    Twilio posts speech results here after each <Gather>.
    Advances the voice state machine and returns the next prompt.
    """
    form = await request.form()
    call_sid = form.get("CallSid", "unknown")
    speech_result = form.get("SpeechResult", "").strip()

    if not speech_result:
        # Reprompt with the same question
        step_prompt = dict(VOICE_STEPS).get(step, "Please try again.")
        base = str(request.base_url).rstrip("/")
        action = f"{base}/api/intake/voice/gather?step={step}"
        return Response(content=_twiml(step_prompt, action_url=action),
                        media_type="application/xml")

    state = await process_voice_step(call_sid, step, speech_result, db)
    lead: IntakeLead = state["lead"]
    base = str(request.base_url).rstrip("/")

    if state["done"]:
        # Notify attorney before hanging up
        await notify_attorney(lead, db)
        farewell = (
            "Thank you! Your information has been received. "
            "An attorney will call you back "
            + ("as soon as possible." if lead.is_urgent else "shortly.")
        )
        xml = _twiml(farewell)
    else:
        next_step = state["next_step"]
        next_prompt = state["next_prompt"]
        action = f"{base}/api/intake/voice/gather?step={next_step}"
        xml = _twiml(next_prompt, action_url=action)

    return Response(content=xml, media_type="application/xml")


@router.post("/voice/recording")
async def voice_recording(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Optional Twilio recording/transcription callback.
    Appends the full transcript to the intake lead's chat_history.
    """
    form = await request.form()
    call_sid = form.get("CallSid", "")
    transcription_text = form.get("TranscriptionText", "")
    recording_url = form.get("RecordingUrl", "")

    if call_sid:
        result = await db.execute(
            select(IntakeLead).where(IntakeLead.session_id == call_sid)
        )
        lead = result.scalar_one_or_none()
        if lead:
            history = lead.chat_history or []
            if transcription_text:
                history.append({"role": "transcript", "content": transcription_text})
            if recording_url:
                history.append({"role": "recording", "url": recording_url})
            lead.chat_history = history
            await db.flush()

    return Response(content="<?xml version='1.0'?><Response/>",
                    media_type="application/xml")


# ── Serialization helper ─────────────────────────────────────────────

def _serialize_lead(lead: IntakeLead, include_history: bool = False) -> dict:
    d = {
        "id": lead.id,
        "session_id": lead.session_id,
        "intake_source": lead.intake_source,
        "status": lead.status,
        "client_name": lead.client_name,
        "client_phone": lead.client_phone,
        "client_email": lead.client_email,
        "case_type": lead.case_type,
        "description": lead.description,
        "urgency_note": lead.urgency_note,
        "urgency_indicators": lead.urgency_indicators or [],
        "lead_score": lead.lead_score,
        "is_hot": lead.is_hot,
        "is_urgent": lead.is_urgent,
        "attorney_notified": lead.attorney_notified,
        "notified_at": lead.notified_at.isoformat() if lead.notified_at else None,
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
        "updated_at": lead.updated_at.isoformat() if lead.updated_at else None,
    }
    if include_history:
        d["chat_history"] = lead.chat_history or []
    return d
