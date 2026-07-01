import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || process.env.SALES_EMAIL || '';
const SENDGRID_KEY = process.env.SENDGRID_API_KEY || '';
const FROM_EMAIL   = process.env.FROM_EMAIL || 'no-reply@intakeai.app';

app.use(express.json());

// ── In-memory session stores ──────────────────────────────────────────────────
const salesSessions  = new Map();
const intakeSessions = new Map();

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// ── Optional SendGrid notification ───────────────────────────────────────────
async function sendNotification(to, subject, text) {
  if (!SENDGRID_KEY || !to) return;
  try {
    const body = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL },
      subject,
      content: [{ type: 'text/plain', value: text }],
    };
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SENDGRID_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error('SendGrid error:', e.message);
  }
}

// ── SALES BOT ─────────────────────────────────────────────────────────────────
// Collects: name, firm, plan interest, email, phone

const SALES_STEPS = [
  // step 0 — greeting
  (s) => `Hey there! Thanks for your interest in IntakeAI. I just need a couple of quick details to get your firm set up. What's your name, and what firm are you with?`,

  // step 1 — plan interest (after name/firm)
  (s) => `Nice to meet you, ${s.name || 'there'}! We have two options:\n\nSelf-Serve – $250/month. You set it up yourself using our step-by-step guide.\n\nManaged – $200/month + a one-time $500 setup fee. Our team handles everything — installation, configuration, and onboarding.\n\nWhich sounds like a better fit for your firm?`,

  // step 2 — email (after plan)
  (s) => `${s.plan ? `${s.plan} is a popular choice. ` : ''}What's the best email address to reach you at?`,

  // step 3 — phone (after email)
  (s) => `Got it. And a phone number? Our team may give you a quick call to get things moving.`,

  // step 4 — done
  (s) => `You're all set, ${s.name || 'there'}! Someone from our team will be in touch at ${s.email} within one business day. We're looking forward to working with ${s.firm || 'your firm'}!`,
];

function parseSalesInput(step, input, session) {
  const txt = input.trim();
  if (step === 0) {
    // Try to split "John Smith, Smith & Associates"
    const comma = txt.indexOf(',');
    if (comma > 0) {
      session.name = txt.slice(0, comma).trim().split(' ')[0];
      session.firm = txt.slice(comma + 1).trim();
    } else {
      const words = txt.split(' ');
      session.name = words[0];
      session.firm = words.slice(1).join(' ') || txt;
    }
  } else if (step === 1) {
    const lower = txt.toLowerCase();
    session.plan = lower.includes('managed') ? 'Managed' : lower.includes('self') ? 'Self-Serve' : txt;
  } else if (step === 2) {
    session.email = txt;
  } else if (step === 3) {
    session.phone = txt;
  }
}

app.post('/api/intake/sales/start', (req, res) => {
  const id = uid();
  const plan = req.body?.plan || null;
  const session = { step: 0, plan, name: '', firm: '', email: '', phone: '' };
  salesSessions.set(id, session);
  res.json({ session_id: id, message: SALES_STEPS[0](session), done: false });
});

app.post('/api/intake/sales/message', async (req, res) => {
  const { session_id, message } = req.body || {};
  const session = salesSessions.get(session_id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.done) return res.json({ message: 'Thanks again! Our team will be in touch.', done: true });

  parseSalesInput(session.step, message || '', session);
  session.step += 1;

  const done = session.step >= SALES_STEPS.length - 1;
  const reply = SALES_STEPS[Math.min(session.step, SALES_STEPS.length - 1)](session);

  if (done) {
    session.done = true;
    const summary =
      `New IntakeAI Sales Lead\n` +
      `Name:  ${session.name}\n` +
      `Firm:  ${session.firm}\n` +
      `Plan:  ${session.plan}\n` +
      `Email: ${session.email}\n` +
      `Phone: ${session.phone}\n` +
      `Time:  ${new Date().toLocaleString()}`;
    console.log('\n── SALES LEAD ──────────────────\n' + summary + '\n────────────────────────────────');
    if (NOTIFY_EMAIL) {
      await sendNotification(NOTIFY_EMAIL, `IntakeAI Sales Lead — ${session.firm}`, summary);
    }
  }

  res.json({ message: reply, done });
});

// ── INTAKE BOT ────────────────────────────────────────────────────────────────
// For the "Free Case Review" widget on law firm sites (or our demo)

const INTAKE_STEPS = [
  (s) => `Hi! Thanks for reaching out. I'll grab a few quick details so the right attorney can review your case. What's your name?`,

  (s) => `Hi ${s.name}! What kind of legal issue are you dealing with? For example — car accident, criminal charge, divorce, workers' comp, immigration. Whatever fits your situation.`,

  (s) => `Got it. Can you give me a brief description of what happened and when?`,

  (s) => `Thanks for sharing that. Is this time-sensitive? For instance — do you have a court date coming up, were you recently arrested, or do you need help right away?`,

  (s) => `Understood. What's the best phone number to reach you at?`,

  (s) => `Almost done — what email should we send your case summary to?`,

  (s) => {
    const urgent = /yes|urgent|arrested|court|accident|hospital|emergency/i.test(s.urgency || '');
    return urgent
      ? `Thank you, ${s.name}. Your case has been flagged as urgent. Our team will reach out to you at ${s.phone || s.email} as soon as possible. You'll also get a confirmation at ${s.email}.`
      : `Thank you, ${s.name}! Your intake has been submitted. One of our attorneys will review your case and follow up at ${s.email} within one business day.`;
  },
];

function scoreIntake(session) {
  let score = 50;
  const urgencyText = (session.urgency || '').toLowerCase();
  const descText    = (session.description || '').toLowerCase();
  const combined    = urgencyText + ' ' + descText;
  if (/yes|urgent/i.test(urgencyText)) score += 20;
  if (/arrest|dui|criminal|accident|injury|hospital/i.test(combined)) score += 15;
  if (/court|deadline|tomorrow|today|tonight/i.test(combined)) score += 15;
  if (session.phone) score += 5;
  return Math.min(score, 100);
}

function parseIntakeInput(step, input, session) {
  const txt = input.trim();
  if (step === 0) session.name = txt.split(' ')[0];
  else if (step === 1) session.caseType = txt;
  else if (step === 2) session.description = txt;
  else if (step === 3) session.urgency = txt;
  else if (step === 4) session.phone = txt;
  else if (step === 5) session.email = txt;
}

app.post('/api/intake/chat/start', (req, res) => {
  const id = uid();
  const session = { step: 0, source: req.body?.source || 'chat' };
  intakeSessions.set(id, session);
  res.json({ session_id: id, message: INTAKE_STEPS[0](session), done: false });
});

app.post('/api/intake/chat/message', async (req, res) => {
  const { session_id, message } = req.body || {};
  const session = intakeSessions.get(session_id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.done) return res.json({ message: 'Our team will be in touch soon. Thank you!', done: true });

  parseIntakeInput(session.step, message || '', session);
  session.step += 1;

  const done = session.step >= INTAKE_STEPS.length - 1;
  const reply = INTAKE_STEPS[Math.min(session.step, INTAKE_STEPS.length - 1)](session);

  if (done) {
    session.done = true;
    const score   = scoreIntake(session);
    const urgent  = score >= 80;
    const summary =
      `New IntakeAI Lead (score: ${score}${urgent ? ' — URGENT' : ''})\n` +
      `Name:        ${session.name}\n` +
      `Case Type:   ${session.caseType}\n` +
      `Description: ${session.description}\n` +
      `Urgency:     ${session.urgency}\n` +
      `Phone:       ${session.phone}\n` +
      `Email:       ${session.email}\n` +
      `Source:      ${session.source}\n` +
      `Time:        ${new Date().toLocaleString()}`;
    console.log('\n── INTAKE LEAD ─────────────────\n' + summary + '\n────────────────────────────────');
    if (NOTIFY_EMAIL) {
      const subj = urgent
        ? `🚨 URGENT IntakeAI Lead — ${session.caseType} (score ${score})`
        : `New IntakeAI Lead — ${session.caseType} (score ${score})`;
      await sendNotification(NOTIFY_EMAIL, subj, summary);
    }
  }

  res.json({ message: reply, done, score: done ? scoreIntake(session) : undefined });
});

// ── Phone Intake (Twilio Voice) ───────────────────────────────────────────────
const phoneSessions = new Map();

function twiml(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
}
function say(text) {
  return `<Say voice="Polly.Joanna">${text}</Say>`;
}
function gather(action, text) {
  return (
    `<Gather input="speech" action="${action}" method="POST" speechTimeout="3" language="en-US">` +
    say(text) +
    `</Gather>` +
    say("Sorry, I didn't catch that.") +
    `<Redirect method="POST">${action}</Redirect>`
  );
}

const PHONE_INTRO_PROMPT =
  "Thank you for calling. I'm the virtual intake assistant. Can I start with your name?";

const PHONE_ROUTING_PROMPT = (name) =>
  `Hi ${name || 'there'}! Are you hoping to speak with an attorney, or would you like to schedule an in-person appointment at the office?`;

// Path A — leave a message / intake for attorney follow-up
const PHONE_INTAKE_STEPS = [
  { field: 'caseType',    prompt: "What type of legal issue are you dealing with? For example — car accident, criminal charge, divorce, or immigration." },
  { field: 'description', prompt: "Got it. Can you briefly describe what happened and when?" },
  { field: 'urgency',     prompt: "Thank you. Is this time-sensitive? For example, do you have a court date coming up, were you recently arrested, or do you need help right away?" },
  { field: 'email',       prompt: "Almost done. What email address should we send your case summary to?" },
];

// Path B — schedule an in-person appointment
const PHONE_APPT_STEPS = [
  { field: 'apptDay',    prompt: "Of course! What day works best for you — for example, Monday, Wednesday, or Friday?" },
  { field: 'apptTime',   prompt: "And do you prefer morning or afternoon?" },
  { field: 'apptMatter', prompt: "Got it. In a few words, what will this appointment be about? For example, a car accident, divorce, or a criminal matter." },
  { field: 'email',      prompt: "Last thing — what email should we send your appointment confirmation to?" },
];

function isBusinessHours(tz = 'America/Chicago', open = '09:00', close = '17:00') {
  const now     = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
  const day     = now.getDay(); // 0=Sun 6=Sat
  const hhmm    = now.toTimeString().slice(0, 5);
  return day >= 1 && day <= 5 && hhmm >= open && hhmm < close;
}

// ── Calendar Integration (iCal — universal: Google, Outlook, Apple, Yahoo, Calendly, Clio, etc.) ──

function parseIcalDate(str) {
  if (!str) return null;
  str = str.trim();
  // All-day: 20260701
  if (/^\d{8}$/.test(str)) {
    return new Date(`${str.slice(0,4)}-${str.slice(4,6)}-${str.slice(6,8)}T00:00:00`);
  }
  // Datetime: 20260701T090000Z or 20260701T090000
  const m = str.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] || ''}`;
  return new Date(iso);
}

function parseIcalEvents(ical) {
  const events = [];
  // Split on BEGIN:VEVENT, skip first chunk (header)
  const blocks = ical.split(/\r?\nBEGIN:VEVENT/);
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    // Unfold long lines (RFC 5545: continuation lines start with space/tab)
    const unfolded = block.replace(/\r?\n[ \t]/g, '');
    const get = (key) => {
      const m = unfolded.match(new RegExp(`\\n${key}(?:;[^:]*)?:([^\\r\\n]+)`, 'i'));
      return m ? m[1].trim() : '';
    };
    const summary  = get('SUMMARY');
    const startRaw = get('DTSTART');
    const endRaw   = get('DTEND') || get('DURATION'); // DURATION fallback is rare, skip for now
    const status   = get('STATUS'); // CONFIRMED, TENTATIVE, CANCELLED
    if (status === 'CANCELLED') continue;
    const start = parseIcalDate(startRaw);
    const end   = parseIcalDate(endRaw);
    if (start && end) events.push({ summary, start, end });
  }
  return events;
}

function inferStatusFromEvent(summary) {
  const s = summary.toLowerCase();
  if (/court|hearing|trial|arraignment|deposition|arbitration|mediation|docket|sentencing|plea/.test(s))
    return 'court';
  if (/vacation|out of office|ooo|pto|holiday|leave|sick|personal day|time off/.test(s))
    return 'out';
  if (/meeting|consult|client|conference|call|appointment|intake|interview/.test(s))
    return 'busy';
  // Any other calendar event during the day = with someone
  return 'busy';
}

async function fetchCalendarStatus(calendarUrl) {
  if (!calendarUrl) return null;
  try {
    const r = await fetch(calendarUrl, {
      headers: { 'User-Agent': 'IntakeAI-Calendar/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const ical = await r.text();
    const now  = new Date();
    const events = parseIcalEvents(ical);
    for (const ev of events) {
      if (ev.start <= now && now < ev.end) {
        const status = inferStatusFromEvent(ev.summary);
        console.log(`Calendar: active event "${ev.summary}" → status=${status}`);
        return { status, eventTitle: ev.summary };
      }
    }
    return null; // No active event right now
  } catch (e) {
    console.error('Calendar fetch error:', e.message);
    return null; // Fail open — fall back to manual status
  }
}

// ── Attorney Status Pages ─────────────────────────────────────────────────────
app.get('/status/:token', async (req, res) => {
  if (!dbPool) return res.status(503).send('Service unavailable');
  try {
    const { rows } = await dbPool.query(
      'SELECT * FROM intakeai_attorneys WHERE attorney_token = $1', [req.params.token]
    );
    if (!rows.length) return res.status(404).send('Attorney not found');
    const a = rows[0];
    const statuses = [
      { value: 'available', label: '✅ Available',        color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
      { value: 'busy',      label: '🔴 With a Client',    color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
      { value: 'court',     label: '⚖️ In Court',         color: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
      { value: 'out',       label: '🚫 Out of Office',    color: '#6b7280', bg: '#f9fafb', border: '#d1d5db' },
    ];
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>My Status — IntakeAI</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:white;border-radius:20px;padding:32px 24px;max-width:360px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center}
    .logo{font-size:13px;font-weight:600;color:#7c3aed;letter-spacing:.5px;margin-bottom:20px}
    h2{font-size:22px;font-weight:700;color:#111827;margin-bottom:4px}
    .sub{font-size:14px;color:#6b7280;margin-bottom:28px}
    .btn{display:block;width:100%;padding:18px 20px;border-radius:14px;border:2px solid transparent;
         font-size:17px;font-weight:600;cursor:pointer;margin-bottom:12px;transition:all .15s;text-align:center}
    .btn:active{transform:scale(.97)}
    .last{font-size:12px;color:#9ca3af;margin-top:16px}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">⚖️ IntakeAI</div>
    <h2>${a.name || 'Attorney'}</h2>
    <p class="sub">Tap to update your status — callers are routed based on this</p>
    ${statuses.map(s => `
    <form method="POST" action="/api/attorney/status/${req.params.token}?_method=POST">
      <button type="submit" name="status" value="${s.value}" class="btn"
        style="background:${a.status === s.value ? s.bg : 'white'};
               color:${s.color};
               border-color:${a.status === s.value ? s.border : '#e5e7eb'}">
        ${s.label}${a.status === s.value ? ' ◀ current' : ''}
      </button>
    </form>`).join('')}
    <p class="last">Last updated: ${new Date(a.last_status_at).toLocaleString()}</p>
  </div>
</body>
</html>`;
    res.type('text/html').send(html);
  } catch (e) {
    res.status(500).send('Error loading status page');
  }
});

app.post('/api/attorney/status/:token', async (req, res) => {
  const status = req.body?.status;
  if (!['available', 'busy', 'court', 'out'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (!dbPool) return res.status(503).json({ error: 'No database' });
  try {
    await dbPool.query(
      'UPDATE intakeai_attorneys SET status=$1, last_status_at=NOW() WHERE attorney_token=$2',
      [status, req.params.token]
    );
    res.redirect(`/status/${req.params.token}`);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/attorney/status/:token', async (req, res) => {
  if (!dbPool) return res.json({ status: 'available' });
  try {
    const { rows } = await dbPool.query(
      'SELECT status, name FROM intakeai_attorneys WHERE attorney_token=$1', [req.params.token]
    );
    res.json(rows[0] || { status: 'available' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Phone Intake ──────────────────────────────────────────────────────────────
app.post('/api/phone/inbound', async (req, res) => {
  const callSid  = req.body?.CallSid;
  const from     = req.body?.From || '';
  if (!callSid) return res.status(400).send('Missing CallSid');

  const clientToken = req.query.token   || '';
  const forwardTo   = req.query.forward || '';
  const tz          = req.query.tz      || 'America/Chicago';
  const open        = req.query.open    || '09:00';
  const close       = req.query.close   || '17:00';
  const mode        = req.query.mode    || 'afterhours';
  const duringHours = mode !== 'always' && isBusinessHours(tz, open, close);

  // Multi-attorney routing — check live availability status
  if (clientToken && dbPool) {
    try {
      const { rows: attorneys } = await dbPool.query(
        `SELECT * FROM intakeai_attorneys WHERE client_token=$1 ORDER BY rotation_order ASC, id ASC`,
        [clientToken]
      );

      if (attorneys.length > 0) {
        // Check each attorney's live calendar and override manual status if there's an active event
        for (const atty of attorneys) {
          if (atty.calendar_url) {
            const cal = await fetchCalendarStatus(atty.calendar_url);
            if (cal) atty.status = cal.status; // calendar beats the toggle
          }
        }

        const available = attorneys.filter(a => a.status === 'available' && a.phone);
        const allUnavailable = attorneys.every(a => a.status !== 'available');

        if (duringHours && available.length > 0) {
          // Route to next available attorney
          const atty = available[0];
          await dbPool.query(
            `UPDATE intakeai_attorneys SET rotation_order = rotation_order + 100 WHERE id=$1`, [atty.id]
          );
          console.log(`Phone: routing ${from} → ${atty.name} (${atty.phone})`);
          return res.type('text/xml').send(twiml(
            say('Please hold while we connect you.') +
            `<Dial timeout="20" action="/api/phone/dial-fallback?sid=${encodeURIComponent(callSid)}&token=${encodeURIComponent(clientToken)}" method="POST">${atty.phone}</Dial>`
          ));
        }

        if (duringHours && allUnavailable) {
          // Determine best message based on statuses
          const inCourt = attorneys.some(a => a.status === 'court');
          const allOut  = attorneys.every(a => a.status === 'out');
          const situation = inCourt
            ? 'Our attorney is currently in court.'
            : allOut
              ? 'Our office is currently closed.'
              : 'All of our attorneys are currently with clients.';
          phoneSessions.set(callSid, { phase: 'intro', step: 0, phone: from, name: '', intent: '', caseType: '', description: '', urgency: '', apptDay: '', apptTime: '', apptMatter: '', email: '', source: 'phone', clientToken, attorneys });
          return res.type('text/xml').send(twiml(
            say(situation) +
            gather(`/api/phone/gather?sid=${encodeURIComponent(callSid)}`, PHONE_INTRO_PROMPT)
          ));
        }

        // After hours or always-on mode
        phoneSessions.set(callSid, { phase: 'intro', step: 0, phone: from, name: '', intent: '', caseType: '', description: '', urgency: '', apptDay: '', apptTime: '', apptMatter: '', email: '', source: 'phone', clientToken, attorneys });
        return res.type('text/xml').send(twiml(gather(`/api/phone/gather?sid=${encodeURIComponent(callSid)}`, PHONE_INTRO_PROMPT)));
      }
    } catch (e) {
      console.error('Multi-attorney routing error:', e.message);
    }
  }

  // Single-attorney / legacy routing
  if (duringHours && forwardTo) {
    console.log(`Phone: business hours, forwarding ${from} → ${forwardTo}`);
    return res.type('text/xml').send(twiml(
      say('Please hold while we connect your call.') +
      `<Dial timeout="20" action="/api/phone/dial-fallback?sid=${encodeURIComponent(callSid)}" method="POST">${forwardTo}</Dial>`
    ));
  }

  console.log(`Phone: AI intake (mode=${mode}) from ${from}`);
  phoneSessions.set(callSid, { phase: 'intro', step: 0, phone: from, name: '', intent: '', caseType: '', description: '', urgency: '', apptDay: '', apptTime: '', apptMatter: '', email: '', source: 'phone' });
  res.type('text/xml').send(twiml(gather(`/api/phone/gather?sid=${encodeURIComponent(callSid)}`, PHONE_INTRO_PROMPT)));
});

// If the office doesn't answer during business hours, fall back to AI intake
app.post('/api/phone/dial-fallback', (req, res) => {
  const callSid    = req.query.sid;
  const dialStatus = req.body?.DialCallStatus || '';
  const from       = req.body?.From || '';
  if (dialStatus === 'completed') {
    return res.type('text/xml').send(twiml('<Hangup/>'));
  }
  // No answer / busy / failed — run AI intake
  console.log(`Phone: no answer (${dialStatus}), starting AI intake for ${from}`);
  phoneSessions.set(callSid, { phase: 'intro', step: 0, phone: from, name: '', intent: '', caseType: '', description: '', urgency: '', apptDay: '', apptTime: '', apptMatter: '', email: '', source: 'phone-fallback' });
  res.type('text/xml').send(twiml(gather(`/api/phone/gather?sid=${encodeURIComponent(callSid)}`, PHONE_INTRO_PROMPT)));
});

app.post('/api/phone/gather', async (req, res) => {
  const callSid = req.query.sid;
  const speech  = (req.body?.SpeechResult || '').trim();
  const session = phoneSessions.get(callSid);

  if (!session) {
    return res.type('text/xml').send(
      twiml(say("I'm sorry, your session expired. Please call back to start a new intake.") + '<Hangup/>')
    );
  }

  const gatherUrl = `/api/phone/gather?sid=${encodeURIComponent(callSid)}`;

  // ── Intro: collect caller's name ──────────────────────────────────────────
  if (session.phase === 'intro') {
    session.name  = speech.split(' ')[0] || speech;
    session.phase = 'routing';
    return res.type('text/xml').send(twiml(
      gather(gatherUrl, PHONE_ROUTING_PROMPT(session.name))
    ));
  }

  // ── Routing: speak with attorney or book in-person appointment ────────────
  if (session.phase === 'routing') {
    session.intent = speech;
    const lower = speech.toLowerCase();
    const wantsAppt = /appoint|schedul|meet|come in|visit|in.?person|office|see/.test(lower);
    session.phase = wantsAppt ? 'appointment' : 'intake';
    session.step  = 0;
    const steps = wantsAppt ? PHONE_APPT_STEPS : PHONE_INTAKE_STEPS;
    return res.type('text/xml').send(twiml(gather(gatherUrl, steps[0].prompt)));
  }

  // ── Intake: message + details for attorney follow-up ─────────────────────
  if (session.phase === 'intake') {
    const steps = PHONE_INTAKE_STEPS;
    session[steps[session.step].field] = speech;
    session.step += 1;

    if (session.step >= steps.length) {
      const score  = scoreIntake(session);
      const urgent = score >= 80;
      const summary =
        `New IntakeAI Phone Lead (score: ${score}${urgent ? ' — URGENT' : ''})\n` +
        `Name:        ${session.name}\n` +
        `Case Type:   ${session.caseType}\n` +
        `Description: ${session.description}\n` +
        `Urgency:     ${session.urgency}\n` +
        `Phone:       ${session.phone}\n` +
        `Email:       ${session.email}\n` +
        `Source:      ${session.source || 'phone'}\n` +
        `Time:        ${new Date().toLocaleString()}`;
      console.log('\n── PHONE LEAD ──────────────────\n' + summary + '\n────────────────────────────────');
      const notifyTargets = [...new Set([
        ...(session.attorneys?.map(a => a.email).filter(Boolean) || []),
        ...(NOTIFY_EMAIL ? [NOTIFY_EMAIL] : []),
      ])];
      const subj = urgent
        ? `URGENT Phone Lead — ${session.caseType} (score ${score})`
        : `New Phone Lead — ${session.caseType} (score ${score})`;
      for (const email of notifyTargets) await sendNotification(email, subj, summary);
      phoneSessions.delete(callSid);
      const closing = urgent
        ? `Thank you, ${session.name}. Your case has been flagged as urgent. An attorney will contact you as soon as possible. Goodbye.`
        : `Thank you, ${session.name}. Your information has been submitted and an attorney will follow up within one business day. Goodbye.`;
      return res.type('text/xml').send(twiml(say(closing) + '<Hangup/>'));
    }

    return res.type('text/xml').send(twiml(gather(gatherUrl, steps[session.step].prompt)));
  }

  // ── Appointment: schedule in-person visit ─────────────────────────────────
  if (session.phase === 'appointment') {
    const steps = PHONE_APPT_STEPS;
    session[steps[session.step].field] = speech;
    session.step += 1;

    if (session.step >= steps.length) {
      const summary =
        `📅 APPOINTMENT REQUEST\n` +
        `Name:    ${session.name}\n` +
        `Day:     ${session.apptDay}\n` +
        `Time:    ${session.apptTime}\n` +
        `Matter:  ${session.apptMatter}\n` +
        `Phone:   ${session.phone}\n` +
        `Email:   ${session.email}\n` +
        `Requested: ${new Date().toLocaleString()}`;
      console.log('\n── APPOINTMENT REQUEST ──────────\n' + summary + '\n────────────────────────────────');
      const notifyTargets = [...new Set([
        ...(session.attorneys?.map(a => a.email).filter(Boolean) || []),
        ...(NOTIFY_EMAIL ? [NOTIFY_EMAIL] : []),
      ])];
      for (const email of notifyTargets) {
        await sendNotification(
          email,
          `Appointment Request — ${session.name} (${session.apptDay}, ${session.apptTime})`,
          summary
        );
      }
      phoneSessions.delete(callSid);
      const closing = `Thank you, ${session.name}. Your appointment request for ${session.apptDay} ${session.apptTime} has been submitted. The office will confirm with you at ${session.email} shortly. We look forward to meeting you. Goodbye.`;
      return res.type('text/xml').send(twiml(say(closing) + '<Hangup/>'));
    }

    return res.type('text/xml').send(twiml(gather(gatherUrl, steps[session.step].prompt)));
  }

  return res.type('text/xml').send(twiml(say("I'm sorry, something went wrong. Please call back.") + '<Hangup/>'));
});

// ── Onboarding ───────────────────────────────────────────────────────────────
app.post('/api/onboarding/save', async (req, res) => {
  const {
    plan, firmName, website, practiceAreas, attorneyCount,
    forwardNumber, timezone, businessOpen, businessClose, callMode,
    attorneyName, attorneyEmail, attorneyPhone, calendarUrl,
  } = req.body || {};

  const largeFirm = parseInt(attorneyCount) >= 5;

  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const APP = process.env.APP_URL || 'https://www.myintakeai.com';

  const attorneyToken = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const statusPageUrl = `${APP}/status/${attorneyToken}`;

  if (dbPool) {
    try {
      await dbPool.query(
        `INSERT INTO intakeai_clients
         (client_token, plan, firm_name, website, practice_areas,
          forward_number, timezone, business_open, business_close, call_mode,
          attorney_name, attorney_email, attorney_phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [token, plan, firmName, website, Array.isArray(practiceAreas) ? practiceAreas.join(', ') : practiceAreas,
         forwardNumber, timezone, businessOpen, businessClose, callMode,
         attorneyName, attorneyEmail, attorneyPhone]
      );
      // Create the attorney record so they get a live status toggle page
      await dbPool.query(
        `INSERT INTO intakeai_attorneys (attorney_token, client_token, name, phone, email, rotation_order, calendar_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [attorneyToken, token, attorneyName || firmName, attorneyPhone || '', attorneyEmail || '', 0, calendarUrl || null]
      );
    } catch (e) {
      console.error('Onboarding save error:', e.message);
    }
  }

  const webhookUrl = `${APP}/api/phone/inbound?forward=${encodeURIComponent(forwardNumber || '')}&tz=${encodeURIComponent(timezone || 'America/Chicago')}&open=${businessOpen || '09:00'}&close=${businessClose || '17:00'}&mode=${callMode || 'afterhours'}&token=${token}`;

  if (SENDGRID_KEY && attorneyEmail) {
    const isManaged = plan === 'managed' || plan === 'firm';
    const body = `Welcome to IntakeAI, ${attorneyName || firmName || 'there'}!

Your ${plan} account is now active. Here are your setup details:

FIRM: ${firmName}
PLAN: ${plan}
PRACTICE AREAS: ${Array.isArray(practiceAreas) ? practiceAreas.join(', ') : practiceAreas || 'Not specified'}

YOUR ATTORNEY STATUS PAGE (bookmark this on your phone):
${statusPageUrl}

Tap this link any time to toggle your status — Available, With a Client, In Court, or Out of Office.
When callers ring your IntakeAI number, the AI checks your live calendar first (if connected),
then your manual status, and routes accordingly.
${calendarUrl ? `\nYour calendar is connected — status will update automatically based on your scheduled events.` : `\nTip: Connect your calendar so your status updates automatically when you have court or meetings.\nAny calendar works (Google, Outlook, Apple, Calendly, Clio, and more) — just paste your iCal feed URL\ninto your attorney profile.`}

TWILIO PHONE WEBHOOK URL:
${webhookUrl}

HOW TO ACTIVATE PHONE INTAKE:
1. Sign up at twilio.com and get a phone number
2. Go to Phone Numbers > Manage > Active Numbers
3. Click your number > Set Voice Configuration webhook to the URL above (POST method)
4. Test by calling your Twilio number

${isManaged
  ? 'Our team will reach out within 1 business day to complete your full installation, including adding the chat widget to your website.'
  : 'For the chat widget, visit ' + APP + '/setup or reply to this email for instructions.'}

Best,
The IntakeAI Team
${APP}`;

    await sendNotification(attorneyEmail, `Welcome to IntakeAI — Your Setup Details`, body);
  }

  if (NOTIFY_EMAIL) {
    const flagged = largeFirm && plan !== 'firm' ? ' ⚠️ UPGRADE OPPORTUNITY — 5+ attorneys on non-Firm plan' : '';
    const summary = `New IntakeAI Client${flagged}\nPlan: ${plan}\nFirm: ${firmName}\nAttorneys: ${attorneyCount || 'not specified'}\nEmail: ${attorneyEmail}\nPhone: ${attorneyPhone}`;
    await sendNotification(NOTIFY_EMAIL, `New IntakeAI Client — ${firmName || 'Unknown'}${largeFirm && plan !== 'firm' ? ' ⚠️ FIRM UPGRADE' : ''}`, summary);
  }

  console.log(`Onboarding complete: ${firmName} (${plan}) → ${attorneyEmail}`);
  res.json({ ok: true, token, attorneyToken, statusPageUrl });
});

// ── Stripe Checkout ───────────────────────────────────────────────────────────
const STRIPE_SECRET          = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PRICE_SELFSERVE = process.env.STRIPE_PRICE_SELFSERVE || '';
const STRIPE_PRICE_MANAGED   = process.env.STRIPE_PRICE_MANAGED || '';
const STRIPE_PRICE_SETUP     = process.env.STRIPE_PRICE_MANAGED_SETUP || '';
const STRIPE_PRICE_FIRM      = process.env.STRIPE_PRICE_FIRM || '';
const STRIPE_PRICE_FIRM_SETUP = process.env.STRIPE_PRICE_FIRM_SETUP || '';
const APP_URL = process.env.APP_URL || 'https://leadforge-production-3ee8.up.railway.app';

app.post('/api/stripe/checkout', async (req, res) => {
  const { plan } = req.body || {};
  if (!STRIPE_SECRET) {
    return res.status(503).json({ error: 'not_configured' });
  }

  try {
    const params = {
      mode: 'subscription',
      success_url: `${APP_URL}/onboarding?plan=${plan}`,
      cancel_url: `${APP_URL}/#pricing`,
      allow_promotion_codes: 'true',
      'billing_address_collection': 'required',
    };

    if (plan === 'selfserve') {
      if (!STRIPE_PRICE_SELFSERVE) return res.status(503).json({ error: 'price_not_configured' });
      params['line_items[0][price]']    = STRIPE_PRICE_SELFSERVE;
      params['line_items[0][quantity]'] = '1';
    } else if (plan === 'managed') {
      if (!STRIPE_PRICE_MANAGED) return res.status(503).json({ error: 'price_not_configured' });
      params['line_items[0][price]']    = STRIPE_PRICE_MANAGED;
      params['line_items[0][quantity]'] = '1';
      if (STRIPE_PRICE_SETUP) {
        params['subscription_data[add_invoice_items][0][price]']    = STRIPE_PRICE_SETUP;
        params['subscription_data[add_invoice_items][0][quantity]'] = '1';
      }
    } else if (plan === 'firm') {
      if (!STRIPE_PRICE_FIRM) return res.status(503).json({ error: 'price_not_configured' });
      params['line_items[0][price]']    = STRIPE_PRICE_FIRM;
      params['line_items[0][quantity]'] = '1';
      if (STRIPE_PRICE_FIRM_SETUP) {
        params['subscription_data[add_invoice_items][0][price]']    = STRIPE_PRICE_FIRM_SETUP;
        params['subscription_data[add_invoice_items][0][quantity]'] = '1';
      }
    } else {
      return res.status(400).json({ error: 'Plan must be "selfserve", "managed", or "firm"' });
    }

    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    const data = await r.json();
    if (!r.ok) throw new Error(data.error?.message || 'Stripe error');
    console.log(`Stripe session created: ${plan} → ${data.url}`);
    res.json({ url: data.url });
  } catch (e) {
    console.error('Stripe checkout error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Outbound Email Sender ─────────────────────────────────────────────────────
const FROM_NAME = process.env.FROM_NAME || 'Shanon Williams';

app.post('/api/send-email', async (req, res) => {
  const { to, subject, body } = req.body || {};
  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'to, subject, and body are required' });
  }
  if (!SENDGRID_KEY) {
    return res.status(503).json({
      error: 'not_configured',
      hint: 'Add SENDGRID_API_KEY and FROM_EMAIL to your Railway environment variables to enable auto-send.',
    });
  }
  try {
    const payload = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: FROM_NAME },
      reply_to: { email: FROM_EMAIL, name: FROM_NAME },
      subject,
      content: [{ type: 'text/plain', value: body }],
    };
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`SendGrid ${r.status}: ${txt}`);
    }
    console.log(`Email sent → ${to} | "${subject}"`);
    res.json({ ok: true });
  } catch (e) {
    console.error('send-email error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Web Scraper ───────────────────────────────────────────────────────────────
const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,6}\b/g;
const PHONE_RE = /(?:\+?1[\s.\-]?)?(?:\(?([2-9]\d{2})\)?[\s.\-]?)([2-9]\d{2})[\s.\-]?(\d{4})/g;

const JUNK_EMAIL_DOMAINS = ['sentry.io','wixpress.com','squarespace.com','godaddy.com',
  'wordpress.com','example.com','domain.com','yourdomain.com','email.com'];
const JUNK_EMAIL_LOCALS  = /^(noreply|no-reply|donotreply|postmaster|webmaster|support|admin|info@example)/i;
const JUNK_EMAIL_EXTS    = /\.(png|jpg|gif|svg|webp|pdf|css|js|woff|ttf)$/i;

function extractEmails(html) {
  EMAIL_RE.lastIndex = 0;
  const found = new Set();
  let m;
  while ((m = EMAIL_RE.exec(html)) !== null) {
    const e = m[0].toLowerCase();
    const [local, domain] = e.split('@');
    if (!domain) continue;
    if (JUNK_EMAIL_EXTS.test(e)) continue;
    if (JUNK_EMAIL_LOCALS.test(local)) continue;
    if (JUNK_EMAIL_DOMAINS.some(d => domain.endsWith(d))) continue;
    if (local.length > 50) continue;
    found.add(e);
  }
  return [...found];
}

function extractPhones(text) {
  PHONE_RE.lastIndex = 0;
  const found = new Set();
  let m;
  const plain = text.replace(/<[^>]+>/g, ' ');
  while ((m = PHONE_RE.exec(plain)) !== null) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length === 10 || (digits.length === 11 && digits[0] === '1')) {
      found.add(m[0].trim());
    }
  }
  return [...found];
}

function extractFirmName(html) {
  let m = html.match(/<meta[^>]+property="og:site_name"[^>]+content="([^"]{2,80})"/i)
           || html.match(/<meta[^>]+content="([^"]{2,80})"[^>]+property="og:site_name"/i);
  if (m) return m[1].trim();
  m = html.match(/<title[^>]*>([^<]{2,120})<\/title>/i);
  if (m) return m[1].split(/[|\-–—]/)[0].trim().slice(0, 80);
  return '';
}

function findSubpageLinks(html, origin) {
  const hrefs = [...html.matchAll(/href=["']([^"'#?]+)["']/gi)].map(x => x[1]);
  return hrefs
    .filter(h => /contact|about|team|staff|attorney|lawyer|people/i.test(h))
    .slice(0, 3)
    .map(h => { try { return h.startsWith('http') ? h : new URL(h, origin).href; } catch { return null; } })
    .filter(Boolean);
}

async function fetchHtml(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(7000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('html') && !ct.includes('text')) throw new Error('Not HTML');
  return r.text();
}

async function scrapeUrl(rawUrl) {
  if (!rawUrl.match(/^https?:\/\//i)) rawUrl = 'https://' + rawUrl;
  let origin;
  try { origin = new URL(rawUrl).origin; } catch { throw new Error('Invalid URL'); }

  const result = { url: rawUrl, firmName: '', emails: [], phones: [] };

  let mainHtml = '';
  try {
    mainHtml = await fetchHtml(rawUrl);
    result.firmName = extractFirmName(mainHtml);
    result.emails.push(...extractEmails(mainHtml));
    result.phones.push(...extractPhones(mainHtml));
  } catch (e) {
    result.error = e.message;
    return result;
  }

  // Try contact / about / team sub-pages
  for (const link of findSubpageLinks(mainHtml, origin)) {
    try {
      const sub = await fetchHtml(link);
      result.emails.push(...extractEmails(sub));
      result.phones.push(...extractPhones(sub));
    } catch { /* skip */ }
  }

  result.emails = [...new Set(result.emails)];
  result.phones = [...new Set(result.phones)];
  return result;
}

app.post('/api/scrape', async (req, res) => {
  const { urls } = req.body || {};
  if (!Array.isArray(urls) || !urls.length) {
    return res.status(400).json({ error: 'urls array required' });
  }
  const list = urls.slice(0, 50).map(u => u.trim()).filter(Boolean);
  const results = [];
  const BATCH = 5;
  for (let i = 0; i < list.length; i += BATCH) {
    const batch = list.slice(i, i + BATCH);
    const done = await Promise.all(batch.map(url =>
      scrapeUrl(url).catch(e => ({ url, error: e.message, firmName: '', emails: [], phones: [] }))
    ));
    results.push(...done);
    if (i + BATCH < list.length) await new Promise(r => setTimeout(r, 400));
  }
  console.log(`Scrape: ${results.length} URLs, ${results.filter(r => r.emails.length).length} with emails`);
  res.json({ results });
});

// ── Worldwide Outreach Engine ─────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL || '';
const dbPool = DB_URL
  ? new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
  : null;

async function initDb() {
  if (!dbPool) return;
  try {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS intakeai_clients (
        id              SERIAL PRIMARY KEY,
        client_token    TEXT UNIQUE NOT NULL,
        plan            TEXT,
        firm_name       TEXT,
        practice_areas  TEXT,
        website         TEXT,
        forward_number  TEXT,
        timezone        TEXT DEFAULT 'America/Chicago',
        business_open   TEXT DEFAULT '09:00',
        business_close  TEXT DEFAULT '17:00',
        call_mode       TEXT DEFAULT 'afterhours',
        attorney_name   TEXT,
        attorney_email  TEXT,
        attorney_phone  TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS intakeai_attorneys (
        id              SERIAL PRIMARY KEY,
        attorney_token  TEXT UNIQUE NOT NULL,
        client_token    TEXT NOT NULL,
        name            TEXT,
        phone           TEXT,
        email           TEXT,
        status          TEXT DEFAULT 'available',
        rotation_order  INTEGER DEFAULT 0,
        last_status_at  TIMESTAMPTZ DEFAULT NOW(),
        calendar_url    TEXT
      )
    `);
    // Add calendar_url to existing tables that were created before this column existed
    await dbPool.query(`ALTER TABLE intakeai_attorneys ADD COLUMN IF NOT EXISTS calendar_url TEXT`);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS intakeai_firms (
        id           SERIAL PRIMARY KEY,
        email        TEXT UNIQUE NOT NULL,
        firm_name    TEXT,
        website      TEXT,
        city         TEXT,
        country      TEXT,
        practice     TEXT,
        discovered   TIMESTAMPTZ DEFAULT NOW(),
        sent_at      TIMESTAMPTZ,
        unsubscribed BOOLEAN DEFAULT FALSE
      )
    `);
    console.log('DB: intakeai_firms table ready');
  } catch (e) {
    console.error('DB init error:', e.message);
  }
}

const WORLDWIDE_TARGETS = [
  { city: 'Houston',       country: 'US' },
  { city: 'Dallas',        country: 'US' },
  { city: 'Austin',        country: 'US' },
  { city: 'Phoenix',       country: 'US' },
  { city: 'Philadelphia',  country: 'US' },
  { city: 'San Antonio',   country: 'US' },
  { city: 'San Diego',     country: 'US' },
  { city: 'Jacksonville',  country: 'US' },
  { city: 'Columbus',      country: 'US' },
  { city: 'Charlotte',     country: 'US' },
  { city: 'Indianapolis',  country: 'US' },
  { city: 'Denver',        country: 'US' },
  { city: 'Nashville',     country: 'US' },
  { city: 'Atlanta',       country: 'US' },
  { city: 'Las Vegas',     country: 'US' },
  { city: 'Memphis',       country: 'US' },
  { city: 'Louisville',    country: 'US' },
  { city: 'Baltimore',     country: 'US' },
  { city: 'Milwaukee',     country: 'US' },
  { city: 'Albuquerque',   country: 'US' },
  { city: 'London',        country: 'UK' },
  { city: 'Manchester',    country: 'UK' },
  { city: 'Birmingham',    country: 'UK' },
  { city: 'Leeds',         country: 'UK' },
  { city: 'Glasgow',       country: 'UK' },
  { city: 'Toronto',       country: 'Canada' },
  { city: 'Vancouver',     country: 'Canada' },
  { city: 'Calgary',       country: 'Canada' },
  { city: 'Edmonton',      country: 'Canada' },
  { city: 'Ottawa',        country: 'Canada' },
  { city: 'Sydney',        country: 'Australia' },
  { city: 'Melbourne',     country: 'Australia' },
  { city: 'Brisbane',      country: 'Australia' },
  { city: 'Perth',         country: 'Australia' },
  { city: 'Adelaide',      country: 'Australia' },
  { city: 'Auckland',      country: 'New Zealand' },
  { city: 'Wellington',    country: 'New Zealand' },
  { city: 'Dublin',        country: 'Ireland' },
  { city: 'Cork',          country: 'Ireland' },
  { city: 'Singapore',     country: 'Singapore' },
  { city: 'Johannesburg',  country: 'South Africa' },
  { city: 'Cape Town',     country: 'South Africa' },
];

const PRACTICES = [
  'personal injury', 'criminal defense', 'family law', 'immigration',
  'real estate', 'employment law', 'bankruptcy', 'estate planning',
  'business law', 'civil litigation', 'workers compensation', 'DUI defense',
];

async function searchDuckDuckGo(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  try {
    const html = await fetchHtml(url);
    const links = [...html.matchAll(/href="(https?:\/\/[^"&]+)"/gi)]
      .map(m => { try { return new URL(m[1]).origin; } catch { return null; } })
      .filter(Boolean);
    const seen = new Set();
    return links.filter(l => {
      if (seen.has(l)) return false;
      if (/duckduckgo|bing\.com|google\.|facebook\.|yelp\.|avvo\.|findlaw\.|lawyers\.com|justia\.|martindale\.|yellowpages|thumbtack|bark\.com/.test(l)) return false;
      seen.add(l);
      return true;
    }).slice(0, 8);
  } catch (e) {
    console.error(`DDG search failed for "${query}":`, e.message);
    return [];
  }
}

async function discoverFirms({ limit = 20 } = {}) {
  if (!dbPool) return { discovered: 0, error: 'No database configured' };
  let discovered = 0;
  const targets   = [...WORLDWIDE_TARGETS].sort(() => Math.random() - 0.5).slice(0, 5);
  const practices = [...PRACTICES].sort(() => Math.random() - 0.5).slice(0, 3);

  for (const { city, country } of targets) {
    for (const practice of practices) {
      if (discovered >= limit) break;
      const query = `${practice} law firm ${city} ${country} contact email`;
      console.log(`Discovering: ${query}`);
      const urls = await searchDuckDuckGo(query);
      for (const url of urls) {
        if (discovered >= limit) break;
        try {
          const scraped = await scrapeUrl(url);
          if (!scraped.emails.length) continue;
          for (const email of scraped.emails.slice(0, 2)) {
            try {
              const result = await dbPool.query(
                `INSERT INTO intakeai_firms (email, firm_name, website, city, country, practice)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (email) DO NOTHING
                 RETURNING id`,
                [email, scraped.firmName || url, url, city, country, practice]
              );
              if (result.rowCount > 0) discovered++;
            } catch { /* duplicate */ }
          }
        } catch { /* skip bad url */ }
        await new Promise(r => setTimeout(r, 1500));
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log(`Discovery complete: +${discovered} new firms`);
  return { discovered };
}

function buildOutreachEmail(firm) {
  const firstName = firm.firm_name
    ? firm.firm_name.split(/[\s,&]/)[0]
    : 'there';
  return {
    subject: `${firm.firm_name || 'Your firm'} is losing clients after hours — here's the fix`,
    body: `Hi ${firstName},

Here's a number that might surprise you: studies show that 42% of calls to law firms go unanswered — and 85% of those callers never call back. They move on to the next firm.

That means nearly half of your potential clients are slipping away while you're in court, with another client, or simply after hours.

IntakeAI fixes this. It's a 24/7 AI-powered intake system built specifically for law firms:

• Answers every inquiry the moment it comes in — nights, weekends, holidays
• Qualifies each potential client and scores urgency automatically (arrests, accidents, court deadlines)
• Sends you a full case summary by text and email the instant a hot lead finishes intake
• Works for any practice area — personal injury, criminal defense, family law, immigration, and more

The average firm that adds IntakeAI stops losing after-hours leads within the first week.

We offer a 14-day free trial with no setup fee required, and most firms are live within one business day.

Would you have 10 minutes this week to see how it would work for ${firm.firm_name || 'your firm'}?

Best,
Shanon Williams
IntakeAI
https://leadforge-production-3ee8.up.railway.app

---
You're receiving this because your firm appeared in a public directory.
To unsubscribe, reply with "unsubscribe" in the subject line.
IntakeAI · 1234 Main St · Houston, TX 77001`,
  };
}

async function sendDailyBatch({ limit = 100 } = {}) {
  if (!dbPool) return { sent: 0, error: 'No database configured' };
  if (!SENDGRID_KEY) return { sent: 0, error: 'No SendGrid key' };

  const { rows: firms } = await dbPool.query(
    `SELECT * FROM intakeai_firms
     WHERE sent_at IS NULL AND unsubscribed = FALSE
     ORDER BY discovered ASC
     LIMIT $1`,
    [limit]
  );

  let sent = 0;
  for (const firm of firms) {
    const { subject, body } = buildOutreachEmail(firm);
    try {
      const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${SENDGRID_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: firm.email }] }],
          from: { email: FROM_EMAIL, name: FROM_NAME },
          reply_to: { email: FROM_EMAIL, name: FROM_NAME },
          subject,
          content: [{ type: 'text/plain', value: body }],
        }),
      });
      if (r.ok || r.status === 202) {
        await dbPool.query(`UPDATE intakeai_firms SET sent_at = NOW() WHERE id = $1`, [firm.id]);
        sent++;
        console.log(`Outreach → ${firm.email} (${firm.city}, ${firm.country})`);
      } else {
        const err = await r.text();
        console.error(`SendGrid ${r.status} for ${firm.email}: ${err}`);
      }
    } catch (e) {
      console.error(`Failed → ${firm.email}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }
  console.log(`Batch complete: ${sent}/${firms.length} sent`);
  return { sent, total: firms.length };
}

function startScheduler() {
  if (!dbPool) {
    console.log('Scheduler: DATABASE_URL not set — worldwide outreach disabled');
    return;
  }

  // Discover new firms every 6 hours
  setInterval(() => { discoverFirms({ limit: 50 }).catch(console.error); }, 6 * 60 * 60 * 1000);

  // Send daily batch at 9 AM UTC
  function scheduleDaily() {
    const now  = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 0, 0));
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    const delay = next - now;
    console.log(`Scheduler: next email batch in ${Math.round(delay / 60000)} min`);
    setTimeout(async () => {
      await sendDailyBatch({ limit: 100 }).catch(console.error);
      scheduleDaily();
    }, delay);
  }
  scheduleDaily();

  // Initial discovery 30 s after startup
  setTimeout(() => { discoverFirms({ limit: 30 }).catch(console.error); }, 30_000);
  console.log('Scheduler: worldwide outreach engine started');
}

// Outreach API endpoints
app.get('/api/outreach/stats', async (_req, res) => {
  if (!dbPool) return res.json({ total: 0, sent: 0, pending: 0, note: 'DATABASE_URL not configured' });
  try {
    const { rows } = await dbPool.query(`
      SELECT
        COUNT(*)                                               AS total,
        COUNT(sent_at)                                         AS sent,
        COUNT(*) FILTER (WHERE sent_at IS NULL
                           AND NOT unsubscribed)               AS pending,
        COUNT(*) FILTER (WHERE unsubscribed)                   AS unsubscribed
      FROM intakeai_firms
    `);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/outreach/discover', (req, res) => {
  const limit = Math.min(parseInt(req.body?.limit) || 20, 100);
  res.json({ ok: true, message: `Discovery started (limit ${limit})` });
  discoverFirms({ limit }).catch(console.error);
});

app.post('/api/outreach/send-batch', (req, res) => {
  const limit = Math.min(parseInt(req.body?.limit) || 100, 100);
  res.json({ ok: true, message: `Batch send started (limit ${limit})` });
  sendDailyBatch({ limit }).catch(console.error);
});

app.post('/api/outreach/unsubscribe', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  if (!dbPool) return res.status(503).json({ error: 'No database' });
  await dbPool.query(`UPDATE intakeai_firms SET unsubscribed = TRUE WHERE email = $1`, [email.toLowerCase().trim()]);
  res.json({ ok: true });
});

// ── Static frontend ───────────────────────────────────────────────────────────
app.use(express.static(join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`IntakeAI on port ${PORT} | notify → ${NOTIFY_EMAIL || '(no email set)'}`);
  await initDb();
  startScheduler();
});
