"""
NotificationService — Attorney alerts via SMS (Twilio) and email (SendGrid)

Falls back to console logging when credentials are not configured so the
rest of the intake flow never fails due to missing third-party keys.
"""
import logging
from datetime import datetime

import httpx

from app.config import settings
from app.models.intake import IntakeLead

logger = logging.getLogger("leadforge.notifications")

CASE_TYPE_LABELS = {
    "personal_injury": "Personal Injury",
    "criminal": "Criminal Defense",
    "family": "Family Law",
    "estate": "Estate Planning",
    "real_estate": "Real Estate",
    "employment": "Employment",
    "immigration": "Immigration",
    "other": "Other",
}


def _build_sms_body(lead: IntakeLead) -> str:
    flags = []
    if lead.is_urgent:
        flags.append("🚨 URGENT")
    if lead.is_hot:
        flags.append("🔥 HOT LEAD")

    flag_str = " | ".join(flags) if flags else "New Lead"
    case = CASE_TYPE_LABELS.get(lead.case_type or "other", "Other")
    score_pct = int((lead.lead_score or 0) * 100)

    lines = [
        f"[LeadForge] {flag_str}",
        f"Name: {lead.client_name or 'Unknown'}",
        f"Case: {case}",
        f"Score: {score_pct}%",
        f"Source: {lead.intake_source}",
    ]
    if lead.client_phone:
        lines.append(f"Phone: {lead.client_phone}")
    if lead.client_email:
        lines.append(f"Email: {lead.client_email}")
    if lead.urgency_note:
        lines.append(f"Urgency: {lead.urgency_note}")

    summary = (lead.description or "")[:120]
    if summary:
        lines.append(f"Summary: {summary}…" if len(lead.description or "") > 120 else f"Summary: {summary}")

    return "\n".join(lines)


def _build_email_body(lead: IntakeLead) -> str:
    flags = []
    if lead.is_urgent:
        flags.append("URGENT")
    if lead.is_hot:
        flags.append("HOT LEAD")

    flag_str = " / ".join(flags) if flags else "New Intake"
    case = CASE_TYPE_LABELS.get(lead.case_type or "other", "Other")
    score_pct = int((lead.lead_score or 0) * 100)

    urgency_section = ""
    if lead.urgency_note or lead.urgency_indicators:
        indicators = ", ".join(lead.urgency_indicators or [])
        urgency_section = f"""
<tr><td><strong>Urgency Note:</strong></td><td>{lead.urgency_note or ''}</td></tr>
<tr><td><strong>Urgency Keywords:</strong></td><td>{indicators}</td></tr>"""

    return f"""
<html><body style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px">
  <div style="background:{'#fef2f2' if lead.is_urgent else '#eff6ff'};
              border-left:4px solid {'#dc2626' if lead.is_urgent else '#3b82f6'};
              padding:12px 16px;border-radius:4px;margin-bottom:20px">
    <h2 style="margin:0;color:{'#dc2626' if lead.is_urgent else '#1d4ed8'}">
      {flag_str}
    </h2>
    <p style="margin:4px 0 0;color:#6b7280;font-size:14px">
      Lead score: {score_pct}% &nbsp;·&nbsp; Source: {lead.intake_source}
    </p>
  </div>

  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:6px 0;width:160px"><strong>Name:</strong></td>
        <td>{lead.client_name or '—'}</td></tr>
    <tr><td><strong>Case Type:</strong></td><td>{case}</td></tr>
    <tr><td><strong>Phone:</strong></td>
        <td><a href="tel:{lead.client_phone}">{lead.client_phone or '—'}</a></td></tr>
    <tr><td><strong>Email:</strong></td>
        <td><a href="mailto:{lead.client_email}">{lead.client_email or '—'}</a></td></tr>
    {urgency_section}
    <tr><td><strong>Description:</strong></td><td>{lead.description or '—'}</td></tr>
  </table>

  <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb"/>
  <p style="color:#9ca3af;font-size:12px">
    LeadForge Intake &nbsp;·&nbsp;
    Session ID: {lead.session_id} &nbsp;·&nbsp;
    {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}
  </p>
</body></html>
""".strip()


async def send_sms(lead: IntakeLead) -> bool:
    if not all([settings.twilio_account_sid, settings.twilio_auth_token,
                settings.twilio_from_number, settings.attorney_phone]):
        logger.info("Twilio not configured — SMS skipped (would have sent to attorney)")
        return False

    body = _build_sms_body(lead)
    url = (f"https://api.twilio.com/2010-04-01/Accounts/"
           f"{settings.twilio_account_sid}/Messages.json")

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                url,
                data={
                    "From": settings.twilio_from_number,
                    "To": settings.attorney_phone,
                    "Body": body,
                },
                auth=(settings.twilio_account_sid, settings.twilio_auth_token),
                timeout=10.0,
            )
            if resp.status_code in (200, 201):
                logger.info(f"SMS sent to attorney for intake {lead.session_id}")
                return True
            logger.error(f"Twilio SMS failed: {resp.status_code} {resp.text}")
        except Exception as exc:
            logger.error(f"Twilio SMS error: {exc}")
    return False


async def send_email(lead: IntakeLead) -> bool:
    if not all([settings.sendgrid_api_key, settings.attorney_email]):
        logger.info("SendGrid not configured — email skipped (would have sent to attorney)")
        return False

    flag = "URGENT" if lead.is_urgent else "Hot Lead" if lead.is_hot else "New"
    case = CASE_TYPE_LABELS.get(lead.case_type or "other", "Other")
    subject = f"[LeadForge] {flag} — {case} — {lead.client_name or 'Unknown'}"

    payload = {
        "personalizations": [{"to": [{"email": settings.attorney_email}]}],
        "from": {"email": settings.from_email, "name": settings.firm_name},
        "subject": subject,
        "content": [{"type": "text/html", "value": _build_email_body(lead)}],
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                json=payload,
                headers={"Authorization": f"Bearer {settings.sendgrid_api_key}"},
                timeout=10.0,
            )
            if resp.status_code == 202:
                logger.info(f"Email sent to attorney for intake {lead.session_id}")
                return True
            logger.error(f"SendGrid failed: {resp.status_code} {resp.text}")
        except Exception as exc:
            logger.error(f"SendGrid error: {exc}")
    return False


def _build_sales_email_body(lead: IntakeLead) -> str:
    return f"""
<html><body style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px">
  <div style="background:#eef2ff;border-left:4px solid #4f46e5;padding:12px 16px;
              border-radius:4px;margin-bottom:20px">
    <h2 style="margin:0;color:#4338ca">New IntakeAI Sales Lead</h2>
    <p style="margin:4px 0 0;color:#6b7280;font-size:14px">
      Plan interest: {lead.case_type or 'Not specified'}
    </p>
  </div>
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:6px 0;width:140px"><strong>Name:</strong></td>
        <td>{lead.client_name or '—'}</td></tr>
    <tr><td><strong>Phone:</strong></td>
        <td><a href="tel:{lead.client_phone}">{lead.client_phone or '—'}</a></td></tr>
    <tr><td><strong>Email:</strong></td>
        <td><a href="mailto:{lead.client_email}">{lead.client_email or '—'}</a></td></tr>
    <tr><td><strong>Details:</strong></td><td>{lead.description or '—'}</td></tr>
  </table>
  <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb"/>
  <p style="color:#9ca3af;font-size:12px">
    IntakeAI Sales &nbsp;·&nbsp; Session ID: {lead.session_id} &nbsp;·&nbsp;
    {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}
  </p>
</body></html>
""".strip()


async def send_sales_lead_email(lead: IntakeLead) -> bool:
    if not all([settings.sendgrid_api_key, settings.sales_email]):
        logger.info("SendGrid/sales_email not configured — sales lead email skipped")
        return False

    payload = {
        "personalizations": [{"to": [{"email": settings.sales_email}]}],
        "from": {"email": settings.from_email, "name": "IntakeAI"},
        "subject": f"[IntakeAI] New sales lead — {lead.client_name or 'Unknown'}",
        "content": [{"type": "text/html", "value": _build_sales_email_body(lead)}],
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                json=payload,
                headers={"Authorization": f"Bearer {settings.sendgrid_api_key}"},
                timeout=10.0,
            )
            if resp.status_code == 202:
                logger.info(f"Sales lead email sent for {lead.session_id}")
                return True
            logger.error(f"SendGrid sales email failed: {resp.status_code} {resp.text}")
        except Exception as exc:
            logger.error(f"SendGrid sales email error: {exc}")
    return False


async def notify_sales_team(lead: IntakeLead, db) -> bool:
    """Email the IntakeAI sales inbox when a prospective firm completes the sales chat."""
    if lead.attorney_notified:
        return True  # already sent

    ok = await send_sales_lead_email(lead)
    if not ok:
        logger.warning(
            f"Sales lead captured (no email channel configured):\n"
            f"  Name:  {lead.client_name}\n"
            f"  Phone: {lead.client_phone}\n"
            f"  Email: {lead.client_email}\n"
            f"  Plan:  {lead.case_type}\n"
            f"  Details: {lead.description}"
        )

    lead.attorney_notified = True
    lead.notified_at = datetime.utcnow()
    await db.flush()

    return ok


async def notify_attorney(lead: IntakeLead, db) -> bool:
    """
    Send SMS and/or email when a lead is hot or urgent.
    Marks attorney_notified on the lead and flushes to DB.
    """
    if not (lead.is_hot or lead.is_urgent):
        return False
    if lead.attorney_notified:
        return True  # already sent

    flag = "URGENT" if lead.is_urgent else "HOT"
    logger.info(
        f"Notifying attorney of {flag} intake lead {lead.session_id} "
        f"(score={lead.lead_score}, name={lead.client_name})"
    )

    sms_ok = await send_sms(lead)
    email_ok = await send_email(lead)

    if not sms_ok and not email_ok:
        # Always log the lead details so nothing is silently dropped
        logger.warning(
            f"No notification channels configured. {flag} lead details:\n"
            f"  Name:  {lead.client_name}\n"
            f"  Phone: {lead.client_phone}\n"
            f"  Email: {lead.client_email}\n"
            f"  Case:  {lead.case_type}\n"
            f"  Desc:  {lead.description}\n"
            f"  Urgency: {lead.urgency_note}"
        )

    lead.attorney_notified = True
    lead.notified_at = datetime.utcnow()
    await db.flush()

    return sms_ok or email_ok
